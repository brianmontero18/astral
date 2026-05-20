/**
 * Assets API — Integration tests
 *
 * Tests file upload, download, listing, deletion, and validation.
 * Uses Fastify inject() with multipart payloads.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const {
  createLinkedTestUser,
  createTestApp,
  sessionHeaders,
} = await import("./helpers.js");
const { getUserAssets, updateUserBodygraph } = await import("../db.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

/** Build a multipart form body for Fastify inject */
function multipartPayload(
  filename: string,
  content: Buffer | string,
  mimeType: string,
  fileType = "natal",
) {
  const boundary = "----TestBoundary" + Date.now();
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="fileType"\r\n\r\n${fileType}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    Buffer.isBuffer(content) ? content : Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body,
  };
}

describe("POST /api/users/:userId/assets — upload", () => {
  it("uploads a PDF successfully", async () => {
    const sessionSubject = "st-assets-upload-pdf";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);
    const { headers, body } = multipartPayload("chart.pdf", "%PDF-1.4 fake content", "application/pdf");

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.id).toBeDefined();
    expect(data.filename).toBe("chart.pdf");
    expect(data.mimeType).toBe("application/pdf");
    expect(data.fileType).toBe("natal");
    expect(data.sizeBytes).toBeGreaterThan(0);
  });

  it("uploads a PNG image (as natal type)", async () => {
    const { headers, body } = multipartPayload("chart.png", "PNG fake", "image/png", "natal");
    const sessionSubject = `st-assets-upload-${Date.now()}`;
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).fileType).toBe("natal");
  });

  it("rejects fileType=hd on both upload paths and persists nothing", async () => {
    // /me/assets and /users/:userId/assets share handleAssetUpload. Accepting
    // fileType=hd here would save the file without extracting the profile, so
    // both paths must reject — PDF (which would otherwise pass mime checks)
    // and non-PDF — with a stable error code that tells callers to switch.
    const sessionSubject = `st-assets-hd-rejected-${Date.now()}`;
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);

    const png = multipartPayload("chart.png", "PNG fake", "image/png", "hd");
    const pngRes = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: { ...png.headers, ...sessionHeaders(sessionSubject) },
      body: png.body,
    });
    expect(pngRes.statusCode).toBe(400);
    expect(JSON.parse(pngRes.body).error).toBe("use_bodygraph_endpoint");

    const pdf = multipartPayload("chart.pdf", "%PDF-1.4 fake", "application/pdf", "hd");
    const pdfRes = await app.inject({
      method: "POST",
      url: "/api/me/assets",
      headers: { ...pdf.headers, ...sessionHeaders(sessionSubject) },
      body: pdf.body,
    });
    expect(pdfRes.statusCode).toBe(400);
    expect(JSON.parse(pdfRes.body).error).toBe("use_bodygraph_endpoint");

    // Neither rejected upload should have been persisted.
    const assets = await getUserAssets(linkedUserId);
    expect(assets).toEqual([]);
  });

  it("rejects unsupported mime types", async () => {
    const { headers, body } = multipartPayload("doc.docx", "fake", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "natal");
    const sessionSubject = `st-assets-mime-${Date.now()}`;
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid file type/);
  });

  it("returns authentication_required when no validated session exists", async () => {
    const sessionSubject = "st-assets-auth-required";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);
    const { headers, body } = multipartPayload("chart.pdf", "%PDF", "application/pdf");

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers,
      body,
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("returns client_identity_mismatch when the legacy path userId does not match the session user", async () => {
    const { headers, body } = multipartPayload("chart.pdf", "%PDF", "application/pdf");
    const ownerSubject = "st-assets-owner";
    const otherSubject = "st-assets-other";
    const ownerId = await createLinkedTestUser(app, ownerSubject);
    const otherId = await createLinkedTestUser(app, otherSubject);

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${otherId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(ownerSubject),
      },
      body,
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "client_identity_mismatch",
      userId: ownerId,
      requestedUserId: otherId,
      provider: "supertokens",
      subject: ownerSubject,
    });
  });

  it("POST /api/me/assets uploads to the current session user without the legacy path", async () => {
    const sessionSubject = "st-assets-upload-me";
    await createLinkedTestUser(app, sessionSubject);
    const { headers, body } = multipartPayload("chart.pdf", "%PDF-1.4 me route", "application/pdf");

    const res = await app.inject({
      method: "POST",
      url: "/api/me/assets",
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toMatchObject({
      id: expect.any(String),
      filename: "chart.pdf",
      mimeType: "application/pdf",
      fileType: "natal",
    });
  });

  it("POST /api/me/assets returns authentication_required and does not persist assets without a validated session", async () => {
    const sessionSubject = "st-assets-upload-me-expired";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);
    const { headers, body } = multipartPayload("chart.pdf", "%PDF-1.4 me route", "application/pdf");

    const res = await app.inject({
      method: "POST",
      url: "/api/me/assets",
      headers,
      body,
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });

    const assets = await getUserAssets(linkedUserId);
    expect(assets).toEqual([]);
  });
});

