import { google } from "googleapis";
import { normalizeSheetHeader } from "@/lib/sheet-header-match";
import { env } from "@/lib/env";
import type { ListedSubmission, SubmissionBundleMetadata } from "@/lib/submissions-types";

export function isSubmissionSheetAppendConfigured(): boolean {
  return Boolean(
    env.SHEET_ID()?.trim() && env.GOOGLE_SERVICE_ACCOUNT_JSON()?.trim(),
  );
}

function requireSheetsCredentials(): {
  spreadsheetId: string;
  credentialsJson: object;
} {
  const spreadsheetId = env.SHEET_ID()?.trim();
  const rawJson = env.GOOGLE_SERVICE_ACCOUNT_JSON()?.trim();
  if (!spreadsheetId || !rawJson) {
    throw new Error(
      "Missing SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON for submissions sheet.",
    );
  }
  let credentialsJson: object;
  try {
    credentialsJson = JSON.parse(rawJson) as object;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  return { spreadsheetId, credentialsJson };
}

function submissionCellForNormalizedHeader(
  normalizedHeader: string,
  bundle: SubmissionBundleMetadata,
): string {
  const photos = bundle.photos ?? [];
  const firstImg = photos[0]?.secure_url ?? "";
  const allImg = photos.map((p) => p.secure_url).filter(Boolean).join(", ");

  const artwork = bundle.artworkUrl ?? "";

  const map: Record<string, string> = {
    submission_id: bundle.submissionId,
    submissionid: bundle.submissionId,
    id: bundle.submissionId,
    submitted_at: bundle.submittedAt,
    submittedat: bundle.submittedAt,
    date: bundle.submittedAt,
    email: bundle.email,
    title: bundle.title,
    description: bundle.description,
    artist: bundle.artist ?? "",
    year: bundle.year ?? "",
    address: bundle.address ?? "",
    category: bundle.category ?? "",
    phone: bundle.phone ?? "",
    artwork_url: artwork,
    external_url: artwork,
    url: artwork,
    link: artwork,
    website: artwork,
    image: firstImg,
    image_url: firstImg,
    photo: firstImg,
    photo_url: firstImg,
    images: allImg,
    photos: allImg,
    image_urls: allImg,
  };

  return map[normalizedHeader] ?? "";
}

/**
 * Appends one row to the Submissions tab. Header row must exist; columns are filled by
 * matching normalized header names (see `submissionCellForNormalizedHeader`).
 */
export async function appendSubmissionBundleRow(
  bundle: SubmissionBundleMetadata,
): Promise<void> {
  const { spreadsheetId, credentialsJson } = requireSheetsCredentials();
  const rangeA1 =
    env.SHEET_SUBMISSIONS_RANGE()?.trim() || "'Submissions'!A:Z";

  const auth = new google.auth.GoogleAuth({
    credentials: credentialsJson,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
    majorDimension: "ROWS",
  });
  const values = (valuesRes.data.values || []) as string[][];
  if (values.length === 0) {
    throw new Error(
      `Submissions range has no header row. Add headers to ${rangeA1} first.`,
    );
  }

  const headers = (values[0] || []).map((h) => String(h ?? ""));
  const row = headers.map((header) =>
    submissionCellForNormalizedHeader(normalizeSheetHeader(header), bundle),
  );

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: rangeA1,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });
}

function publicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/upload/");
    if (parts.length < 2) return null;
    const rest = parts[1];
    const withoutVersion = rest.replace(/^v\d+\//, "");
    const noExt = withoutVersion.replace(/\.[^/.]+$/, "");
    return noExt || null;
  } catch {
    return null;
  }
}

function sheetRowToListedSubmission(
  headers: string[],
  cells: string[],
): ListedSubmission | null {
  const rec: Record<string, string> = {};
  headers.forEach((h, i) => {
    rec[normalizeSheetHeader(h)] = String(cells[i] ?? "").trim();
  });

  const id =
    rec.submission_id ||
    rec.submissionid ||
    rec.id ||
    "";
  const submittedAt =
    rec.submitted_at || rec.submittedat || rec.date || "";
  const email = rec.email || "";
  const title = rec.title || "";
  const description = rec.description || "";

  if (!id || !submittedAt || !email || !title || !description) return null;

  const combined =
    rec.images || rec.image_urls || rec.photos || "";
  let urls = combined
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));

  const singleKeys = ["image", "image_url", "photo", "photo_url"] as const;
  if (urls.length === 0) {
    for (const k of singleKeys) {
      const v = rec[k];
      if (v && /^https?:\/\//i.test(v)) {
        urls = [v];
        break;
      }
    }
  }

  const artworkUrl =
    rec.artwork_url ||
    rec.external_url ||
    rec.url ||
    rec.link ||
    rec.website ||
    "";

  const photos: ListedSubmission["photos"] = urls.map((secure_url, index) => ({
    index,
    public_id: publicIdFromCloudinaryUrl(secure_url) ?? `photo_${index}`,
    secure_url,
  }));

  const out: ListedSubmission = {
    id,
    submittedAt,
    email,
    title,
    description,
    photos,
  };

  if (rec.artist) out.artist = rec.artist;
  if (rec.year) out.year = rec.year;
  if (rec.address) out.address = rec.address;
  if (rec.category) out.category = rec.category;
  if (rec.phone) out.phone = rec.phone;
  if (artworkUrl) out.artworkUrl = artworkUrl;

  return out;
}

const MAX_SUBMISSION_ROWS = 500;

/** Lists submission rows from the Submissions sheet (newest first by `submitted_at`). */
export async function listSubmissionsFromGoogleSheet(): Promise<
  | { submissions: ListedSubmission[] }
  | { error: string }
> {
  try {
    if (!isSubmissionSheetAppendConfigured()) {
      return {
        error:
          "Submissions sheet not configured (set SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON).",
      };
    }

    const { spreadsheetId, credentialsJson } = requireSheetsCredentials();
    const rangeA1 =
      env.SHEET_SUBMISSIONS_RANGE()?.trim() || "'Submissions'!A:Z";

    const auth = new google.auth.GoogleAuth({
      credentials: credentialsJson,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeA1,
      majorDimension: "ROWS",
    });
    const values = (valuesRes.data.values || []) as string[][];

    if (values.length < 2) {
      return { submissions: [] };
    }

    const headers = (values[0] || []).map((h) => String(h ?? ""));
    const dataRows = values.slice(1, 1 + MAX_SUBMISSION_ROWS);

    const submissions: ListedSubmission[] = [];
    for (const raw of dataRows) {
      const cells = [...raw];
      while (cells.length < headers.length) cells.push("");
      const row = sheetRowToListedSubmission(headers, cells);
      if (row) submissions.push(row);
    }

    submissions.sort((a, b) =>
      a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0,
    );

    return { submissions };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { error: msg };
  }
}
