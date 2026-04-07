import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function resolveSignedUrlPath(input: string) {
  return `/api/blob/signed-url?url=${encodeURIComponent(input)}`;
}

async function resolveSignedUrl(url: string, download: boolean) {
  const blobMeta = await head(url, {
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const signedUrl = blobMeta.downloadUrl || url;
  if (!download) return signedUrl;

  const separator = signedUrl.includes("?") ? "&" : "?";
  return `${signedUrl}${separator}download=1`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is missing" }, { status: 500 });
  }

  const parsed = new URL(req.url);
  const url = String(parsed.searchParams.get("url") || "").trim();
  const download = parsed.searchParams.get("download") === "1";

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  try {
    const signedUrl = await resolveSignedUrl(url, download);
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    console.error("[/api/blob/signed-url GET]", {
      error: error instanceof Error ? error.message : String(error),
      sourceUrl: url,
    });
    return NextResponse.json({ error: "Could not generate signed URL" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN is missing" }, { status: 500 });
  }

  const payload = (await req.json().catch(() => ({}))) as { url?: string };
  const url = String(payload.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  try {
    const signedUrl = await resolveSignedUrl(url, false);
    return NextResponse.json({ signedUrl, path: resolveSignedUrlPath(url) });
  } catch (error) {
    console.error("[/api/blob/signed-url POST]", {
      error: error instanceof Error ? error.message : String(error),
      sourceUrl: url,
    });
    return NextResponse.json({ error: "Could not generate signed URL" }, { status: 500 });
  }
}
