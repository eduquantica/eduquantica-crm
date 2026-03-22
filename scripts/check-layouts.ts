import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

type CheckResult = {
  ok: boolean;
  errors: string[];
};

async function exists(relativePath: string) {
  try {
    await fs.access(path.join(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath: string) {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

async function collectFiles(dir: string, matcher: (file: string) => boolean, out: string[] = []) {
  const entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true });
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(rel, matcher, out);
      continue;
    }
    if (matcher(rel)) out.push(rel);
  }
  return out;
}

function countOccurrences(haystack: string, needle: string) {
  const matches = haystack.match(new RegExp(needle, "g"));
  return matches ? matches.length : 0;
}

export async function runLayoutChecks(): Promise<CheckResult> {
  const errors: string[] = [];

  const requiredLayouts = [
    "app/dashboard/layout.tsx",
    "app/agent/layout.tsx",
    "app/student/layout.tsx",
  ];

  for (const rel of requiredLayouts) {
    if (!(await exists(rel))) {
      errors.push(`Missing required layout file: ${rel}`);
    }
  }

  if (await exists("app/dashboard/DashboardPortalShell.tsx")) {
    const shell = await read("app/dashboard/DashboardPortalShell.tsx");
    const sidebarCount = countOccurrences(shell, "<DashboardSidebar");
    if (sidebarCount !== 1) {
      errors.push("Dashboard shell must render exactly one DashboardSidebar.");
    }
  } else {
    errors.push("Missing dashboard shell file: app/dashboard/DashboardPortalShell.tsx");
  }

  if (await exists("app/agent/AgentPortalShell.tsx")) {
    const shell = await read("app/agent/AgentPortalShell.tsx");
    const sidebarCount = countOccurrences(shell, "<AgentSidebar");
    if (sidebarCount !== 1) {
      errors.push("Agent shell must render exactly one AgentSidebar.");
    }
  } else {
    errors.push("Missing agent shell file: app/agent/AgentPortalShell.tsx");
  }

  if (await exists("app/student/layout.tsx")) {
    const layout = await read("app/student/layout.tsx");
    const shellCount = countOccurrences(layout, "<StudentPortalShell");
    if (shellCount !== 1) {
      errors.push("Student layout must render exactly one StudentPortalShell.");
    }
  }

  const layoutFiles = await collectFiles("app", (file) => file.endsWith("layout.tsx"));
  for (const rel of layoutFiles) {
    const content = await read(rel);
    if (/from\s+["'][^"']*layout["']/.test(content)) {
      errors.push(`Layout file imports another layout file: ${rel}`);
    }
  }

  const pageFiles = await collectFiles("app", (file) => file.endsWith("page.tsx"));
  for (const rel of pageFiles) {
    const content = await read(rel);
    if (/from\s+["'][^"']*(Sidebar|StudentPortalShell|DashboardPortalShell|AgentPortalShell)["']/.test(content)) {
      errors.push(`Page file imports a layout/sidebar shell directly: ${rel}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

async function main() {
  const result = await runLayoutChecks();

  if (!result.ok) {
    console.error("❌ Layout integrity check failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("✅ Layout integrity check passed");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Layout integrity check crashed:", error);
    process.exit(1);
  });
}
