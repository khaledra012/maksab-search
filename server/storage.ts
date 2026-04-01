import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

type StorageResult = { key: string; url: string };
type StorageProvider = "local" | "s3" | "supabase";

const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), ".local-storage");
const LOCAL_PUBLIC_PREFIX = "/uploads";
const SUPABASE_UPLOAD_TIMEOUT_MS = 60_000;
const SUPABASE_UPLOAD_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\\/g, "/");
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function ensureUrlBase(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function encodeStoragePath(pathValue: string): string {
  return normalizeKey(pathValue)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toBuffer(data: Buffer | Uint8Array | string): Buffer {
  if (typeof data === "string") {
    return Buffer.from(data);
  }

  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

function hasSupabaseConfig(): boolean {
  return Boolean(
    ENV.supabaseUrl &&
      (ENV.supabaseServiceRoleKey || ENV.supabasePublishableKey)
  );
}

function hasS3Config(): boolean {
  return Boolean(
    ENV.s3AccessKeyId &&
      ENV.s3SecretAccessKey &&
      ENV.s3Bucket &&
      ENV.s3Region
  );
}

function getStorageProvider(): StorageProvider {
  if (hasSupabaseConfig()) {
    return "supabase";
  }

  if (hasS3Config()) {
    return "s3";
  }

  return "local";
}

function buildLocalPublicUrl(key: string): string {
  const normalizedKey = normalizeKey(key);
  if (ENV.publicStorageBaseUrl) {
    return new URL(
      normalizedKey,
      ensureTrailingSlash(ensureUrlBase(ENV.publicStorageBaseUrl))
    ).toString();
  }

  if (ENV.appUrl) {
    return new URL(
      normalizedKey,
      ensureTrailingSlash(
        new URL(LOCAL_PUBLIC_PREFIX, ensureUrlBase(ENV.appUrl)).toString()
      )
    ).toString();
  }

  return `${LOCAL_PUBLIC_PREFIX}/${normalizedKey}`;
}

function buildS3PublicUrl(key: string): string {
  const normalizedKey = normalizeKey(key);

  if (ENV.publicStorageBaseUrl) {
    return new URL(
      normalizedKey,
      ensureTrailingSlash(ensureUrlBase(ENV.publicStorageBaseUrl))
    ).toString();
  }

  throw new Error(
    "S3 storage requires PUBLIC_STORAGE_BASE_URL so uploaded files have a stable public URL"
  );
}

function getSupabaseBucket(): string {
  return ENV.supabaseStorageBucket || "uploads";
}

function getSupabaseAuthKey(): string {
  return ENV.supabaseServiceRoleKey || ENV.supabasePublishableKey;
}

function buildSupabasePublicUrl(key: string): string {
  const bucket = encodeURIComponent(getSupabaseBucket());
  const encodedKey = encodeStoragePath(key);

  if (ENV.publicStorageBaseUrl) {
    return new URL(
      encodedKey,
      ensureTrailingSlash(ensureUrlBase(ENV.publicStorageBaseUrl))
    ).toString();
  }

  return new URL(
    `/storage/v1/object/public/${bucket}/${encodedKey}`,
    ensureUrlBase(ENV.supabaseUrl)
  ).toString();
}

function getS3Client(): S3Client {
  if (!hasS3Config()) {
    throw new Error(
      "S3 storage requires S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, and S3_REGION"
    );
  }

  const endpoint = ENV.s3Endpoint
    ? ensureUrlBase(ENV.s3Endpoint).replace(/\/+$/, "")
    : undefined;

  return new S3Client({
    region: ENV.s3Region,
    endpoint,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
}

async function parseSupabaseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === "object") {
    const message =
      (payload as { message?: string }).message ||
      (payload as { error?: string }).error;
    if (message) {
      return message;
    }
  }

  return `Supabase storage request failed with status ${response.status}`;
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const directCode =
    "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;

  if (directCode) {
    return directCode;
  }

  const cause =
    "cause" in error ? (error as { cause?: unknown }).cause : undefined;

  return cause && cause !== error ? getErrorCode(cause) : undefined;
}

function isRetryableSupabaseError(error: unknown): boolean {
  const code = getErrorCode(error);

  return [
    "UND_ERR_HEADERS_TIMEOUT",
    "ETIMEDOUT",
    "ECONNRESET",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNREFUSED",
    "UND_ERR_CONNECT_TIMEOUT",
  ].includes(code || "");
}

async function localPut(
  relKey: string,
  data: Buffer | Uint8Array | string
): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  const fullPath = path.join(LOCAL_STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, toBuffer(data));

  return {
    key,
    url: buildLocalPublicUrl(key),
  };
}

async function localGet(relKey: string): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  const fullPath = path.join(LOCAL_STORAGE_ROOT, key);
  await fs.access(fullPath);

  return {
    key,
    url: buildLocalPublicUrl(key),
  };
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: toBuffer(data),
      ContentType: contentType,
    })
  );

  return {
    key,
    url: buildS3PublicUrl(key),
  };
}

async function s3Get(relKey: string): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  const client = getS3Client();

  const url = ENV.publicStorageBaseUrl
    ? buildS3PublicUrl(key)
    : await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: ENV.s3Bucket,
          Key: key,
        }),
        { expiresIn: 3600 }
      );

  return { key, url };
}

async function supabasePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  const bucket = encodeURIComponent(getSupabaseBucket());
  const encodedKey = encodeStoragePath(key);
  const endpoint = new URL(
    `/storage/v1/object/${bucket}/${encodedKey}`,
    ensureUrlBase(ENV.supabaseUrl)
  ).toString();

  const body = toBuffer(data);
  let lastError: unknown;

  for (let attempt = 1; attempt <= SUPABASE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: getSupabaseAuthKey(),
          Authorization: `Bearer ${getSupabaseAuthKey()}`,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body,
        signal: AbortSignal.timeout(SUPABASE_UPLOAD_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorMessage =
          `${await parseSupabaseError(response)} (Supabase bucket: ${getSupabaseBucket()})`;

        if (
          attempt < SUPABASE_UPLOAD_MAX_ATTEMPTS &&
          [408, 429].includes(response.status)
        ) {
          lastError = new Error(errorMessage);
          await sleep(attempt * 1_000);
          continue;
        }

        if (
          attempt < SUPABASE_UPLOAD_MAX_ATTEMPTS &&
          response.status >= 500
        ) {
          lastError = new Error(errorMessage);
          await sleep(attempt * 1_000);
          continue;
        }

        throw new Error(errorMessage);
      }

      return {
        key,
        url: buildSupabasePublicUrl(key),
      };
    } catch (error) {
      lastError = error;

      if (
        attempt < SUPABASE_UPLOAD_MAX_ATTEMPTS &&
        isRetryableSupabaseError(error)
      ) {
        await sleep(attempt * 1_000);
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Supabase upload failed after multiple attempts");
}

async function supabaseGet(relKey: string): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  return {
    key,
    url: buildSupabasePublicUrl(key),
  };
}

export function getLocalStoragePublicDir(): string {
  return LOCAL_STORAGE_ROOT;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<StorageResult> {
  const provider = getStorageProvider();

  if (provider === "supabase") {
    return supabasePut(relKey, data, contentType);
  }

  if (provider === "s3") {
    return s3Put(relKey, data, contentType);
  }

  return localPut(relKey, data);
}

export async function storageGet(relKey: string): Promise<StorageResult> {
  const provider = getStorageProvider();

  if (provider === "supabase") {
    return supabaseGet(relKey);
  }

  if (provider === "s3") {
    return s3Get(relKey);
  }

  return localGet(relKey);
}
