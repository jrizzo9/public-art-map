import { randomUUID } from "node:crypto";
import { listCloudinaryRaw } from "@/lib/cloudinary-admin";
import { cloudinaryBaseFolder } from "@/lib/cloudinary";
import type { SubmissionBundleMetadata } from "@/lib/submissions-types";

export type ListedSubmission = {
  id: string;
  submittedAt: string;
  email: string;
  title: string;
  description: string;
  artist?: string;
  year?: string;
  address?: string;
  category?: string;
  phone?: string;
  artworkUrl?: string;
  photos: SubmissionBundleMetadata["photos"];
};

const MAX_LIST = 200;

async function fetchAllRawWithPrefix(prefix: string) {
  const out: import("@/lib/cloudinary-admin").CloudinaryResource[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 40; i++) {
    const batch = await listCloudinaryRaw({
      prefix,
      maxResults: 100,
      nextCursor: cursor,
    });
    out.push(...batch.resources);
    if (!batch.next_cursor || out.length >= MAX_LIST) break;
    cursor = batch.next_cursor;
  }
  return out;
}

/** Lists completed submissions by reading JSON raw assets (e.g. `submission.json`) under each `submissions` folder. */
export async function listSubmissionsFromCloudinary(): Promise<
  | { submissions: ListedSubmission[] }
  | { error: string }
> {
  try {
    const root = cloudinaryBaseFolder();
    const prefix = root + "/submissions";

    const rawResources = await fetchAllRawWithPrefix(prefix);

    const metaCandidates = rawResources.filter((r) => {
      if (!r.secure_url || !r.public_id) return false;
      const last = r.public_id.split("/").pop() ?? "";
      return (
        last === "submission" ||
        last.startsWith("submission.") ||
        /submission\.json$/i.test(last)
      );
    });

    const rows: ListedSubmission[] = [];

    for (const r of metaCandidates) {
      const url = r.secure_url;
      if (!url) continue;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object") continue;
      const o = parsed as Record<string, unknown>;
      if (
        typeof o.submissionId !== "string" ||
        typeof o.submittedAt !== "string" ||
        typeof o.email !== "string" ||
        typeof o.title !== "string" ||
        typeof o.description !== "string" ||
        !Array.isArray(o.photos)
      ) {
        continue;
      }

      rows.push({
        id: o.submissionId,
        submittedAt: o.submittedAt,
        email: o.email,
        title: o.title,
        description: o.description,
        ...(typeof o.artist === "string" && o.artist.trim()
          ? { artist: o.artist.trim() }
          : {}),
        ...(typeof o.year === "string" && o.year.trim() ? { year: o.year.trim() } : {}),
        ...(typeof o.address === "string" && o.address.trim()
          ? { address: o.address.trim() }
          : {}),
        ...(typeof o.category === "string" && o.category.trim()
          ? { category: o.category.trim() }
          : {}),
        ...(typeof o.phone === "string" && o.phone.trim() ? { phone: o.phone.trim() } : {}),
        ...(typeof o.artworkUrl === "string" && o.artworkUrl.trim()
          ? { artworkUrl: o.artworkUrl.trim() }
          : {}),
        photos: o.photos as SubmissionBundleMetadata["photos"],
      });
    }

    rows.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    return { submissions: rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { error: msg };
  }
}

/** Used when preparing uploads (must match finalize checks). */
export function submissionFolderFor(submissionId: string): string {
  return `${cloudinaryBaseFolder()}/submissions/${submissionId}`;
}

export function newSubmissionId(): string {
  return randomUUID();
}
