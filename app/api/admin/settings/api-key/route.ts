import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

async function ensureEnvKey(key: string) {
  // update .env.local or .env with the new API_KEY value
  const envFile = path.resolve(process.cwd(), ".env.local");
  let content = "";
  try {
    content = fs.readFileSync(envFile, "utf-8");
  } catch {
    // if .env.local doesn't exist, try .env
    try {
      const envFile2 = path.resolve(process.cwd(), ".env");
      content = fs.readFileSync(envFile2, "utf-8");
    } catch {
      // no file found; we'll create .env.local
      content = "";
    }
  }

  const lines = content.split(/\r?\n/);
  const keyLine = lines.findIndex((l) => l.startsWith("API_KEY="));
  const newLine = `API_KEY=${key}`;
  if (keyLine >= 0) {
    lines[keyLine] = newLine;
  } else {
    lines.push(newLine);
  }
  try {
    fs.writeFileSync(envFile, lines.join("\n"), "utf-8");
  } catch (err) {
    console.warn("Could not write .env.local, make sure to update API_KEY manually", err);
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  return NextResponse.json({ apiKey: process.env.API_KEY || null });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.roleName !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const newKey = randomBytes(32).toString("hex");
  process.env.API_KEY = newKey;
  await ensureEnvKey(newKey);
  return NextResponse.json({ apiKey: newKey });
}
