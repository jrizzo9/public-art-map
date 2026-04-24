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

/**
 * Facet keys in URLs are lowercased; `+` in query strings often means space but Next.js `searchParams`
 * can leave it as a literal plus — normalize so `coll=sculpture+zoo` matches sheet value "Sculpture Zoo".
 */
export function normalizeHomeFacetToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/\+/g, " ");
}

function splitKeys(raw: string | string[] | undefined): string[] {
  if (raw == null) return [];
  const out = new Set<string>();
  const parts = Array.isArray(raw) ? raw : [raw];
  for (const p of parts) {
    for (const segment of String(p).split(",")) {
      const t = normalizeHomeFacetToken(segment);
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
    categories: [...new Set(params.getAll("cat").map(normalizeHomeFacetToken).filter(Boolean))],
    commissions: [...new Set(params.getAll("comm").map(normalizeHomeFacetToken).filter(Boolean))],
    collections: [...new Set(params.getAll("coll").map(normalizeHomeFacetToken).filter(Boolean))],
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

/** Selected artwork slug for deep links (`?art=my-piece-slug`). */
export function getArtSlugFromSearchParams(params: URLSearchParams): string | undefined {
  const v = params.get("art")?.trim();
  return v || undefined;
}

/** Server `searchParams` record (Next.js page props). */
export function getArtSlugFromPageSearchParams(
  sp: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = sp.art;
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return v || undefined;
}

/** Full home map query string: filters + optional `art` (canonical filter keys from `f`). */
export function serializeHomeMapQueryString(
  f: HomeFiltersFromUrl,
  artSlug?: string,
): string {
  const base = serializeHomeFiltersToQueryString(f);
  const p = base ? new URLSearchParams(base) : new URLSearchParams();
  const art = artSlug?.trim();
  if (art) p.set("art", art);
  else p.delete("art");
  return p.toString();
}

/** Order-independent compare for `router.replace` deduping. */
export function homeMapQueryStringsEqual(a: string, b: string): boolean {
  const norm = (qs: string) => {
    const p = new URLSearchParams(qs);
    const keys = [...new Set([...p.keys()])].sort();
    const out = new URLSearchParams();
    for (const k of keys) {
      for (const v of [...p.getAll(k)].sort()) out.append(k, v);
    }
    return out.toString();
  };
  return norm(a) === norm(b);
}

export function emptyHomeFiltersFromUrl(): HomeFiltersFromUrl {
  return { ...EMPTY };
}
