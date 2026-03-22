export function normalizeUrlText(raw: string | null | undefined) {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}

export async function fetchAndExtractUrlText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "EduQuanticaCRM-MockInterviewBot/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status})`);
  }

  const html = await response.text();
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 25000);
}

export function extractOfferLetterFacts(text: string) {
  const input = text || "";

  const university = input.match(/(?:university|institution)\s*[:\-]\s*([^\n\r,]+)/i)?.[1]?.trim() || null;
  const course = input.match(/(?:course|programme|program)\s*[:\-]\s*([^\n\r,]+)/i)?.[1]?.trim() || null;
  const duration = input.match(/(?:duration|course\s+length)\s*[:\-]\s*([^\n\r,]+)/i)?.[1]?.trim() || null;
  const tuitionFee = input.match(/(?:tuition\s*fee|fee)\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() || null;
  const startDate = input.match(/(?:start\s*date|commencement)\s*[:\-]\s*([^\n\r,]+)/i)?.[1]?.trim() || null;

  return {
    extractedUniversity: university,
    extractedCourse: course,
    extractedDuration: duration,
    extractedTuitionFee: tuitionFee,
    extractedStartDate: startDate,
  };
}
