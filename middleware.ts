import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ─── Route helpers ────────────────────────────────────────────────────────────

function isStaffRole(roleName: string): boolean {
  // ADMIN, COUNSELLOR, MANAGER, or any custom (non-student, non-agent) role
  return roleName !== "STUDENT" && roleName !== "SUB_AGENT";
}

function portalPath(roleName: string, subAgentApproved?: boolean): string {
  if (roleName === "STUDENT") return "/student";
  if (roleName === "SUB_AGENT") return subAgentApproved ? "/agent" : "/agent/pending";
  return "/dashboard";
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = Boolean(token);
  const roleName = token?.roleName as string | undefined;
  const subAgentApproved = token?.subAgentApproved as boolean | undefined;

  // ── Fully public paths (no logic needed) ────────────────────────────────────
  // /api/auth/* is handled by NextAuth — never intercept
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  // ── /register ───────────────────────────────────────────────────────────────
  if (pathname === "/register") {
    // Logged-in student → redirect to portal
    if (isAuthenticated && roleName === "STUDENT") {
      return NextResponse.redirect(new URL("/student", request.url));
    }
    return NextResponse.next();
  }

  // ── /agent/apply ────────────────────────────────────────────────────────────
  if (pathname === "/agent/apply") {
    // Logged-in sub-agent → redirect to pending page
    if (isAuthenticated && roleName === "SUB_AGENT") {
      return NextResponse.redirect(new URL("/agent/pending", request.url));
    }
    return NextResponse.next();
  }

  // ── /agent/pending ──────────────────────────────────────────────────────────
  if (pathname === "/agent/pending") {
    if (!isAuthenticated || roleName !== "SUB_AGENT") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // ── /login, /forgot-password, /reset-password ───────────────────────────────
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  ) {
    if (isAuthenticated && roleName) {
      // Already signed in → redirect to their portal
      return NextResponse.redirect(
        new URL(portalPath(roleName, subAgentApproved), request.url),
      );
    }
    return NextResponse.next();
  }

  // ── All remaining routes require authentication ──────────────────────────────
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── /dashboard/* ─────────────────────────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!isStaffRole(roleName!)) {
      // Students and sub-agents don't belong in the dashboard
      return NextResponse.redirect(
        new URL(portalPath(roleName!, subAgentApproved), request.url),
      );
    }
    return NextResponse.next();
  }

  // ── /agent/* (approved agents only) ─────────────────────────────────────────
  if (pathname.startsWith("/agent")) {
    if (roleName !== "SUB_AGENT") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!subAgentApproved) {
      return NextResponse.redirect(new URL("/agent/pending", request.url));
    }
    return NextResponse.next();
  }

  // ── /student/* ───────────────────────────────────────────────────────────────
  if (pathname.startsWith("/student")) {
    if (roleName !== "STUDENT") {
      return NextResponse.redirect(
        new URL(portalPath(roleName!, subAgentApproved), request.url),
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

// ─── Matcher ─────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static  (Next.js static files)
     *  - _next/image   (Next.js image optimisation)
     *  - favicon.ico
     *  - public files (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|ico)).*)",
  ],
};
