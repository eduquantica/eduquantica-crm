import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

// Vercel's filesystem is read-only, so server-side uploads must go to Vercel Blob.
// Files are private; serve them through toApiFilesPath() (lib/file-url.ts).

function safeBlobName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "upload";
}

export async function storeBlobFile(
  body: Blob | Buffer,
  fileName: string,
  contentType = "application/octet-stream",
  folder?: string,
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is missing");

  const key = `${Date.now()}-${randomUUID()}-${safeBlobName(fileName)}`;
  const blob = await put(folder ? `${folder}/${key}` : key, body, {
    access: "private",
    contentType,
    token,
  });
  return blob.url;
}
