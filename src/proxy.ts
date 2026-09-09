import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

// /api/cron/recompute is NOT session-authenticated — it's called by an
// external scheduler (or nothing, in-process) and enforces its own
// CRON_SECRET check inside the route handler instead. See that route's
// doc comment.
const PUBLIC_PATHS = ["/login", "/signup", "/api/auth/login", "/api/auth/logout", "/api/auth/signup", "/api/cron/recompute"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/downloads/") ||
    pathname.startsWith("/.well-known/");

  if (isPublic) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
