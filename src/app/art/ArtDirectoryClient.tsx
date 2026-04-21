"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Artwork } from "@/lib/sheet";
import nearbyStyles from "./nearby-art.module.css";
import dirStyles from "./art-directory.module.css";

type SortKey =
  | "title-asc"
  | "title-desc"
  | "year-desc"
  | "year-asc"
  | "artist-asc"
  | "artist-desc";

const SEARCH_ID = "art-directory-search";
const CATEGORY_ID = "art-directory-category";
const COLLECTION_ID = "art-directory-collection";
const COMMISSION_ID = "art-directory-commission";
const SORT_ID = "art-directory-sort";

function toNormalizedSearch(value: string): string {
  return value.trim().toLowerCase();
}

function getDistinctSorted(artworks: Artwork[], field: "category" | "collection" | "commission"): string[] {
  const set = new Set<string>();
  for (const a of artworks) {
    const raw = a[field]?.trim();
    if (raw) set.add(raw);
  }
  return Array.from(set).sort((x, y) => x.localeCompare(y));
}

function compareArtworks(a: Artwork, b: Artwork, sort: SortKey): number {
  switch (sort) {
    case "title-desc":
      return b.title.localeCompare(a.title);
    case "year-desc": {
      const ay = a.year ?? -Infinity;
      const by = b.year ?? -Infinity;
      if (ay !== by) return by - ay;
      return a.title.localeCompare(b.title);
    }
    case "year-asc": {
      const ay = a.year ?? Infinity;
      const by = b.year ?? Infinity;
      if (ay !== by) return ay - by;
      return a.title.localeCompare(b.title);
    }
    case "artist-asc": {
      const aa = a.artist?.trim() || "\uFFFF";
      const ba = b.artist?.trim() || "\uFFFF";
      const c = aa.localeCompare(ba);
      if (c !== 0) return c;
      return a.title.localeCompare(b.title);
    }
    case "artist-desc": {
      const aa = a.artist?.trim() || "";
      const ba = b.artist?.trim() || "";
      const c = ba.localeCompare(aa);
      if (c !== 0) return c;
      return a.title.localeCompare(b.title);
    }
    case "title-asc":
    default:
      return a.title.localeCompare(b.title);
  }
}

