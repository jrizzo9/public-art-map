import { z } from "zod";
import {
  createImageDirectUploadSlot,
  requireEnv,
} from "@/lib/cloudinary";
import { signSubmissionPreparePayload } from "@/lib/submission-token";
import {
  newSubmissionId,
  submissionFolderFor,
} from "@/lib/submissions-admin";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

const prepareSchema = z.object({
  email: z.string().trim().max(254).email(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(8000),
  photoCount: z.coerce.number().int().min(1).max(8),
  /** Honeypot — must be empty. */
  company: z.string().optional(),
  artist: z.string().trim().max(200).optional(),
  year: z.string().trim().max(32).optional(),
  address: z.string().trim().max(500).optional(),
  category: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  artworkUrl: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().url().max(500).optional(),
  ),
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

  const parsed = prepareSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Check all required fields and try again.", 400);
  }

  const d = parsed.data;
  if (d.company?.trim()) {
    return jsonError("Invalid request", 400);
  }

  const email = d.email;
  const title = d.title;
  const description = d.description;
  const photoCount = d.photoCount;
  const artist = d.artist?.trim() || undefined;
  const year = d.year?.trim() || undefined;
  const address = d.address?.trim() || undefined;
  const category = d.category?.trim() || undefined;
  const phone = d.phone?.trim() || undefined;
  const artworkUrl = d.artworkUrl?.trim() || undefined;

  try {
    requireEnv("CLOUDINARY_CLOUD_NAME");
    requireEnv("CLOUDINARY_API_KEY");
    requireEnv("CLOUDINARY_API_SECRET");
  } catch {
    return jsonError("Submissions are temporarily unavailable.", 503);
  }

  const submissionId = newSubmissionId();
  const submissionFolder = submissionFolderFor(submissionId);
  const exp = Date.now() + 20 * 60 * 1000;

  const token = signSubmissionPreparePayload({
    submissionId,
    email,
    title,
    description,
    photoCount,
    exp,
    ...(artist ? { artist } : {}),
    ...(year ? { year } : {}),
    ...(address ? { address } : {}),
    ...(category ? { category } : {}),
    ...(phone ? { phone } : {}),
    ...(artworkUrl ? { artworkUrl } : {}),
  });

  const slots = [];
  for (let i = 0; i < photoCount; i++) {
    const slot = createImageDirectUploadSlot({
      submissionFolder,
      photoBasename: `photo_${i}`,
    });
    slots.push({
      index: i,
      uploadUrl: slot.uploadUrl,
      fields: slot.fields,
      expectedPublicId: slot.expectedPublicId,
    });
  }

  return Response.json({
    ok: true,
    token,
    submissionId,
    slots,
  });
}
