import { env } from "@/lib/env";
import type { SheetPatch } from "@/lib/google-sheets-write";

/**
 * Forwards an update to a Google Apps Script Web App (doPost).
 * Contract (recommended for your script):
 * - POST JSON body: `{ slug, patch, token }` where `token` must match `SHEET_EDIT_API_TOKEN`
 *   (the server injects `token`; callers to Next never send it.)
 * - Script returns JSON like `{ ok: true }` or `{ ok: false, error: "..." }`.
 */
export async function forwardSheetEditToAppsScript(
  slug: string,
  patch: SheetPatch,
): Promise<{ status: number; body: unknown }> {
  const url = env.SHEET_EDIT_API_URL().trim();
  const apiToken = env.SHEET_EDIT_API_TOKEN().trim();
  if (!url || !apiToken) {
    throw new Error("SHEET_EDIT_API_URL / SHEET_EDIT_API_TOKEN not configured.");
  }

  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      patch,
      token: apiToken,
    }),
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: res.status, body };
}
