import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const ACCOUNTS = [
  { role: "ADMIN", email: "admin@eduquantica.com", password: "Admin123!" },
  { role: "MANAGER", email: "manager@eduquantica.com", password: "Manager123!" },
  { role: "COUNSELLOR", email: "counsellor@eduquantica.com", password: "Counsellor123!" },
  { role: "SUB_AGENT", email: "agent@eduquantica.com", password: "Agent123!" },
  { role: "STUDENT", email: "student@eduquantica.com", password: "Student123!" },
] as const;

async function detectBaseUrl() {
  const candidates = Array.from({ length: 11 }, (_, i) => `http://localhost:${3000 + i}`);

  for (const baseUrl of candidates) {
    try {
      const res = await fetch(`${baseUrl}/api/auth/csrf`, { method: "GET" });
      if (!res.ok) continue;
      const json = (await res.json()) as { csrfToken?: string };
      if (json.csrfToken) return baseUrl;
    } catch {
      // ignore and continue
    }
  }

  throw new Error("Could not find a running dev server on ports 3000-3010.");
}

function getCookieHeader(response: Response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .join("; ");
}

async function verifyLogin(baseUrl: string, email: string, password: string) {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`, { method: "GET" });
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = getCookieHeader(csrfRes);

  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email,
    password,
    callbackUrl: `${baseUrl}/dashboard`,
    json: "true",
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials?json=true`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: csrfCookie,
    },
    body,
    redirect: "manual",
  });

  const sessionCookie = loginRes.headers.get("set-cookie") ?? "";
  const hasSessionCookie = /next-auth\.session-token|__Secure-next-auth\.session-token/.test(sessionCookie);

  return loginRes.status < 400 && hasSessionCookie;
}

async function main() {
  const baseUrl = await detectBaseUrl();
  console.log(`Using dev server: ${baseUrl}`);

  let failed = 0;
  for (const account of ACCOUNTS) {
    const ok = await verifyLogin(baseUrl, account.email, account.password);
    console.log(`${ok ? "✅" : "❌"} ${account.role} | ${account.email}`);
    if (!ok) failed += 1;
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
