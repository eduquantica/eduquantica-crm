import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const URL_PREFIX = "/api/files/";
const LEGACY_URL_PREFIX = "/api/student/files/raw/";

function safeFileName(name: string) {
  const normalized = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "file";
}

export function isLocalUploadUrl(url: string) {
  return url.startsWith(URL_PREFIX) || url.startsWith(LEGACY_URL_PREFIX);
}

export function localUploadKeyFromUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (trimmed.startsWith(URL_PREFIX)) {
    const key = trimmed.slice(URL_PREFIX.length);
    return key || null;
  }

  if (trimmed.startsWith(LEGACY_URL_PREFIX)) {
    const key = trimmed.slice(LEGACY_URL_PREFIX.length);
    return key || null;
  }

  return null;
}

export async function storeUpload(file: File): Promise<{ key: string; fileName: string }> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  const ext = path.extname(file.name || "") || "";
  const stem = safeFileName(path.basename(file.name || "upload", ext));
  const key = `${Date.now()}-${randomUUID()}-${stem}${ext}`;
  const outputPath = path.join(STORAGE_ROOT, key);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, bytes);

  return {
    key,
    fileName: file.name || `${stem}${ext}`,
  };
}

export function getLocalUploadPath(key: string) {
  return `${URL_PREFIX}${encodeURIComponent(key)}`;
}

export async function readUploadByKey(key: string) {
  const cleanKey = path.basename(decodeURIComponent(key));
  const fullPath = path.join(STORAGE_ROOT, cleanKey);
  const bytes = await readFile(fullPath);
  return { key: cleanKey, bytes };
}

export async function removeUploadByUrl(url: string) {
  const key = localUploadKeyFromUrl(url);
  if (!key) return;

  try {
    const cleanKey = path.basename(decodeURIComponent(key));
    const fullPath = path.join(STORAGE_ROOT, cleanKey);
    await unlink(fullPath);
  } catch {
    // Ignore missing files on delete.
  }
}

export function detectMimeType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".heic") return "image/heic";
  return "application/octet-stream";
}
