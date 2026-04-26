/**
 * Cloudflare R2 storage adapter.
 *
 * R2 is S3-compatible, so we drive it with @aws-sdk/client-s3 pointed at the
 * R2 endpoint. Credentials and bucket are R2-only — AWS is never contacted.
 *
 * Initialization is lazy: the S3 client is built on the first put/get/delete
 * call. server.ts asserts isR2Configured() in production at boot, so a
 * misconfigured prod deploy fails loudly before any request is served.
 */

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
