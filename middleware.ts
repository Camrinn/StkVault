import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "sv_auth";
const AUTH_TOKEN = "stkvault_ok";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/predictions"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets, public paths, and cron routes
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/cron")
  ) {
    return NextResponse.next({ request });
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token !== AUTH_TOKEN) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
