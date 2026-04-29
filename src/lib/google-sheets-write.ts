import { google } from "googleapis";
import {
  colIndexToA1,
  parseSheetNameFromRange,
  PATCH_FIELD_ALIASES,
  resolveColumnIndex,
  type ArtworkPatch,
  type PatchFieldKey,
} from "@/lib/sheet-header-match";
import { env } from "@/lib/env";

function requireSheetsEnv(): {
  spreadsheetId: string;
  rangeA1: string;
  credentialsJson: object;
} {
  const spreadsheetId = env.SHEET_ID()?.trim();
  const rawJson = env.GOOGLE_SERVICE_ACCOUNT_JSON()?.trim();
  if (!spreadsheetId || !rawJson) {
    throw new Error(
      "Missing SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON for Sheets API writes.",
    );
  }
  let credentialsJson: object;
  try {
    credentialsJson = JSON.parse(rawJson) as object;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  return {
    spreadsheetId,
    rangeA1: env.SHEET_ADMIN_RANGE(),
    credentialsJson,
  };
}

async function getSheetsContext() {
  const { spreadsheetId, rangeA1, credentialsJson } = requireSheetsEnv();
  const auth = new google.auth.GoogleAuth({
    credentials: credentialsJson,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, spreadsheetId, rangeA1 };
}

export async function readSheetMatrix(): Promise<{
  spreadsheetId: string;
  rangeA1: string;
  headers: string[];
  rows: string[][];
}> {
  const { sheets, spreadsheetId, rangeA1 } = await getSheetsContext();

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
    majorDimension: "ROWS",
  });
  const values = (valuesRes.data.values || []) as string[][];
  if (values.length === 0) {
    throw new Error(`No data for range ${rangeA1}`);
  }
  const headers = (values[0] || []).map((h) => String(h ?? ""));
  const rows = values.slice(1).map((row) => row.map((c) => String(c ?? "")));
  return { spreadsheetId, rangeA1, headers, rows };
}

function findRowIndexBySlug(headers: string[], rows: string[][], slug: string): number {
  const slugIdx = resolveColumnIndex(headers, "slug");
  if (slugIdx === null) {
    throw new Error('No "slug" column found in the sheet header row.');
  }
  const target = slug.trim().toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i][slugIdx] ?? "").trim().toLowerCase();
    if (cell === target) return i;
  }
  throw new Error(`No row with slug "${slug}".`);
}

/**
 * Updates one data row matching `slug`. Unknown patch keys are ignored if not in PATCH_FIELD_ALIASES.
 * Pass `null` to clear a cell (empty string in Sheet).
 */
export async function updateArtworkRowBySlug(
  slug: string,
  patch: ArtworkPatch,
): Promise<{ rowNumber: number; updatedFields: string[] }> {
  const { sheets, spreadsheetId, rangeA1 } = await getSheetsContext();

  const valuesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
    majorDimension: "ROWS",
  });
  const values = (valuesRes.data.values || []) as string[][];
  if (values.length === 0) {
    throw new Error(`No data for range ${rangeA1}`);
  }
  const headers = (values[0] || []).map((h) => String(h ?? ""));
  const rows = values.slice(1).map((row) => row.map((c) => String(c ?? "")));

  const dataRowIndex = findRowIndexBySlug(headers, rows, slug);
  const rowNumber = dataRowIndex + 2;
  const rowData = rows[dataRowIndex] || [];

  const newRow = headers.map((_, i) => String(rowData[i] ?? ""));
  const updatedFields: string[] = [];

  for (const [key, val] of Object.entries(patch) as [PatchFieldKey, string | number | null][]) {
    if (!(key in PATCH_FIELD_ALIASES)) continue;
    if (key === "slug") continue;
    const colIdx = resolveColumnIndex(headers, key);
    if (colIdx === null) continue;
    const str = val === null || val === undefined ? "" : String(val);
    newRow[colIdx] = str;
    updatedFields.push(key);
  }

  const sheetName = parseSheetNameFromRange(rangeA1);
  const lastCol = colIndexToA1(headers.length - 1);
  const safeName = sheetName.replace(/'/g, "''");
  const targetRange = `'${safeName}'!A${rowNumber}:${lastCol}${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: targetRange,
    valueInputOption: "RAW",
    requestBody: { values: [newRow] },
  });

  return { rowNumber, updatedFields };
}
