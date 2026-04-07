export async function getBlobUrl(privateUrl: string): Promise<string> {
  const value = String(privateUrl || "").trim();
  if (!value) return "";

  try {
    const res = await fetch("/api/blob/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url: value }),
    });
    const data = (await res.json().catch(() => ({}))) as { signedUrl?: string };
    return data.signedUrl || value;
  } catch {
    return value;
  }
}
