import { z } from "zod";
import {
  appendSubmissionBundleRow,
  isSubmissionSheetAppendConfigured,
} from "@/lib/google-sheets-submissions";
import { verifySubmissionToken } from "@/lib/submission-token";
import type { SubmissionBundleMetadata } from "@/lib/submissions-types";
import { submissionFolderFor } from "@/lib/submissions-admin";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

const finalizeSchema = z.object({
  token: z.string().min(1),
  uploads: z
    .array(
      z.object({
        public_id: z.string(),
        secure_url: z.string().url(),
        width: z.number().optional(),
        height: z.number().optional(),
        bytes: z.number().optional(),
        format: z.string().optional(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  if (!process.env.SUBMISSIONS_PREPARE_SECRET?.trim()) {
    return jsonError(
      "Submissions are not enabled (set SUBMISSIONS_PREPARE_SECRET).",
      503,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected JSON", 400);
  }

  const parsed = finalizeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid upload payload.", 400);
  }

  const payload = verifySubmissionToken(parsed.data.token);
  if (!payload) {
    return jsonError("This submission session expired. Please start again.", 400);
  }

  const { uploads } = parsed.data;
  if (uploads.length !== payload.photoCount) {
    return jsonError("Photo count mismatch. Please start again.", 400);
  }

  const folder = submissionFolderFor(payload.submissionId);

  for (let i = 0; i < uploads.length; i++) {
    const expected = `${folder}/photo_${i}`;
    if (uploads[i].public_id !== expected) {
      return jsonError("Upload verification failed.", 400);
    }
  }

  const submittedAt = new Date().toISOString();

  const bundle: SubmissionBundleMetadata = {
    submissionId: payload.submissionId,
    submittedAt,
    email: payload.email,
    title: payload.title,
    description: payload.description,
    ...(payload.artist ? { artist: payload.artist } : {}),
    ...(payload.year ? { year: payload.year } : {}),
    ...(payload.address ? { address: payload.address } : {}),
    ...(payload.category ? { category: payload.category } : {}),
    ...(payload.phone ? { phone: payload.phone } : {}),
    ...(payload.artworkUrl ? { artworkUrl: payload.artworkUrl } : {}),
    photos: uploads.map((u, index) => ({
      index,
      public_id: u.public_id,
      secure_url: u.secure_url,
      width: u.width,
      height: u.height,
      bytes: u.bytes,
      format: u.format,
    })),
  };

  if (!isSubmissionSheetAppendConfigured()) {
    return jsonError(
      "Submissions storage is not configured (set SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON, and add a Submissions tab with headers).",
      503,
    );
  }

  try {
    await appendSubmissionBundleRow(bundle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save submission.";
    console.error("[submissions/finalize] Google Sheet append failed:", e);
    return jsonError(msg, 500);
  }

  return Response.json({
    ok: true,
    submissionId: payload.submissionId,
    submittedAt,
  });
}
