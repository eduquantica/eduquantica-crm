/**
 * Tell the public website (www.eduquantica.com) that courses, universities or
 * scholarships changed, so its course and scholarship search refresh at once.
 * Website side: app/api/revalidate/crm. Without this call (or if it fails) the
 * website still refreshes on its own within 10 minutes.
 *
 * Env: WEBSITE_REVALIDATE_URL, WEBSITE_REVALIDATE_SECRET (same value as the
 * website's CRM_REVALIDATE_SECRET). If either is missing, nothing is sent.
 */
export async function notifyWebsite(reason: string): Promise<void> {
  const url = process.env.WEBSITE_REVALIDATE_URL;
  const secret = process.env.WEBSITE_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) console.error("[website-revalidate]", reason, response.status);
  } catch (error) {
    // Never block a CRM save because the website is slow or down.
    console.error("[website-revalidate]", reason, error);
  }
}
