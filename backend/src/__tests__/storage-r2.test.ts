/**
 * R2 storage adapter unit tests.
 *
 * The S3 client is replaced via __setHandleForTesting() with an in-memory
 * stub so the suite never opens a real network connection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __setHandleForTesting,
  buildAssetKey,
  deleteObject,
  getObject,
  inferExtensionFromFile,
  isR2Configured,
  putObject,
} from "../storage/r2.js";

interface StubbedSend {
  send: ReturnType<typeof vi.fn>;
}

function createStubClient(): StubbedSend {
  return { send: vi.fn() };
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  __setHandleForTesting(null);
  process.env = { ...ORIGINAL_ENV };
});

describe("isR2Configured", () => {
  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
  });

  it("returns false when any of the four env vars is missing", () => {
    expect(isR2Configured()).toBe(false);

    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    expect(isR2Configured()).toBe(false);
  });

  it("returns true when the four R2 env vars are present", () => {
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET_NAME = "astral-assets";
    expect(isR2Configured()).toBe(true);
  });
});

describe("buildAssetKey", () => {
  it("composes a stable per-user prefix and respects the leading dot in the extension", () => {
    expect(buildAssetKey("user-123", "asset-abc", ".pdf")).toBe(
      "users/user-123/assets/asset-abc.pdf",
    );
    expect(buildAssetKey("user-123", "asset-abc", "pdf")).toBe(
      "users/user-123/assets/asset-abc.pdf",
    );
  });
});

describe("inferExtensionFromFile", () => {
  it("prefers the extension already present in the filename", () => {
    expect(inferExtensionFromFile("chart.pdf", "application/pdf")).toBe(".pdf");
    expect(inferExtensionFromFile("photo.jpeg", "image/jpeg")).toBe(".jpeg");
  });

  it("falls back to the mime type when the filename has no extension", () => {
    expect(inferExtensionFromFile("noext", "application/pdf")).toBe(".pdf");
    expect(inferExtensionFromFile("noext", "image/png")).toBe(".png");
    expect(inferExtensionFromFile("noext", "image/jpeg")).toBe(".jpg");
    expect(inferExtensionFromFile("noext", "text/plain")).toBe(".txt");
  });

  it("returns an empty string for unknown mime types and no filename extension", () => {
    expect(inferExtensionFromFile("noext", "application/x-unknown")).toBe("");
  });
});

describe("putObject / getObject / deleteObject", () => {
  it("forwards a PutObject command with the configured bucket and the input metadata", async () => {
    const stub = createStubClient();
    __setHandleForTesting({ client: stub, bucket: "astral-assets" });

    await putObject({
      key: "users/u1/assets/a1.pdf",
      body: Buffer.from("hello world"),
      contentType: "application/pdf",
    });

    expect(stub.send).toHaveBeenCalledTimes(1);
    const command = stub.send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "astral-assets",
      Key: "users/u1/assets/a1.pdf",
      ContentType: "application/pdf",
    });
  });

  it("re-assembles the streamed Body returned by GetObject into a Buffer", async () => {
    const stub = createStubClient();
    stub.send.mockResolvedValueOnce({
      Body: (async function* () {
        yield new Uint8Array([0x68, 0x65, 0x6c]); // "hel"
        yield new Uint8Array([0x6c, 0x6f]); // "lo"
      })(),
    });
    __setHandleForTesting({ client: stub, bucket: "astral-assets" });

    const buffer = await getObject("users/u1/assets/a1.pdf");

    expect(buffer.toString("utf8")).toBe("hello");
  });

  it("issues a DeleteObject command for the provided key", async () => {
    const stub = createStubClient();
    __setHandleForTesting({ client: stub, bucket: "astral-assets" });

    await deleteObject("users/u1/assets/a1.pdf");

    expect(stub.send).toHaveBeenCalledTimes(1);
    const command = stub.send.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Bucket: "astral-assets",
      Key: "users/u1/assets/a1.pdf",
    });
  });
});
