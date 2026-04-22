import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "admin_session";

async function signingKeyUtf8(secret: string): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return new Uint8Array(buf);
}

/** Creates an HS256 JWT (8h) keyed by SHA-256(ADMIN_PASSWORD). */
export async function createAdminSessionJwt(): Promise<string> {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (!pw) throw new Error("ADMIN_PASSWORD not set");
  const key = await signingKeyUtf8(pw);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(key);
}

export async function verifyAdminSessionJwt(token: string | undefined): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  if (!pw || !token?.trim()) return false;
  try {
    const key = await signingKeyUtf8(pw);
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}
