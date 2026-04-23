#!/usr/bin/env node
/**
 * PageSpeed Insights CLI helper.
 *
 * Usage:
 *   PSI_KEY=... node scripts/psi.mjs https://map.creativewaco.org/
 *   node scripts/psi.mjs https://map.creativewaco.org/ --key=... --strategy=mobile
 *
 * Notes:
 * - Uses the PSI API (server-side Lighthouse), not local Lighthouse CLI.
 * - Keep output compact and CI-friendly.
 */
import process from "node:process";

function parseArgs(argv) {
  const args = { url: null, key: process.env.PSI_KEY ?? null, strategy: "mobile" };
  for (const a of argv.slice(2)) {
    if (!args.url && !a.startsWith("--")) {
      args.url = a;
      continue;
    }
    if (a.startsWith("--key=")) args.key = a.slice("--key=".length);
    if (a.startsWith("--strategy=")) args.strategy = a.slice("--strategy=".length);
  }
  return args;
}

function metric(json, auditId) {
  return json?.lighthouseResult?.audits?.[auditId]?.displayValue ?? "";
}

function perfScore(json) {
  const score = json?.lighthouseResult?.categories?.performance?.score;
  return typeof score === "number" ? Math.round(score * 100) : null;
}

function topBootupUrls(json, n = 5) {
  const items = json?.lighthouseResult?.audits?.["bootup-time"]?.details?.items ?? [];
  const rows = items
    .filter((x) => typeof x?.url === "string")
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .slice(0, n)
    .map((x) => ({ url: x.url, totalMs: Math.round(x.total ?? 0) }));
  return rows;
}

function longTaskUrls(json) {
  const dbg = json?.lighthouseResult?.audits?.["long-tasks"]?.details?.debugData;
  const urls = dbg?.urls ?? [];
  const tasks = dbg?.tasks ?? [];
  const byUrlIndex = new Map();
  for (const t of tasks) {
    const idx = t?.urlIndex;
    if (typeof idx !== "number") continue;
    byUrlIndex.set(idx, (byUrlIndex.get(idx) ?? 0) + (t.duration ?? 0));
  }
  const ranked = [...byUrlIndex.entries()]
    .map(([idx, dur]) => ({ url: urls[idx] ?? `urlIndex:${idx}`, durMs: Math.round(dur) }))
    .sort((a, b) => b.durMs - a.durMs)
    .slice(0, 6);
  return ranked;
}

async function run({ url, key, strategy }) {
  if (!url) {
    console.error("Usage: node scripts/psi.mjs <url> [--strategy=mobile|desktop] [--key=PSI_KEY]");
    process.exitCode = 2;
    return;
  }

  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  if (key) endpoint.searchParams.set("key", key);

  const res = await fetch(endpoint);
  const json = await res.json();
  if (!res.ok || json?.error) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const score = perfScore(json);
  const lcp = metric(json, "largest-contentful-paint");
  const tbt = metric(json, "total-blocking-time");
  const cls = metric(json, "cumulative-layout-shift");
  const js = metric(json, "bootup-time");
  const main = metric(json, "mainthread-work-breakdown");
  const long = metric(json, "long-tasks");

  console.log(
    [
      `${strategy.toUpperCase()} ${url}`,
      `performance=${score ?? "?"}`,
      `lcp=${lcp}`,
      `tbt=${tbt}`,
      `cls=${cls}`,
      `js_exec=${js}`,
      `main_thread=${main}`,
      `long_tasks=${long}`,
    ].join(" | "),
  );

  const boot = topBootupUrls(json);
  if (boot.length) {
    console.log("Top bootup urls:");
    for (const r of boot) console.log(`- ${r.totalMs}ms ${r.url}`);
  }

  const lt = longTaskUrls(json);
  if (lt.length) {
    console.log("Long-task attribution (sum duration):");
    for (const r of lt) console.log(`- ${r.durMs}ms ${r.url}`);
  }
}

const args = parseArgs(process.argv);
run(args).catch((e) => {
  console.error(`PSI error: ${e?.message ?? String(e)}`);
  process.exitCode = 1;
});

