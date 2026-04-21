import crypto from "node:crypto";

function secret(): string {
  const s = process.env.SUBMISSIONS_PREPARE_SECRET;
  if (!s?.trim()) {
    throw new Error("Missing SUBMISSIONS_PREPARE_SECRET");
  }
  return s.trim();
}

export type SubmissionPreparePayload = {
  submissionId: string;
  email: string;
  title: string;
  description: string;
  photoCount: number;
  exp: number;
  artist?: string;
  year?: string;
  address?: string;
  category?: string;
  phone?: string;
  artworkUrl?: string;
};

function encodePayload(p: SubmissionPreparePayload): string {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

function optStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function decodePayload(raw: string): SubmissionPreparePayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (
      typeof parsed.submissionId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.photoCount !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    const out: SubmissionPreparePayload = {
      submissionId: parsed.submissionId,
      email: parsed.email,
      title: parsed.title,
      description: parsed.description,
      photoCount: parsed.photoCount,
      exp: parsed.exp,
      artist: optStr(parsed.artist),
      year: optStr(parsed.year),
      address: optStr(parsed.address),
      category: optStr(parsed.category),
      phone: optStr(parsed.phone),
      artworkUrl: optStr(parsed.artworkUrl),
    };
    return out;
  } catch {
    return null;
  }
}

export function signSubmissionPreparePayload(p: SubmissionPreparePayload): string {
  const body = encodePayload(p);
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySubmissionToken(token: string): SubmissionPreparePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const payload = decodePayload(body);
  if (!payload) return null;
  if (Date.now() > payload.exp) return null;
  return payload;
}
