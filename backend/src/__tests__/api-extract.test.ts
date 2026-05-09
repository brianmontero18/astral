import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const extractProfileFromAssets = vi.fn(async () => ({
  humanDesign: {
    type: "Generator",
  },
}));

class MockUserFacingError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../extraction-service.js", () => ({
  UserFacingError: MockUserFacingError,
  extractProfileFromAssets,
}));

const {
  createAsset,
  getUser,
  updateUserProfile,
} = await import("../db.js");
const {
  createLinkedTestUser,
  createTestApp,
  createTestUser,
  sessionHeaders,
} = await import("./helpers.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  extractProfileFromAssets.mockReset();
  extractProfileFromAssets.mockResolvedValue({
    humanDesign: {
      type: "Generator",
    },
  });
});

function multipartPayload(
  filename: string,
  content: Buffer | string,
  mimeType: string,
) {
  const boundary = "----TestBoundary" + Date.now();
  const body = Buffer.concat([
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

describe("POST /api/extract-profile", () => {
  it("returns authentication_required when no validated session exists", async () => {
    const ownerId = await createTestUser(app);
    const assetId = await createAsset(
      ownerId,
      "chart.pdf",
      "application/pdf",
      "hd",
      Buffer.from("%PDF-owner"),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/extract-profile",
      payload: { assetIds: [assetId] },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("returns 403 when any asset does not belong to the session user", async () => {
    const ownerId = await createLinkedTestUser(app, "st-extract-owner");
    const intruderId = await createLinkedTestUser(app, "st-extract-intruder");

    const ownerAssetId = await createAsset(
      ownerId,
      "owner.pdf",
      "application/pdf",
      "hd",
      Buffer.from("%PDF-owner"),
    );
    const otherAssetId = await createAsset(
      intruderId,
      "other.pdf",
      "application/pdf",
      "hd",
      Buffer.from("%PDF-other"),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/extract-profile",
      headers: sessionHeaders("st-extract-owner"),
      payload: { assetIds: [ownerAssetId, otherAssetId] },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "asset_forbidden",
      assetId: otherAssetId,
    });
    expect(extractProfileFromAssets).not.toHaveBeenCalled();
  });

  it("returns 404 when any requested asset does not exist", async () => {
    await createLinkedTestUser(app, "st-extract-missing");

    const res = await app.inject({
      method: "POST",
      url: "/api/extract-profile",
      headers: sessionHeaders("st-extract-missing"),
      payload: { assetIds: ["missing-asset-id"] },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({
      error: "Asset not found",
      assetId: "missing-asset-id",
    });
    expect(extractProfileFromAssets).not.toHaveBeenCalled();
  });

  it("extracts a profile when all assets belong to the current session user", async () => {
    const ownerId = await createLinkedTestUser(app, "st-extract-linked");
    const firstAssetId = await createAsset(
      ownerId,
      "chart.pdf",
      "application/pdf",
      "hd",
      Buffer.from("%PDF-1"),
    );
    const secondAssetId = await createAsset(
      ownerId,
      "notes.txt",
      "text/plain",
      "natal",
      Buffer.from("notes"),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/extract-profile",
      headers: sessionHeaders("st-extract-linked"),
      payload: { assetIds: [firstAssetId, secondAssetId] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      profile: {
        humanDesign: {
          type: "Generator",
        },
      },
    });
    expect(extractProfileFromAssets).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/me/bodygraph", () => {
  it("replaces users.profile, records profile_asset_id, and preserves intake", async () => {
    const subject = "st-bodygraph-replace";
    const userId = await createLinkedTestUser(app, subject, "Bodygraph User", {
      name: "Bodygraph User",
      humanDesign: {
        type: "Projector",
      },
    });
    const originalUser = await getUser(userId);
    expect(originalUser).toBeDefined();
    await updateUserProfile(
      userId,
      originalUser!.name,
      originalUser!.profile,
      {
        actividad: "Consultoria",
        desafio_actual: "Foco",
      },
    );

    extractProfileFromAssets.mockResolvedValueOnce({
      name: "",
      humanDesign: {
        type: "Generator",
      },
    });

    const { headers, body } = multipartPayload(
      "replacement.pdf",
      "%PDF-replacement",
      "application/pdf",
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph",
      headers: {
        ...headers,
        ...sessionHeaders(subject),
      },
      body,
    });

    expect(res.statusCode).toBe(201);
    const response = JSON.parse(res.body);
    expect(response.profile).toMatchObject({
      name: "Bodygraph User",
      humanDesign: {
        type: "Generator",
      },
    });
    expect(response.asset).toMatchObject({
      id: expect.any(String),
      filename: "replacement.pdf",
      fileType: "hd",
      isActive: true,
    });
    expect(response.user.intake).toEqual({
      actividad: "Consultoria",
      desafio_actual: "Foco",
    });

    const updatedUser = await getUser(userId);
    expect(updatedUser?.profile).toMatchObject({
      name: "Bodygraph User",
      humanDesign: {
        type: "Generator",
      },
    });
    expect(updatedUser?.profile_asset_id).toBe(response.asset.id);
    expect(updatedUser?.intake).toEqual({
      actividad: "Consultoria",
      desafio_actual: "Foco",
    });
    expect(extractProfileFromAssets).toHaveBeenCalledTimes(1);
  });

  it("rejects non-PDF bodygraph replacements", async () => {
    const subject = "st-bodygraph-non-pdf";
    await createLinkedTestUser(app, subject);
    const { headers, body } = multipartPayload("chart.png", "png", "image/png");

    const res = await app.inject({
      method: "POST",
      url: "/api/me/bodygraph",
      headers: {
        ...headers,
        ...sessionHeaders(subject),
      },
      body,
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/PDF/);
    expect(extractProfileFromAssets).not.toHaveBeenCalled();
  });
});
