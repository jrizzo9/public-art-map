/**
 * Home page map filters in the query string (shareable / bookmarkable).
 *
 * Keys: repeated `cat`, `comm`, `coll` (facet keys, lowercased);
 *       `ymin`, `ymax` for year bounds (digits, same semantics as inputs).
 */

export type HomeFiltersFromUrl = {
  categories: string[];
  commissions: string[];
  collections: string[];
  yearMin: string;
  yearMax: string;
  /** `fs=1` indicates the map is in fullscreen mode. */
  fullscreen: boolean;
};

const EMPTY: HomeFiltersFromUrl = {
  categories: [],
  commissions: [],
  collections: [],
  yearMin: "",
  yearMax: "",
  fullscreen: false,
};

function splitKeys(raw: string | string[] | undefined): string[] {
  if (raw == null) return [];
  const out = new Set<string>();
  const parts = Array.isArray(raw) ? raw : [raw];
  for (const p of parts) {
    for (const segment of String(p).split(",")) {
      const t = segment.trim().toLowerCase();
      if (t) out.add(t);
    }
  }
  return [...out];
}

/** Next.js page `searchParams` record (awaited). */
export function parseHomeFiltersFromPageSearchParams(
  sp: Record<string, string | string[] | undefined>,
): HomeFiltersFromUrl {
  const fs = Array.isArray(sp.fs) ? sp.fs[0] : sp.fs;
  return {
    categories: splitKeys(sp.cat),
    commissions: splitKeys(sp.comm),
    collections: splitKeys(sp.coll),
    yearMin: typeof sp.ymin === "string" ? sp.ymin.trim() : "",
    yearMax: typeof sp.ymax === "string" ? sp.ymax.trim() : "",
    fullscreen: fs === "1" || fs === "true",
  };
}

export function parseHomeFiltersFromUrlSearchParams(
  params: URLSearchParams,
): HomeFiltersFromUrl {
  return {
    categories: [...new Set(params.getAll("cat").map((s) => s.trim().toLowerCase()).filter(Boolean))],
    commissions: [...new Set(params.getAll("comm").map((s) => s.trim().toLowerCase()).filter(Boolean))],
    collections: [...new Set(params.getAll("coll").map((s) => s.trim().toLowerCase()).filter(Boolean))],
    yearMin: params.get("ymin")?.trim() ?? "",
    yearMax: params.get("ymax")?.trim() ?? "",
    fullscreen: params.get("fs") === "1" || params.get("fs") === "true",
  };
}

export function homeFiltersFromUrlEqual(a: HomeFiltersFromUrl, b: HomeFiltersFromUrl): boolean {
  const sameList = (x: string[], y: string[]) =>
    x.length === y.length && x.every((v, i) => v === y[i]);

  const sort = (arr: string[]) => [...arr].sort();
  return (
    sameList(sort(a.categories), sort(b.categories)) &&
    sameList(sort(a.commissions), sort(b.commissions)) &&
    sameList(sort(a.collections), sort(b.collections)) &&
    a.yearMin === b.yearMin &&
    a.yearMax === b.yearMax &&
    a.fullscreen === b.fullscreen
  );
}

export function serializeHomeFiltersToQueryString(f: HomeFiltersFromUrl): string {
  const has =
    f.categories.length > 0 ||
    f.commissions.length > 0 ||
    f.collections.length > 0 ||
    f.yearMin !== "" ||
    f.yearMax !== "" ||
    f.fullscreen;

  if (!has) return "";

  const p = new URLSearchParams();
  for (const v of [...f.categories].sort()) p.append("cat", v);
  for (const v of [...f.commissions].sort()) p.append("comm", v);
  for (const v of [...f.collections].sort()) p.append("coll", v);
  if (f.yearMin !== "") p.set("ymin", f.yearMin);
  if (f.yearMax !== "") p.set("ymax", f.yearMax);
  if (f.fullscreen) p.set("fs", "1");
  return p.toString();
}

export function emptyHomeFiltersFromUrl(): HomeFiltersFromUrl {
  return { ...EMPTY };
}
