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
const { getUserAssets } = await import("../db.js");

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
  fileType = "hd",
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
    expect(data.fileType).toBe("hd");
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

  it("rejects HD file type if not PDF", async () => {
    const { headers, body } = multipartPayload("chart.png", "PNG fake", "image/png", "hd");
    const sessionSubject = `st-assets-hd-${Date.now()}`;
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
    expect(JSON.parse(res.body).error).toMatch(/PDF/);
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
      fileType: "hd",
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
    expect(assets[0].fileType).toBe("hd");
    expect(assets[0].sizeBytes).toBeGreaterThan(0);
    expect(assets[0].createdAt).toBeDefined();
    // Single HD bodygraph -> it's the active one used for transits/reports.
    expect(assets[0].isActive).toBe(true);
    // Verify camelCase (not snake_case)
    expect(assets[0].mime_type).toBeUndefined();
  });

  it("GET /api/me/assets marks only the most recent fileType=hd as active", async () => {
    const sessionSubject = "st-assets-active";
    const linkedUserId = await createLinkedTestUser(app, sessionSubject);

    // Upload three: oldest hd, then a natal, then the newest hd.
    const upload = async (name: string, fileType: "hd" | "natal") => {
      const { headers, body } = multipartPayload(name, "%PDF-content", "application/pdf");
      await app.inject({
        method: "POST",
        url: `/api/users/${linkedUserId}/assets?fileType=${fileType}`,
        headers: {
          ...headers,
          ...sessionHeaders(sessionSubject),
        },
        body,
      });
      // Tiny gap so created_at sorts deterministically across uploads.
      await new Promise((r) => setTimeout(r, 1100));
    };

    await upload("old-hd.pdf", "hd");
    await upload("natal-chart.pdf", "natal");
    await upload("new-hd.pdf", "hd");

    const res = await app.inject({
      method: "GET",
      url: "/api/me/assets",
      headers: sessionHeaders(sessionSubject),
    });
    const { assets } = JSON.parse(res.body);
    const byName = Object.fromEntries(assets.map((a: { filename: string }) => [a.filename, a]));

    expect(byName["new-hd.pdf"].isActive).toBe(true);
    expect(byName["old-hd.pdf"].isActive).toBe(false);
    // Natal charts are never the active bodygraph; pill should not show.
    expect(byName["natal-chart.pdf"].isActive).toBe(false);
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
