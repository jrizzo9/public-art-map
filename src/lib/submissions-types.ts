/** Stored next to submission photos as a Cloudinary raw asset (`submission.json`). */
export type SubmissionBundleMetadata = {
  submissionId: string;
  submittedAt: string;
  email: string;
  title: string;
  description: string;
  /** Optional details (also on the published sheet when applicable). */
  artist?: string;
  year?: string;
  address?: string;
  category?: string;
  phone?: string;
  artworkUrl?: string;
  photos: Array<{
    index: number;
    public_id: string;
    secure_url: string;
    width?: number;
    height?: number;
    bytes?: number;
    format?: string;
  }>;
};
