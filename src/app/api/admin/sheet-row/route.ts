import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  PATCH_FIELD_ALIASES,
  type PatchFieldKey,
} from "@/lib/sheet-header-match";
import {
  type SheetPatch,
  updateArtworkRowBySlug,
} from "@/lib/google-sheets-write";
import { forwardSheetEditToAppsScript } from "@/lib/sheet-edit-proxy";

export const runtime = "nodejs";

const bodySchema = z.object({
  slug: z.string().trim().min(1),
  patch: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false as const, error: message }, { status });
}

function toSheetPatch(raw: Record<string, unknown>): SheetPatch {
  const allowed = new Set(Object.keys(PATCH_FIELD_ALIASES)) as Set<string>;
  const out: SheetPatch = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!allowed.has(k)) continue;
    if (v === undefined) continue;
    if (v === null) {
      out[k as PatchFieldKey] = null;
      continue;
    }
    if (typeof v === "string" || typeof v === "number") {
      out[k as PatchFieldKey] = v;
    }
  }
  return out;
}

export async function POST(request: Request) {
  const adminSecret = env.ADMIN_SHEET_SECRET().trim();
  if (!adminSecret) {
    return jsonError(
      "Admin sheet updates require ADMIN_SHEET_SECRET (Bearer or x-admin-sheet-secret).",
      503,
    );
  }

  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-admin-sheet-secret")?.trim();
  const incoming = bearer || headerSecret || "";

  if (incoming !== adminSecret) {
    return jsonError("Unauthorized.", 401);
  }

  const appsScript =
    Boolean(env.SHEET_EDIT_API_URL().trim()) &&
    Boolean(env.SHEET_EDIT_API_TOKEN().trim());
  const directSheets =
    Boolean(env.SHEET_ID().trim()) &&
    Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON().trim());

  if (!appsScript && !directSheets) {
    return jsonError(
      "Sheet updates not configured: set SHEET_EDIT_API_URL + SHEET_EDIT_API_TOKEN, or SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON.",
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid body: need { slug, patch }.", 400);
  }

  const patch = toSheetPatch(parsed.data.patch);
  if (Object.keys(patch).length === 0) {
    return jsonError("patch must include at least one known field to update.", 400);
  }

  const slug = parsed.data.slug;

  try {
    if (appsScript) {
      const { status, body: upstream } = await forwardSheetEditToAppsScript(
        slug,
        patch,
      );
      if (status >= 400) {
        const msg =
          typeof upstream === "object" &&
          upstream !== null &&
          "error" in upstream &&
          typeof (upstream as { error?: unknown }).error === "string"
            ? (upstream as { error: string }).error
            : `Apps Script returned HTTP ${status}.`;
        return jsonError(msg, status >= 500 ? 502 : status);
      }

      const up = upstream as { ok?: boolean; error?: string };
      if (typeof up === "object" && up !== null && up.ok === false) {
        return jsonError(up.error ?? "Apps Script rejected the update.", 400);
      }
      revalidatePath("/");
      revalidatePath("/art");
      return Response.json({
        ok: true as const,
        slug,
        via: "apps_script" as const,
        upstream,
      });
    }

    const result = await updateArtworkRowBySlug(slug, patch);
    revalidatePath("/");
    revalidatePath("/art");
    return Response.json({
      ok: true as const,
      slug,
      via: "google_sheets_api" as const,
      rowNumber: result.rowNumber,
      updatedFields: result.updatedFields,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed.";
    return jsonError(msg, 400);
  }
}
