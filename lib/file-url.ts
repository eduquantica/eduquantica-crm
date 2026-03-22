function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePathSegments(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function toApiFilesPath(inputUrl: string | null | undefined): string {
  const source = String(inputUrl || "").trim();
  if (!source) return "";

  let pathname = source;
  let search = "";

  if (source.startsWith("http://") || source.startsWith("https://")) {
    try {
      const parsed = new URL(source);
      pathname = parsed.pathname;
      search = parsed.search;
    } catch {
      pathname = source;
    }
  } else {
    const queryIndex = source.indexOf("?");
    if (queryIndex >= 0) {
      pathname = source.slice(0, queryIndex);
      search = source.slice(queryIndex);
    }
  }

  const normalized = pathname.replace(/\\/g, "/");

  if (normalized.startsWith("/api/files/")) {
    return `${normalized}${search}`;
  }

  if (normalized.startsWith("/api/student/files/raw/")) {
    const key = safeDecode(normalized.slice("/api/student/files/raw/".length));
    return `/api/files/${encodePathSegments(key)}${search}`;
  }

  return source;
}

export function toApiFilesDownloadPath(inputUrl: string | null | undefined): string {
  const resolved = toApiFilesPath(inputUrl);
  if (!resolved) return "";
  if (!resolved.startsWith("/api/files/")) return resolved;
  return resolved.includes("?") ? `${resolved}&download=1` : `${resolved}?download=1`;
}
