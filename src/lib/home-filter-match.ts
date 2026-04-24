import type { Artwork } from "@/lib/sheet";
import { parseHomeFiltersFromUrlSearchParams } from "@/app/home/home-filter-url";

const UNCATEGORIZED_KEY = "__uncategorized__";
const NO_COMMISSION_KEY = "__none__";
const NO_COLLECTION_KEY = "__none__";

function categoryFacetKey(a: Artwork): string {
  const t = a.category?.trim();
  return t ? t.toLowerCase() : UNCATEGORIZED_KEY;
}

function commissionFacetKey(a: Artwork): string {
  const t = a.commission?.trim();
  return t ? t.toLowerCase() : NO_COMMISSION_KEY;
}

function collectionFacetKey(a: Artwork): string {
  const t = a.collection?.trim();
  return t ? t.toLowerCase() : NO_COLLECTION_KEY;
}

type YearParsed = {
  ymin: number | null;
  ymax: number | null;
  yminOk: boolean;
  ymaxOk: boolean;
  hasYearFilter: boolean;
};

function parseYearInputs(yearMin: string, yearMax: string): YearParsed {
  let ymin = yearMin.trim() === "" ? null : Number(yearMin);
  let ymax = yearMax.trim() === "" ? null : Number(yearMax);
  const yminOk = ymin !== null && !Number.isNaN(ymin);
  const ymaxOk = ymax !== null && !Number.isNaN(ymax);
  if (yminOk && ymaxOk && ymin! > ymax!) {
    const t = ymin;
    ymin = ymax;
    ymax = t;
  }
  const hasYearFilter = yminOk || ymaxOk;
  return { ymin, ymax, yminOk, ymaxOk, hasYearFilter };
}

function artworkMatchesYear(a: Artwork, y: YearParsed): boolean {
  if (!y.hasYearFilter) return true;
  if (a.year == null || !Number.isFinite(a.year)) return false;
  if (y.yminOk && a.year < y.ymin!) return false;
  if (y.ymaxOk && a.year > y.ymax!) return false;
  return true;
}

/** Same facet + year semantics as the home map list (`HomeClient` filtered list). */
export function filterArtworksByHomeUrlQuery(
  artworks: Artwork[],
  query: string | URLSearchParams | Record<string, string | string[] | undefined>,
): Artwork[] {
  let params: URLSearchParams;
  if (typeof query === "string") {
    params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  } else if (query instanceof URLSearchParams) {
    params = query;
  } else {
    const pairs: [string, string][] = [];
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const item of v) pairs.push([k, String(item)]);
      } else {
        pairs.push([k, String(v)]);
      }
    }
    params = new URLSearchParams(pairs);
  }

  const f = parseHomeFiltersFromUrlSearchParams(params);
  const selectedCategories = new Set(f.categories);
  const selectedCommissions = new Set(f.commissions);
  const selectedCollections = new Set(f.collections);
  const yearParsed = parseYearInputs(f.yearMin, f.yearMax);

  return artworks.filter((a) => {
    if (
      selectedCategories.size > 0 &&
      !selectedCategories.has(categoryFacetKey(a))
    ) {
      return false;
    }
    if (
      selectedCommissions.size > 0 &&
      !selectedCommissions.has(commissionFacetKey(a))
    ) {
      return false;
    }
    if (
      selectedCollections.size > 0 &&
      !selectedCollections.has(collectionFacetKey(a))
    ) {
      return false;
    }
    return artworkMatchesYear(a, yearParsed);
  });
}