export function ArtDirectoryClient({ artworks }: { artworks: Artwork[] }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [collection, setCollection] = React.useState<string>("all");
  const [commission, setCommission] = React.useState<string>("all");
  const [sort, setSort] = React.useState<SortKey>("title-asc");

  const categories = React.useMemo(() => getDistinctSorted(artworks, "category"), [artworks]);
  const collections = React.useMemo(() => getDistinctSorted(artworks, "collection"), [artworks]);
  const commissions = React.useMemo(() => getDistinctSorted(artworks, "commission"), [artworks]);

  const normalizedQuery = React.useMemo(() => toNormalizedSearch(query), [query]);

  const filtered = React.useMemo(() => {
    const q = normalizedQuery;
    const categoryFilter = category === "all" ? null : category;
    const collectionFilter = collection === "all" ? null : collection;
    const commissionFilter = commission === "all" ? null : commission;

    const results = artworks.filter((a) => {
      if (categoryFilter && a.category?.trim() !== categoryFilter) return false;
      if (collectionFilter && a.collection?.trim() !== collectionFilter) return false;
      if (commissionFilter && a.commission?.trim() !== commissionFilter) return false;
      if (!q) return true;

      const haystack = [
        a.title,
        a.artist,
        a.address,
        a.category,
        a.collection,
        a.commission,
        a.year != null ? String(a.year) : undefined,
      ]
        .filter(Boolean)
        .join(" • ")
        .toLowerCase();

      return haystack.includes(q);
    });

    results.sort((a, b) => compareArtworks(a, b, sort));

    return results;
  }, [
    artworks,
    normalizedQuery,
    category,
    collection,
    commission,
    sort,
  ]);

  const hasActiveFilters =
    Boolean(query.trim()) ||
    category !== "all" ||
    collection !== "all" ||
    commission !== "all" ||
    sort !== "title-asc";

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setCollection("all");
    setCommission("all");
    setSort("title-asc");
  }

  return (
    <>
      <div className={dirStyles.toolbar}>
        <div className={dirStyles.toolbarRow}>
          <div className={`${dirStyles.toolbarField} ${dirStyles.toolbarSearch}`}>
            <label className={dirStyles.toolbarLabel} htmlFor={SEARCH_ID}>
              Search
            </label>
            <input
              id={SEARCH_ID}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, artist, address…"
              inputMode="search"
              autoComplete="off"
              className={dirStyles.toolbarInput}
            />
          </div>

          <div className={`${dirStyles.toolbarField} ${dirStyles.toolbarSelectStretch}`}>
            <label className={dirStyles.toolbarLabel} htmlFor={CATEGORY_ID}>
              Category
            </label>
            <select
              id={CATEGORY_ID}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${dirStyles.toolbarInput} ${dirStyles.selectNative}`}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {collections.length ? (
            <div className={`${dirStyles.toolbarField} ${dirStyles.toolbarSelectStretch}`}>
              <label className={dirStyles.toolbarLabel} htmlFor={COLLECTION_ID}>
                Collection
              </label>
              <select
                id={COLLECTION_ID}
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                className={`${dirStyles.toolbarInput} ${dirStyles.selectNative}`}
                aria-label="Filter by collection"
              >
                <option value="all">All collections</option>
                {collections.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {commissions.length ? (
            <div className={`${dirStyles.toolbarField} ${dirStyles.toolbarSelectStretch}`}>
              <label className={dirStyles.toolbarLabel} htmlFor={COMMISSION_ID}>
                Commission
              </label>
              <select
                id={COMMISSION_ID}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className={`${dirStyles.toolbarInput} ${dirStyles.selectNative}`}
                aria-label="Filter by commission"
              >
                <option value="all">All commissions</option>
                {commissions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={`${dirStyles.toolbarField} ${dirStyles.toolbarSelectWide}`}>
            <label className={dirStyles.toolbarLabel} htmlFor={SORT_ID}>
              Sort
            </label>
            <select
              id={SORT_ID}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={`${dirStyles.toolbarInput} ${dirStyles.selectNative}`}
              aria-label="Sort artworks"
            >
              <option value="title-asc">Title A → Z</option>
              <option value="title-desc">Title Z → A</option>
              <option value="year-desc">Year (newest first)</option>
              <option value="year-asc">Year (oldest first)</option>
              <option value="artist-asc">Artist A → Z</option>
              <option value="artist-desc">Artist Z → A</option>
            </select>
          </div>

          {hasActiveFilters ? (
            <button type="button" className={dirStyles.resetBtn} onClick={resetFilters}>
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length ? (
        <section aria-label="Artwork directory" className="min-w-0">
          <ul className={`${nearbyStyles.grid} ${dirStyles.directoryList}`}>
            {filtered.map((a) => (
              <li key={a.slug} className="min-w-0">
                <div className={nearbyStyles.cardFlat}>
                  <Link
                    href={`/art/${a.slug}`}
                    className={nearbyStyles.mainLink}
                    transitionTypes={["nav-forward"]}
                  >
                    <div className={nearbyStyles.thumbWrap}>
                      {a.image ? (
                        <Image
                          src={a.image}
                          alt={a.title}
                          fill
                          sizes="(max-width: 720px) 45vw, 250px"
                          className={nearbyStyles.thumb}
                        />
                      ) : (
                        <div className={nearbyStyles.thumbFallback}>Photo soon</div>
                      )}
                    </div>

                    <div className={nearbyStyles.content}>
                      <div className={nearbyStyles.titleRow}>
                        <p className={nearbyStyles.cardTitle}>{a.title}</p>
                      </div>

                      <div className={nearbyStyles.meta}>
                        {(a.artist || a.year != null) && (
                          <div>
                            {[a.artist, a.year != null ? String(a.year) : null]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                        )}
                        {a.category ? (
                          <div className={nearbyStyles.metaRow}>
                            <span className={nearbyStyles.pill}>{a.category}</span>
                          </div>
                        ) : null}
                      </div>

                      {a.description ? (
                        <p className={dirStyles.excerpt}>{a.description}</p>
                      ) : null}
                    </div>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="No results" className={dirStyles.empty}>
          <p className={dirStyles.emptyTitle}>No artworks match your filters.</p>
          <p className={dirStyles.emptySub}>
            Try another search term, adjust category, collection, commission, or sort — or reset
            filters.
          </p>
          {hasActiveFilters ? (
            <button type="button" className={dirStyles.emptyBtn} onClick={resetFilters}>
              Reset filters
            </button>
          ) : null}
        </section>
      )}
    </>
  );
}
