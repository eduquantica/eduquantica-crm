// No Node-only imports here: lib/transcript-ocr.ts imports this and is also used by client components.

export function isVercelBlobHost(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// Private blobs return 403 without the token, so server-side reads of stored files go through here.
// The token is only ever attached for Vercel Blob hosts.
export function fetchStoredFile(url: string, init: RequestInit = {}) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !isVercelBlobHost(url)) return fetch(url, init);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
