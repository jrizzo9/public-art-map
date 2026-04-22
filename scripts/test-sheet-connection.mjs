/**
 * Loads .env.local (KEY=VALUE per line; minified GOOGLE_SERVICE_ACCOUNT_JSON on one line).
 * Tests: published CSV, Apps Script web app (no real row update — unknown slug),
 * optional read-only spreadsheets.get when SA + SHEET_ID are set.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");

function loadEnvLocal() {
  if (!fs.existsSync(envPath)) {
    console.warn(`No ${path.basename(envPath)} — set env vars in the shell or create the file.\n`);
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

function fail(msg) {
  console.log(`\x1b[31m✗\x1b[0m ${msg}`);
}

function info(msg) {
  console.log(`\x1b[90m–\x1b[0m ${msg}`);
}

async function main() {
  loadEnvLocal();

  console.log("Sheet connection checks\n");

  const csvUrl = process.env.SHEET_CSV_URL?.trim();
  if (csvUrl) {
    try {
      const r = await fetch(csvUrl, { cache: "no-store" });
      const len = (await r.text()).length;
      if (r.ok && len > 0) ok(`Published CSV reachable (${len} chars) — SHEET_CSV_URL`);
      else fail(`Published CSV HTTP ${r.status}, body length ${len}`);
    } catch (e) {
      fail(`Published CSV fetch failed: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    info("Skip published CSV — SHEET_CSV_URL not set");
  }

  const editUrl = process.env.SHEET_EDIT_API_URL?.trim();
  const editToken = process.env.SHEET_EDIT_API_TOKEN?.trim();
  if (editUrl && editToken) {
    const slug = `___conn_test_${Date.now()}___`;
    info(`Apps Script probe: slug "${slug}" (should not match any row — expect script error JSON, not 401)`);
    try {
      const r = await fetch(editUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          patch: { title: "connection-test" },
          token: editToken,
        }),
      });
      const text = await r.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (r.status === 401 || r.status === 403) {
        fail(`Apps Script HTTP ${r.status} — token or deployment access`);
      } else if (
        typeof body === "object" &&
        body !== null &&
        body.ok === false &&
        /unauthorized/i.test(String(body.error ?? ""))
      ) {
        fail(
          `Apps Script HTTP ${r.status} but rejected token — set Script property EDIT_TOKEN (or your script’s name) to match SHEET_EDIT_API_TOKEN in .env.local, redeploy web app`,
        );
      } else if (typeof body === "object" && body !== null && body.ok === false) {
        ok(
          `Apps Script reachable (HTTP ${r.status}) — script responded: ${String(body.error ?? JSON.stringify(body)).slice(0, 200)}`,
        );
      } else if (r.ok) {
        ok(`Apps Script HTTP ${r.status} — OK. ${JSON.stringify(body).slice(0, 180)}`);
      } else {
        ok(
          `Apps Script HTTP ${r.status} — reachable. Body: ${JSON.stringify(body).slice(0, 300)}`,
        );
      }
    } catch (e) {
      fail(`Apps Script request failed: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    info("Skip Apps Script — SHEET_EDIT_API_URL / SHEET_EDIT_API_TOKEN not both set");
  }

  const sheetId = process.env.SHEET_ID?.trim();
  const rawSa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (sheetId && rawSa) {
    try {
      const credentials = JSON.parse(rawSa);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth });
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const title = meta.data.properties?.title ?? "(no title)";
      ok(`Google Sheets API read OK — workbook title: "${title}" (SHEET_ID + service account)`);
      const sheetsList = meta.data.sheets ?? [];
      const names = sheetsList
        .map((s) => s.properties?.title)
        .filter(Boolean)
        .join(", ");
      info(`Tabs: ${names || "(none listed)"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fail(`Sheets API / service account: ${msg}`);
      info("Share the spreadsheet with the service account client_email (Editor).");
    }
  } else {
    info(
      "Skip Sheets API — set SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON for read test (needed for /submit finalize)",
    );
  }

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
