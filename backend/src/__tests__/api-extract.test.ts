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
  extractProfileFromAssets.mockClear();
});

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