describe("Assets list routes", () => {
  it("GET /api/me/assets returns authentication_required without a validated session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me/assets",
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("GET /api/me/assets returns camelCase asset metadata for the current session user", async () => {
    const sessionSubject = "st-assets-list";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);

    // Upload one
    const { headers, body } = multipartPayload("test.pdf", "%PDF-content", "application/pdf");
    await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });

    // List
    const res = await app.inject({
      method: "GET",
      url: "/api/me/assets",
      headers: sessionHeaders(sessionSubject),
    });
    const { assets } = JSON.parse(res.body);

    expect(assets).toHaveLength(1);
    expect(assets[0].filename).toBe("test.pdf");
    expect(assets[0].mimeType).toBe("application/pdf");
    expect(assets[0].fileType).toBe("natal");
    expect(assets[0].sizeBytes).toBeGreaterThan(0);
    expect(assets[0].createdAt).toBeDefined();
    // Uploading an asset alone does not replace the canonical bodygraph.
    expect(assets[0].isActive).toBe(false);
    // Verify camelCase (not snake_case)
    expect(assets[0].mime_type).toBeUndefined();
  });

  it("GET /api/me/assets marks the asset linked from users.profile_asset_id as active", async () => {
    const sessionSubject = "st-assets-active";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);

    // /me/assets only accepts natal (HD goes through /me/bodygraph). The
    // isActive flag is driven by users.profile_asset_id regardless of
    // fileType, so we exercise the wiring against natal assets.
    const upload = async (name: string) => {
      const { headers, body } = multipartPayload(name, "%PDF-content", "application/pdf", "natal");
      await app.inject({
        method: "POST",
        url: `/api/users/${linkedUserId}/assets`,
        headers: {
          ...headers,
          ...sessionHeaders(sessionSubject),
        },
        body,
      });
      // Tiny gap so created_at sorts deterministically across uploads.
      await new Promise((r) => setTimeout(r, 1100));
    };

    await upload("first.pdf");
    await upload("middle.pdf");
    await upload("last.pdf");

    const rawAssets = await getUserAssets(linkedUserId);
    const first = rawAssets.find((asset) => asset.filename === "first.pdf");
    expect(first).toBeDefined();
    await updateUserBodygraph(
      linkedUserId,
      { humanDesign: { type: "Projector" } },
      first!.id,
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/me/assets",
      headers: sessionHeaders(sessionSubject),
    });
    const { assets } = JSON.parse(res.body);
    const byName = Object.fromEntries(assets.map((a: { filename: string }) => [a.filename, a]));

    expect(byName["first.pdf"].isActive).toBe(true);
    expect(byName["middle.pdf"].isActive).toBe(false);
    expect(byName["last.pdf"].isActive).toBe(false);
  });
});

