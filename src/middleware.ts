import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionJwt,
} from "@/lib/admin-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminUi = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminUi && !isAdminApi) return NextResponse.next();

  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname === "/api/admin/auth") return NextResponse.next();

  if (!process.env.ADMIN_PASSWORD?.trim()) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { ok: false, error: "Admin password not configured." },
        { status: 503 },
      );
    }
    return new NextResponse("Admin password not configured.", { status: 503 });
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const ok = await verifyAdminSessionJwt(token);

  if (!ok) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.searchParams.set(
      "next",
      pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
