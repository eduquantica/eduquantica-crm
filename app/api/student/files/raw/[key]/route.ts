import { NextRequest, NextResponse } from "next/server";
import { detectMimeType, readUploadByKey } from "@/lib/local-upload";

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } },
) {
  try {
    const decodedKey = decodeURIComponent(params.key);
    const { bytes, key } = await readUploadByKey(decodedKey);
    const mime = detectMimeType(key);
    const download = req.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${key}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
