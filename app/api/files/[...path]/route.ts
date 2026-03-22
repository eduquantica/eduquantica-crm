import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");
const STORAGE_UPLOADS_ROOT = path.resolve(process.cwd(), "storage", "uploads");
const PUBLIC_UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");

function mimeByExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  if (ext === ".gif") return "image/gif";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

function resolveCandidatePath(root: string, relativePath: string) {
  const fullPath = path.resolve(root, relativePath);
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  const rawPath = (params.path || []).join("/").trim();
  if (!rawPath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const decodedPath = rawPath
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .join("/");

  const storageCandidate = resolveCandidatePath(STORAGE_UPLOADS_ROOT, decodedPath);
  const storageRootCandidate = resolveCandidatePath(STORAGE_ROOT, decodedPath);
  const publicCandidate = resolveCandidatePath(PUBLIC_UPLOADS_ROOT, decodedPath);
  const candidates = [storageCandidate, storageRootCandidate, publicCandidate].filter((value): value is string => Boolean(value));

  console.info("[/api/files GET] requested:", decodedPath);

  for (const filePath of candidates) {
    try {
      console.info("[/api/files GET] attempting:", filePath);
      const fileBytes = await readFile(filePath);
      const mimeType = mimeByExtension(filePath);
      const fileName = path.basename(filePath);
      const download = new URL(request.url).searchParams.get("download") === "1";

      console.info("[/api/files GET] serving:", filePath, "as", mimeType);

      return new NextResponse(new Uint8Array(fileBytes), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename=\"${fileName}\"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    } catch {
      // Try next directory.
    }
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
