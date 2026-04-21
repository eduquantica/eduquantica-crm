import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new Response("Server configuration error", { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  const download = searchParams.get("download") === "1";

  if (!url || !url.startsWith("https://")) {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    // Private Vercel blobs require the token in the Authorization header
    const blobRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!blobRes.ok) {
      console.error("[/api/blob/proxy GET] blob fetch failed", {
        status: blobRes.status,
        url,
      });
      return new Response("Failed to fetch blob content", { status: blobRes.status });
    }

    const contentType = blobRes.headers.get("Content-Type") || "application/octet-stream";
    const rawName = url.split("/").pop()?.split("?")[0] || "document";
    const fileName = decodeURIComponent(rawName);
    const disposition = download
      ? `attachment; filename="${fileName}"`
      : `inline; filename="${fileName}"`;

    return new Response(blobRes.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[/api/blob/proxy GET]", {
      error: error instanceof Error ? error.message : String(error),
      sourceUrl: url,
    });
    return new Response("Failed to proxy blob", { status: 500 });
  }
}
