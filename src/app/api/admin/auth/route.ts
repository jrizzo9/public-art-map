import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, createAdminSessionJwt } from "@/lib/admin-session";

export const runtime = "nodejs";

function comparePassword(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const configured = process.env.ADMIN_PASSWORD?.trim();
  if (!configured) {
    return Response.json({ ok: false as const, error: "ADMIN_PASSWORD not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false as const, error: "Expected JSON." }, { status: 400 });
  }

  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!comparePassword(password, configured)) {
    return Response.json({ ok: false as const, error: "Invalid password." }, { status: 401 });
  }

  let token: string;
  try {
    token = await createAdminSessionJwt();
  } catch {
    return Response.json({ ok: false as const, error: "Could not create session." }, { status: 500 });
  }

  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === "production",
  });
  return Response.json({ ok: true as const });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
  return Response.json({ ok: true as const });
}
