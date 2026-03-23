import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureTestAccountsExist } from "@/lib/test-accounts";

interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: "ok" | "error";
      message?: string;
    };
    admin: {
      status: "ok" | "error";
      message?: string;
    };
    environment: {
      status: "ok" | "degraded";
      missing?: string[];
    };
  };
  version: string;
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  const startTime = Date.now();
  const checks: HealthCheckResponse["checks"] = {
    database: { status: "error" },
    admin: { status: "error" },
    environment: { status: "ok" },
  };

  let overallStatus: "ok" | "degraded" | "error" = "ok";

  // 1. Check Database Connection
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database.status = "ok";
  } catch (error) {
    checks.database.status = "error";
    checks.database.message =
      error instanceof Error ? error.message : "Connection failed";
    overallStatus = "error";
  }

  // 2. Check Admin Account
  if (checks.database.status === "ok") {
    try {
      let adminExists = Boolean(
        await db.user.findUnique({
          where: { email: "admin@eduquantica.com" },
          select: { id: true },
        }),
      );

      if (!adminExists) {
        try {
          await ensureTestAccountsExist();
          adminExists = Boolean(
            await db.user.findUnique({
              where: { email: "admin@eduquantica.com" },
              select: { id: true },
            }),
          );
        } catch (seedError) {
          checks.admin.message =
            seedError instanceof Error ? seedError.message : "Seed failed";
        }
      }

      checks.admin.status = adminExists ? "ok" : "error";
      if (!adminExists) {
        checks.admin.message = "Admin account not found";
        overallStatus = "degraded";
      }
    } catch (error) {
      checks.admin.status = "error";
      checks.admin.message =
        error instanceof Error ? error.message : "Query failed";
      overallStatus = "degraded";
    }
  } else {
    checks.admin.message = "Skipped - database connection failed";
  }

  // 3. Check Environment Variables
  const requiredEnvVars = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ];
  const optionalEnvVars = [
    "RESEND_API_KEY",
    "UPLOADTHING_TOKEN",
    "MINDEE_API_KEY",
  ];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingRequired.push(envVar);
    }
  }

  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      missingOptional.push(envVar);
    }
  }

  if (missingRequired.length > 0) {
    checks.environment.status = "degraded";
    checks.environment.missing = missingRequired;
    overallStatus = "error";
  } else if (missingOptional.length > 0) {
    checks.environment.status = "degraded";
    checks.environment.missing = missingOptional;
    if (overallStatus === "ok") {
      overallStatus = "degraded";
    }
  }

  const responseTime = Date.now() - startTime;
  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp,
    uptime,
    checks,
    version: process.env.npm_package_version || "unknown",
  };

  // Return appropriate status code
  const statusCode =
    overallStatus === "ok" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      "X-Response-Time": `${responseTime}ms`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