describe("GET /api/assets/:id — download", () => {
  it("returns authentication_required when no validated session exists", async () => {
    const sessionSubject = "st-assets-download-auth";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);
    const { headers, body } = multipartPayload("download.pdf", "%PDF", "application/pdf");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });
    const { id } = JSON.parse(uploadRes.body);

    const res = await app.inject({ method: "GET", url: `/api/assets/${id}` });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("returns asset_forbidden when the asset belongs to another user", async () => {
    const ownerSubject = "st-assets-download-owner";
    const otherSubject = "st-assets-download-other";
    const ownerId = await createLinkedTestUser(app, ownerSubject);
    await createLinkedTestUser(app, otherSubject);
    const { headers, body } = multipartPayload("download.pdf", "%PDF", "application/pdf");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${ownerId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(ownerSubject),
      },
      body,
    });
    const { id } = JSON.parse(uploadRes.body);

    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${id}`,
      headers: sessionHeaders(otherSubject),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "asset_forbidden",
      assetId: id,
    });
  });

  it("returns file content with correct mime type", async () => {
    const sessionSubject = "st-assets-download-owner-ok";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);
    const content = "%PDF-1.4 test file content";
    const { headers, body } = multipartPayload("download.pdf", content, "application/pdf");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });
    const { id } = JSON.parse(uploadRes.body);

    const res = await app.inject({
      method: "GET",
      url: `/api/assets/${id}`,
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("download.pdf");
  });

  it("returns 404 for nonexistent asset", async () => {
    const sessionSubject = "st-assets-missing-download";
    await createLinkedTestUser(app, sessionSubject);
    const res = await app.inject({
      method: "GET",
      url: "/api/assets/fake-asset-id",
      headers: sessionHeaders(sessionSubject),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/assets/:id", () => {
  it("returns asset_forbidden when trying to delete another user's asset", async () => {
    const ownerSubject = "st-assets-delete-owner";
    const otherSubject = "st-assets-delete-other";
    const ownerId = await createLinkedTestUser(app, ownerSubject);
    await createLinkedTestUser(app, otherSubject);
    const { headers, body } = multipartPayload("delete-other.pdf", "%PDF", "application/pdf");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${ownerId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(ownerSubject),
      },
      body,
    });
    const { id } = JSON.parse(uploadRes.body);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/assets/${id}`,
      headers: sessionHeaders(otherSubject),
    });

    expect(deleteRes.statusCode).toBe(403);
    expect(JSON.parse(deleteRes.body)).toEqual({
      error: "asset_forbidden",
      assetId: id,
    });
  });

  it("deletes an existing asset", async () => {
    const sessionSubject = "st-assets-delete-owner-ok";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);
    const { headers, body } = multipartPayload("delete-me.pdf", "%PDF", "application/pdf");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: {
        ...headers,
        ...sessionHeaders(sessionSubject),
      },
      body,
    });
    const { id } = JSON.parse(uploadRes.body);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/assets/${id}`,
      headers: sessionHeaders(sessionSubject),
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(JSON.parse(deleteRes.body).ok).toBe(true);

    // Verify it's gone
    const getRes = await app.inject({
      method: "GET",
      url: `/api/assets/${id}`,
      headers: sessionHeaders(sessionSubject),
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("returns 404 for nonexistent asset", async () => {
    const sessionSubject = "st-assets-missing-delete";
    await createLinkedTestUser(app, sessionSubject);
    const res = await app.inject({
      method: "DELETE",
      url: "/api/assets/fake-id",
      headers: sessionHeaders(sessionSubject),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/me/bodygraph/chart-svg", () => {
  it("returns authentication_required without a validated session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/me/bodygraph/chart-svg" });
    expect(res.statusCode).toBe(401);
  });

  it("returns SVG content when the user has a calculated bodygraph", async () => {
    const sessionSubject = "st-chart-svg-ok";
    const userId = await createLinkedTestUser(app, sessionSubject);

    // The default linked-user profile has activatedGates populated via the
    // test helper, but the new endpoint expects a real shape from
    // calculateBodygraph. Submit a from-birth call first to seed it.
    await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: { "content-type": "application/json", ...sessionHeaders(sessionSubject) },
      payload: {
        name: "Brian",
        date: "1989-02-18",
        time: "08:00",
        place: { lat: 11.6757, lon: -70.2197, label: "Punta Cardón, Falcón, Venezuela" },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me/bodygraph/chart-svg",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/image\/svg\+xml/);
    expect(res.body).toContain("<svg");
    expect(res.body).toContain("</svg>");
    // userId asignado al fixture — sanity.
    expect(userId).toBeTruthy();
  });

  it("returns no_active_bodygraph when the user profile has no gates", async () => {
    const sessionSubject = "st-chart-svg-empty";
    // The test helper seeds activatedGates with placeholder numbers (no
    // line/planet/etc). For this endpoint we want to confirm the guard
    // returns 404 when activatedGates is empty — use a user with empty profile.
    await createLinkedTestUser(app, sessionSubject, "Empty User", {
      humanDesign: {
        type: "",
        strategy: "",
        authority: "",
        profile: "",
        definition: "",
        incarnationCross: "",
        notSelfTheme: "",
        variable: "",
        digestion: "",
        environment: "",
        strongestSense: "",
        channels: [],
        activatedGates: [],
        definedCenters: [],
        undefinedCenters: [],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me/bodygraph/chart-svg",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe("no_active_bodygraph");
  });

  it("clamps width to [1, 3000]", async () => {
    const sessionSubject = "st-chart-svg-clamp";
    await createLinkedTestUser(app, sessionSubject);
    await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: { "content-type": "application/json", ...sessionHeaders(sessionSubject) },
      payload: {
        name: "Brian",
        date: "1989-02-18",
        time: "08:00",
        place: { lat: 11.6757, lon: -70.2197, label: "Punta Cardón, Falcón, Venezuela" },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me/bodygraph/chart-svg?width=99999",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('width="3000"');
  });
});

describe("GET /api/me/bodygraph/pdf", () => {
  it("returns authentication_required without a validated session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/me/bodygraph/pdf" });
    expect(res.statusCode).toBe(401);
  });

  it("returns a PDF buffer when the user has a calculated bodygraph", async () => {
    const sessionSubject = "st-pdf-ok";
    await createLinkedTestUser(app, sessionSubject, "Brian Montero");

    await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: { "content-type": "application/json", ...sessionHeaders(sessionSubject) },
      payload: {
        name: "Brian Montero",
        date: "1989-02-18",
        time: "08:00",
        place: { lat: 11.6757, lon: -70.2197, label: "Punta Cardón, Falcón, Venezuela" },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me/bodygraph/pdf",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("bodygraph-brian-montero.pdf");
    // PDFs start with %PDF magic.
    expect(res.rawPayload.slice(0, 4).toString()).toBe("%PDF");
  });

  it("returns no_active_bodygraph when profile has no gates", async () => {
    const sessionSubject = "st-pdf-empty";
    await createLinkedTestUser(app, sessionSubject, "Empty User", {
      humanDesign: {
        type: "",
        strategy: "",
        authority: "",
        profile: "",
        definition: "",
        incarnationCross: "",
        notSelfTheme: "",
        variable: "",
        digestion: "",
        environment: "",
        strongestSense: "",
        channels: [],
        activatedGates: [],
        definedCenters: [],
        undefinedCenters: [],
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/me/bodygraph/pdf",
      headers: sessionHeaders(sessionSubject),
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe("no_active_bodygraph");
  });
});

describe("POST /api/me/bodygraph/from-birth", () => {
  /** Body fixture: Agos's birth data in Esquel (validated against the
   *  Genetic Matrix PDF in bodygraph-calculate.test.ts). */
  const AGOS_FROM_BIRTH = {
    name: "Agos",
    date: "1988-12-28",
    time: "04:13",
    place: { lat: -42.9135, lon: -71.3217, label: "Esquel, Chubut, Argentina" },
  };

  it("returns authentication_required without a validated session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: { "content-type": "application/json" },
      payload: AGOS_FROM_BIRTH,
    });
    expect(res.statusCode).toBe(401);
  });

  it("calculates and persists the bodygraph from birth data (Agos)", async () => {
    const sessionSubject = "st-from-birth-agos";
    const userId = await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: {
        "content-type": "application/json",
        ...sessionHeaders(sessionSubject),
      },
      payload: AGOS_FROM_BIRTH,
    });

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res.body);
    expect(data.user.id).toBe(userId);
    expect(data.profile.humanDesign.type).toBe("Proyector");
    expect(data.profile.humanDesign.profile).toBe("4/6");
    expect(data.profile.humanDesign.authority).toBe("Emocional (Plexo Solar)");
    expect(data.profile.birthData.placeLabel).toBe("Esquel, Chubut, Argentina");
    expect(data.profile.birthData.timezoneOffsetHours).toBe(-2);
    expect(data.profile.birthData.coordinates).toEqual({ lat: -42.9135, lon: -71.3217 });
  });

  it("leaves profile_asset_id NULL (asset is generated on-demand)", async () => {
    const sessionSubject = "st-from-birth-asset-null";
    const userId = await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: {
        "content-type": "application/json",
        ...sessionHeaders(sessionSubject),
      },
      payload: AGOS_FROM_BIRTH,
    });
    expect(res.statusCode).toBe(201);

    // /me/assets exposes isActive driven by users.profile_asset_id. With
    // from-birth there is no active asset.
    const listRes = await app.inject({
      method: "GET",
      url: "/api/me/assets",
      headers: sessionHeaders(sessionSubject),
    });
    const { assets } = JSON.parse(listRes.body);
    expect(assets.every((a: { isActive: boolean }) => !a.isActive)).toBe(true);

    // Direct DB check: getUser exposes profile_asset_id.
    const { getUser } = await import("../db.js");
    const user = await getUser(userId);
    expect(user!.profile_asset_id).toBeNull();
  });

  it("replaces the previous PDF asset when from-birth is called over an upload", async () => {
    const sessionSubject = "st-from-birth-replaces-asset";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);

    // Seed with a natal asset and link it as the active bodygraph (mimics
    // a PDF upload through /me/bodygraph without going through extraction).
    const { headers, body } = multipartPayload("old-chart.pdf", "%PDF", "application/pdf", "natal");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${linkedUserId}/assets`,
      headers: { ...headers, ...sessionHeaders(sessionSubject) },
      body,
    });
    const { id: oldAssetId } = JSON.parse(uploadRes.body);
    await updateUserBodygraph(linkedUserId, { humanDesign: { type: "Projector" } }, oldAssetId);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: {
        "content-type": "application/json",
        ...sessionHeaders(sessionSubject),
      },
      payload: AGOS_FROM_BIRTH,
    });
    expect(res.statusCode).toBe(201);

    // Old asset is gone; the new profile_asset_id is NULL.
    const { getUser } = await import("../db.js");
    const user = await getUser(linkedUserId);
    expect(user!.profile_asset_id).toBeNull();

    const rawAssets = await getUserAssets(linkedUserId);
    expect(rawAssets.find((a) => a.id === oldAssetId)).toBeUndefined();
  });

  it("rejects invalid date format", async () => {
    const sessionSubject = "st-from-birth-bad-date";
    await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: {
        "content-type": "application/json",
        ...sessionHeaders(sessionSubject),
      },
      payload: { ...AGOS_FROM_BIRTH, date: "12/28/1988" },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_date");
  });

  it("rejects invalid time format", async () => {
    const sessionSubject = "st-from-birth-bad-time";
    await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: {
        "content-type": "application/json",
        ...sessionHeaders(sessionSubject),
      },
      payload: { ...AGOS_FROM_BIRTH, time: "4:13am" },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_time");
  });

  it("rejects out-of-range coordinates", async () => {
    const sessionSubject = "st-from-birth-bad-coords";
    await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: {
        "content-type": "application/json",
        ...sessionHeaders(sessionSubject),
      },
      payload: {
        ...AGOS_FROM_BIRTH,
        place: { lat: 999, lon: 999, label: "Nowhere" },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_place");
  });

  it("rejects missing place label", async () => {
    const sessionSubject = "st-from-birth-no-label";
    await createLinkedTestUser(app, sessionSubject);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph/from-birth",
      headers: {
        "content-type": "application/json",
        ...sessionHeaders(sessionSubject),
      },
      payload: {
        ...AGOS_FROM_BIRTH,
        place: { lat: -42.9135, lon: -71.3217, label: "" },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_place");
  });
});
