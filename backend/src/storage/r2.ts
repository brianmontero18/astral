/**
 * Asset storage adapter.
 *
 * Production uses Cloudflare R2. Local development can run without R2
 * credentials by writing objects to disk under ASSET_STORAGE_DIR.
 *
 * R2 initialization is lazy: the S3 client is built on the first put/get/delete
 * call. server.ts asserts isR2Configured() in production at boot.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

interface R2Handle {
  client: S3Client;
  bucket: string;
}

let cachedHandle: R2Handle | null = null;

function getLocalStorageRoot(): string {
  return path.resolve(process.env.ASSET_STORAGE_DIR?.trim() || ".local-assets");
}

function resolveLocalObjectPath(key: string): string {
  const root = getLocalStorageRoot();
  const objectPath = path.resolve(root, key);
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (objectPath !== root && !objectPath.startsWith(rootWithSeparator)) {
    throw new Error(`Invalid asset storage key: ${key}`);
  }

  return objectPath;
}

function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function isR2Configured(): boolean {
  return readR2Config() !== null;
}

function getHandle(): R2Handle {
  if (cachedHandle) {
    return cachedHandle;
  }

  const config = readR2Config();
  if (!config) {
    throw new Error("R2 not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME");
  }

  cachedHandle = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
    bucket: config.bucketName,
  };

  return cachedHandle;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export async function putObject(input: PutObjectInput): Promise<void> {
  if (!cachedHandle && !isR2Configured()) {
    const objectPath = resolveLocalObjectPath(input.key);
    await fs.mkdir(path.dirname(objectPath), { recursive: true });
    await fs.writeFile(objectPath, input.body);
    return;
  }

  const handle = getHandle();
  await handle.client.send(
    new PutObjectCommand({
      Bucket: handle.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

export async function getObject(key: string): Promise<Buffer> {
  if (!cachedHandle && !isR2Configured()) {
    return fs.readFile(resolveLocalObjectPath(key));
  }

  const handle = getHandle();
  const result = await handle.client.send(
    new GetObjectCommand({
      Bucket: handle.bucket,
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error(`R2 object body missing: ${key}`);
  }

  const chunks: Array<Buffer> = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  if (!cachedHandle && !isR2Configured()) {
    await fs.rm(resolveLocalObjectPath(key), { force: true });
    return;
  }

  const handle = getHandle();
  await handle.client.send(
    new DeleteObjectCommand({
      Bucket: handle.bucket,
      Key: key,
    }),
  );
}

export function buildAssetKey(userId: string, assetId: string, extension: string): string {
  const safeExt = extension.startsWith(".") ? extension : `.${extension}`;
  return `users/${userId}/assets/${assetId}${safeExt}`;
}

export function inferExtensionFromFile(filename: string, mimeType: string): string {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx > 0 && dotIdx < filename.length - 1) {
    return filename.slice(dotIdx);
  }

  switch (mimeType) {
    case "application/pdf":
      return ".pdf";
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "text/plain":
      return ".txt";
    default:
      return "";
  }
}

interface SendableClient {
  send: (command: unknown) => Promise<unknown>;
}

/**
 * Test seam: lets the test suite inject a stubbed S3Client (any object that
 * implements `send`) without touching env vars. Pass null to clear.
 */
export function __setHandleForTesting(
  handle: { client: SendableClient; bucket: string } | null,
): void {
  cachedHandle = handle as R2Handle | null;
}
