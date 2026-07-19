import { NextResponse, type NextRequest } from "next/server";
import { getPasswordAccessConfig, SESSION_COOKIE } from "@/lib/auth-config";
import { verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicRoute =
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/cron/notifications") ||
    pathname.startsWith("/auth/");
  if (publicRoute) return NextResponse.next();

  const config = getPasswordAccessConfig();
  if (!config) return NextResponse.next();

  const authenticated = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/login") {
    return authenticated
      ? NextResponse.redirect(new URL("/today", request.url))
      : NextResponse.next();
  }
  if (authenticated) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
