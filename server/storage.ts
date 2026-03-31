import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

type StorageResult = { key: string; url: string };
type StorageProvider = "local" | "s3" | "supabase";

const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), ".local-storage");
const LOCAL_PUBLIC_PREFIX = "/uploads";

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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: getSupabaseAuthKey(),
      Authorization: `Bearer ${getSupabaseAuthKey()}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: toBuffer(data),
  });

  if (!response.ok) {
    throw new Error(
      `${await parseSupabaseError(response)} (Supabase bucket: ${getSupabaseBucket()})`
    );
  }

  return {
    key,
    url: buildSupabasePublicUrl(key),
  };
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
