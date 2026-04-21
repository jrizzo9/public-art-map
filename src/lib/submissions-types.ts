/** In-memory shape used at finalize before appending a row to the Submissions sheet. */
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

/** Row shown on `/admin` — sourced from the Google Sheet Submissions tab. */
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
