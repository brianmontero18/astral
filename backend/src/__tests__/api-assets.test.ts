/**
 * Assets API — Integration tests
 *
 * Tests file upload, download, listing, deletion, and validation.
 * Uses Fastify inject() with multipart payloads.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, createTestUser } from "./helpers.js";

let app: FastifyInstance;
let userId: string;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  userId = await createTestUser(app);
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
    const { headers, body } = multipartPayload("chart.pdf", "%PDF-1.4 fake content", "application/pdf");

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${userId}/assets`,
      headers,
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

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${userId}/assets`,
      headers,
      body,
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).fileType).toBe("natal");
  });

  it("rejects HD file type if not PDF", async () => {
    const { headers, body } = multipartPayload("chart.png", "PNG fake", "image/png", "hd");

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${userId}/assets`,
      headers,
      body,
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/PDF/);
  });

  it("rejects unsupported mime types", async () => {
    const { headers, body } = multipartPayload("doc.docx", "fake", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "natal");

    const res = await app.inject({
      method: "POST",
      url: `/api/users/${userId}/assets`,
      headers,
      body,
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/Invalid file type/);
  });

  it("returns 404 for nonexistent user", async () => {
    const { headers, body } = multipartPayload("chart.pdf", "%PDF", "application/pdf");

    const res = await app.inject({
      method: "POST",
      url: "/api/users/fake-user-id/assets",
      headers,
      body,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/users/:userId/assets — list", () => {
  it("returns empty list for user with no assets", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/users/${userId}/assets`,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).assets).toEqual([]);
  });

  it("returns camelCase asset metadata after upload", async () => {
    // Upload one
    const { headers, body } = multipartPayload("test.pdf", "%PDF-content", "application/pdf");
    await app.inject({ method: "POST", url: `/api/users/${userId}/assets`, headers, body });

    // List
    const res = await app.inject({ method: "GET", url: `/api/users/${userId}/assets` });
    const { assets } = JSON.parse(res.body);

    expect(assets).toHaveLength(1);
    expect(assets[0].filename).toBe("test.pdf");
    expect(assets[0].mimeType).toBe("application/pdf");
    expect(assets[0].fileType).toBe("hd");
    expect(assets[0].sizeBytes).toBeGreaterThan(0);
    expect(assets[0].createdAt).toBeDefined();
    // Verify camelCase (not snake_case)
    expect(assets[0].mime_type).toBeUndefined();
  });
});

describe("GET /api/assets/:id — download", () => {
  it("returns file content with correct mime type", async () => {
    const content = "%PDF-1.4 test file content";
    const { headers, body } = multipartPayload("download.pdf", content, "application/pdf");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${userId}/assets`,
      headers,
      body,
    });
    const { id } = JSON.parse(uploadRes.body);

    const res = await app.inject({ method: "GET", url: `/api/assets/${id}` });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("download.pdf");
  });

  it("returns 404 for nonexistent asset", async () => {
    const res = await app.inject({ method: "GET", url: "/api/assets/fake-asset-id" });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/assets/:id", () => {
  it("deletes an existing asset", async () => {
    const { headers, body } = multipartPayload("delete-me.pdf", "%PDF", "application/pdf");
    const uploadRes = await app.inject({
      method: "POST",
      url: `/api/users/${userId}/assets`,
      headers,
      body,
    });
    const { id } = JSON.parse(uploadRes.body);

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/assets/${id}` });
    expect(deleteRes.statusCode).toBe(200);
    expect(JSON.parse(deleteRes.body).ok).toBe(true);

    // Verify it's gone
    const getRes = await app.inject({ method: "GET", url: `/api/assets/${id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it("returns 404 for nonexistent asset", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/assets/fake-id" });
    expect(res.statusCode).toBe(404);
  });
});
