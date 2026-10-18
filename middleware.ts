import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ─── Route helpers ────────────────────────────────────────────────────────────

function isStaffRole(roleName: string): boolean {
  return roleName === "ADMIN" || roleName === "MANAGER" || roleName === "COUNSELLOR";
}

function isAgentRole(roleName: string): boolean {
  return roleName === "SUB_AGENT" || roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR";
}

function portalPath(roleName: string, subAgentApproved?: boolean): string {
  if (roleName === "STUDENT") return "/student/dashboard";
  if (roleName === "SUB_AGENT") return subAgentApproved ? "/agent/dashboard" : "/agent/pending";
  if (roleName === "BRANCH_MANAGER" || roleName === "SUB_AGENT_COUNSELLOR") return "/agent/dashboard";
  return "/dashboard";
}

// Website "Apply now" for a scholarship: /register?scholarship=<id>. The id rides in
// this cookie through sign-up or log-in, then the student lands on
// /student/scholarships?interest=<id> (see lib/scholarship-website.ts).
const SCHOLARSHIP_COOKIE = "eq_scholarship";
const SCHOLARSHIP_ID = /^[a-z0-9]{10,40}$/i;

function scholarshipInterestRedirect(request: NextRequest, scholarshipId: string) {
  const url = new URL("/student/scholarships", request.url);
  url.searchParams.set("interest", scholarshipId);
  const response = NextResponse.redirect(url);
  response.cookies.set(SCHOLARSHIP_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
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

  // Health check endpoints (no auth required)
  if (pathname === "/health") return NextResponse.next();
  if (pathname === "/api/health") return NextResponse.next();

  // Public APIs and token/header-protected endpoints that should bypass session auth
  if (pathname.startsWith("/api/public/")) return NextResponse.next();
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();
  if (pathname.startsWith("/api/mobile-upload/")) return NextResponse.next();
  if (pathname.startsWith("/api/events/rsvp/")) return NextResponse.next();
  if (pathname.startsWith("/api/webhooks/")) return NextResponse.next();

  // Mobile upload bridge pages are token-secured; do not require session auth
  if (pathname.startsWith("/upload/mobile/")) return NextResponse.next();
  if (pathname.startsWith("/mobile-upload/")) return NextResponse.next();
  if (pathname.startsWith("/events/rsvp/")) return NextResponse.next();

  // Public API routes (no login required)
  if (pathname === "/api/agent/apply") return NextResponse.next();
  if (pathname === "/api/agent/register") return NextResponse.next();
  if (pathname === "/api/auth/check-email") return NextResponse.next();
  if (pathname === "/api/auth/register-student") return NextResponse.next();
  if (pathname === "/api/auth/forgot-password") return NextResponse.next();
  if (pathname === "/api/auth/reset-password") return NextResponse.next();
  if (pathname === "/api/chat/session/create") return NextResponse.next();

  // ── /register ───────────────────────────────────────────────────────────────
  if (pathname === "/register") {
    const scholarshipId = request.nextUrl.searchParams.get("scholarship")?.trim() ?? "";
    if (SCHOLARSHIP_ID.test(scholarshipId)) {
      if (isAuthenticated && roleName === "STUDENT") {
        return scholarshipInterestRedirect(request, scholarshipId);
      }
      if (!isAuthenticated) {
        const response = NextResponse.next();
        response.cookies.set(SCHOLARSHIP_COOKIE, scholarshipId, {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
          sameSite: "lax",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
        });
        return response;
      }
    }
    // Logged-in users should not access register
    if (isAuthenticated && roleName) {
      return NextResponse.redirect(
        new URL(portalPath(roleName, subAgentApproved), request.url),
      );
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

  if (pathname === "/agent/register" || pathname === "/agent/register/success") {
    if (isAuthenticated && roleName === "SUB_AGENT") {
      return NextResponse.redirect(new URL("/agent/pending", request.url));
    }
    return NextResponse.next();
  }

  // ── /agent/pending ──────────────────────────────────────────────────────────
  if (pathname === "/agent/pending") {
    if (!isAuthenticated || (roleName !== "SUB_AGENT" && roleName !== "ADMIN")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (roleName === "ADMIN") {
      return NextResponse.next();
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
    if (pathname.startsWith("/student/courses")) {
      loginUrl.searchParams.set("message", "Please log in to search courses");
    }
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── /dashboard/* ─────────────────────────────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (pathname.startsWith("/dashboard/student-services/events")) {
      const canAccessEvents =
        isStaffRole(roleName!) ||
        roleName === "BRANCH_MANAGER" ||
        roleName === "SUB_AGENT_COUNSELLOR";
      if (!canAccessEvents) {
        return NextResponse.redirect(
          new URL(portalPath(roleName!, subAgentApproved), request.url),
        );
      }
      return NextResponse.next();
    }
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
    if (roleName === "ADMIN") {
      return NextResponse.next();
    }
    if (!isAgentRole(roleName!)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (roleName === "SUB_AGENT" && !subAgentApproved) {
      return NextResponse.redirect(new URL("/agent/pending", request.url));
    }
    return NextResponse.next();
  }

  // ── /student/* ───────────────────────────────────────────────────────────────
  if (pathname.startsWith("/student")) {
    if (roleName === "ADMIN") {
      return NextResponse.next();
    }
    if (roleName !== "STUDENT") {
      return NextResponse.redirect(
        new URL(portalPath(roleName!, subAgentApproved), request.url),
      );
    }
    // Scholarship chosen on the website before signing up / logging in
    const pendingScholarship = request.cookies.get(SCHOLARSHIP_COOKIE)?.value ?? "";
    if (SCHOLARSHIP_ID.test(pendingScholarship)) {
      if (pathname === "/student/scholarships" && request.nextUrl.searchParams.get("interest") === pendingScholarship) {
        const response = NextResponse.next();
        response.cookies.set(SCHOLARSHIP_COOKIE, "", { path: "/", maxAge: 0 });
        return response;
      }
      return scholarshipInterestRedirect(request, pendingScholarship);
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
