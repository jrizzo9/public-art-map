import { randomUUID } from "node:crypto";
import { cloudinaryBaseFolder } from "@/lib/cloudinary";
import { listSubmissionsFromGoogleSheet } from "@/lib/google-sheets-submissions";
import type { ListedSubmission } from "@/lib/submissions-types";

export type { ListedSubmission } from "@/lib/submissions-types";

/** Lists completed submissions from the Google Sheet `Submissions` tab. */
export async function listSubmissionsForAdmin(): Promise<
  | { submissions: ListedSubmission[] }
  | { error: string }
> {
  return listSubmissionsFromGoogleSheet();
}

/** Used when preparing uploads (must match finalize checks). */
export function submissionFolderFor(submissionId: string): string {
  return `${cloudinaryBaseFolder()}/submissions/${submissionId}`;
}

export function newSubmissionId(): string {
  return randomUUID();
}
