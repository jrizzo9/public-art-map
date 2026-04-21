"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import type { Artwork } from "@/lib/sheet";
import { markerColorForCategory } from "@/lib/category-colors";
import { MapView } from "@/components/MapView";
import styles from "./home.module.css";

const CREATIVE_WACO_HOME = "https://creativewaco.org/";
const CREATIVE_WACO_LOGO_URL =
  "https://yrnfoftkuamimcaownig.supabase.co/storage/v1/object/public/culturalyst/is5gglgrgelofzc4ia7bm4cqfu71";

type Props = {
  artworks: Artwork[];
  mapboxStyleUrl?: string;
};

type FacetOption = { key: string; label: string };

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

/** Which facet's own selections to ignore when listing options for that facet */
type OmitFacet = "category" | "commission" | "collection";

function artworkMatchesOtherFacetFilters(
  a: Artwork,
  selectedCategories: Set<string>,
  selectedCommissions: Set<string>,
  selectedCollections: Set<string>,
  omit: OmitFacet,
): boolean {
  if (
    omit !== "category" &&
    selectedCategories.size > 0 &&
    !selectedCategories.has(categoryFacetKey(a))
  ) {
    return false;
  }
  if (
    omit !== "commission" &&
    selectedCommissions.size > 0 &&
    !selectedCommissions.has(commissionFacetKey(a))
  ) {
    return false;
  }
  if (
    omit !== "collection" &&
    selectedCollections.size > 0 &&
    !selectedCollections.has(collectionFacetKey(a))
  ) {
    return false;
  }
  return true;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function pruneSelectionToAllowed(
  prev: Set<string>,
  allowedKeys: Iterable<string>,
): Set<string> {
  const allowed = new Set(allowedKeys);
  const next = new Set<string>();
  for (const k of prev) if (allowed.has(k)) next.add(k);
  return setsEqual(prev, next) ? prev : next;
}

export function HomeClient({ artworks, mapboxStyleUrl }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(undefined);
  const [hoveredSlug, setHoveredSlug] = useState<string | undefined>(undefined);

  /** Empty = do not filter by this facet; non-empty = only matching artworks */
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => new Set());
  const [selectedCommissions, setSelectedCommissions] = useState<Set<string>>(() => new Set());
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(() => new Set());
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");

  const yearParsed = useMemo(
    () => parseYearInputs(yearMin, yearMax),
    [yearMin, yearMax],
  );

  const poolForCategoryOptions = useMemo(() => {
    return artworks.filter(
      (a) =>
        artworkMatchesOtherFacetFilters(
          a,
          selectedCategories,
          selectedCommissions,
          selectedCollections,
          "category",
        ) && artworkMatchesYear(a, yearParsed),
    );
  }, [
    artworks,
    selectedCategories,
    selectedCommissions,
    selectedCollections,
    yearParsed,
  ]);

  const poolForCommissionOptions = useMemo(() => {
    return artworks.filter(
      (a) =>
        artworkMatchesOtherFacetFilters(
          a,
          selectedCategories,
          selectedCommissions,
          selectedCollections,
          "commission",
        ) && artworkMatchesYear(a, yearParsed),
    );
  }, [
    artworks,
    selectedCategories,
    selectedCommissions,
    selectedCollections,
    yearParsed,
  ]);

  const poolForCollectionOptions = useMemo(() => {
    return artworks.filter(
      (a) =>
        artworkMatchesOtherFacetFilters(
          a,
          selectedCategories,
          selectedCommissions,
          selectedCollections,
          "collection",
        ) && artworkMatchesYear(a, yearParsed),
    );
  }, [
    artworks,
    selectedCategories,
    selectedCommissions,
    selectedCollections,
    yearParsed,
  ]);

  const categoryOptions = useMemo((): FacetOption[] => {
    const labels = new Map<string, string>();
    for (const a of poolForCategoryOptions) {
      const key = categoryFacetKey(a);
      if (labels.has(key)) continue;
      labels.set(key, a.category?.trim() || "Uncategorized");
    }
    return [...labels.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [poolForCategoryOptions]);

  const commissionOptions = useMemo((): FacetOption[] => {
    const labels = new Map<string, string>();
    for (const a of poolForCommissionOptions) {
      const key = commissionFacetKey(a);
      if (labels.has(key)) continue;
      labels.set(key, a.commission?.trim() || "Not listed");
    }
    return [...labels.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [poolForCommissionOptions]);

  const collectionOptions = useMemo((): FacetOption[] => {
    const labels = new Map<string, string>();
    for (const a of poolForCollectionOptions) {
      const key = collectionFacetKey(a);
      if (labels.has(key)) continue;
      labels.set(key, a.collection?.trim() || "Not listed");
    }
    return [...labels.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [poolForCollectionOptions]);

  useEffect(() => {
    setSelectedCategories((prev) =>
      pruneSelectionToAllowed(prev, categoryOptions.map((o) => o.key)),
    );
    setSelectedCommissions((prev) =>
      pruneSelectionToAllowed(prev, commissionOptions.map((o) => o.key)),
    );
    setSelectedCollections((prev) =>
      pruneSelectionToAllowed(prev, collectionOptions.map((o) => o.key)),
    );
  }, [categoryOptions, commissionOptions, collectionOptions]);

  const yearBounds = useMemo(() => {
    const years = artworks
      .map((a) => a.year)
      .filter((y): y is number => y != null && Number.isFinite(y));
    if (years.length === 0) return { min: undefined as number | undefined, max: undefined as number | undefined };
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [artworks]);

  const filtered = useMemo(() => {
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
  }, [
    artworks,
    selectedCategories,
    selectedCommissions,
    selectedCollections,
    yearParsed,
  ]);

  const toggleCategory = useCallback((key: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleCommission = useCallback((key: string) => {
    setSelectedCommissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleCollection = useCallback((key: string) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCategories(new Set());
    setSelectedCommissions(new Set());
    setSelectedCollections(new Set());
    setYearMin("");
    setYearMax("");
  }, []);

  const activeFilterCount =
    selectedCategories.size +
    selectedCommissions.size +
    selectedCollections.size +
    (yearMin.trim() !== "" || yearMax.trim() !== "" ? 1 : 0);

  const onSelectArtwork = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const onClearSelection = useCallback(() => {
    setSelectedSlug(undefined);
  }, []);

  const skipClearSelectionOnMountRef = useRef(true);
  useEffect(() => {
    if (skipClearSelectionOnMountRef.current) {
      skipClearSelectionOnMountRef.current = false;
      return;
    }
    setSelectedSlug(undefined);
  }, [
    selectedCategories,
    selectedCommissions,
    selectedCollections,
    yearMin,
    yearMax,
  ]);

  return (
    <div className={styles.shell}>
      <a
        href={CREATIVE_WACO_HOME}
        className={styles.brandLogo}
        aria-label="Creative Waco — visit creativewaco.org"
      >
        <Image
          src={CREATIVE_WACO_LOGO_URL}
          alt=""
          width={220}
          height={56}
          className={styles.brandLogoImg}
          priority
          sizes="220px"
        />
      </a>

      <section className={styles.map}>
        <MapView
          artworks={filtered}
          selectedSlug={selectedSlug}
          highlightSlug={hoveredSlug}
          onSelectSlug={onSelectArtwork}
          onClearSelection={onClearSelection}
          styleUrl={mapboxStyleUrl}
        />
      </section>

      <aside className={styles.panel} aria-label="Artwork list">
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.h1}>Waco Public Art Map</h1>
            </div>
          </div>

          <details className={styles.filterDetails}>
            <summary className={styles.filterSummary} id="filters-summary">
              <span className={styles.filterChevron} aria-hidden />
              <span>Filters</span>
              {activeFilterCount > 0 ? (
                <span
                  className={styles.filterBadge}
                  aria-label={`${activeFilterCount} active refinement${
                    activeFilterCount === 1 ? "" : "s"
                  }`}
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </summary>
            <div
              className={styles.filtersInner}
              role="group"
              aria-labelledby="filters-summary"
            >
            <div className={styles.filterRow}>
              <span className={styles.caption}>Category</span>
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={styles.filterLink}
                  disabled={selectedCategories.size === 0}
                  onClick={() => setSelectedCategories(new Set())}
                >
                  Any
                </button>
              </div>
            </div>
            <ul className={styles.filterToggleList} aria-label="Categories">
              {categoryOptions.map((o) => {
                const on = selectedCategories.has(o.key);
                const dotColor =
                  o.key === UNCATEGORIZED_KEY
                    ? markerColorForCategory(undefined)
                    : markerColorForCategory(o.label);
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      className={`${styles.filterToggle}${
                        on ? ` ${styles.filterToggleCatOn}` : ""
                      }`}
                      style={{ "--cat": dotColor } as CSSProperties}
                      aria-pressed={on}
                      onClick={() => toggleCategory(o.key)}
                    >
                      <span
                        className={styles.filterToggleSwatch}
                        style={{ background: dotColor }}
                        aria-hidden
                      />
                      <span className={styles.filterToggleText}>{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className={styles.filterRow}>
              <span className={styles.caption}>Commission</span>
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={styles.filterLink}
                  disabled={selectedCommissions.size === 0}
                  onClick={() => setSelectedCommissions(new Set())}
                >
                  Any
                </button>
              </div>
            </div>
            <ul className={styles.filterToggleList} aria-label="Commission">
              {commissionOptions.map((o) => {
                const on = selectedCommissions.has(o.key);
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      className={`${styles.filterToggle}${
                        on ? ` ${styles.filterToggleOn}` : ""
                      }`}
                      aria-pressed={on}
                      onClick={() => toggleCommission(o.key)}
                    >
                      <span className={styles.filterToggleText}>{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className={styles.filterRow}>
              <span className={styles.caption}>Collection</span>
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={styles.filterLink}
                  disabled={selectedCollections.size === 0}
                  onClick={() => setSelectedCollections(new Set())}
                >
                  Any
                </button>
              </div>
            </div>
            <ul className={styles.filterToggleList} aria-label="Collection">
              {collectionOptions.map((o) => {
                const on = selectedCollections.has(o.key);
                return (
                  <li key={o.key}>
                    <button
                      type="button"
                      className={`${styles.filterToggle}${
                        on ? ` ${styles.filterToggleOn}` : ""
                      }`}
                      aria-pressed={on}
                      onClick={() => toggleCollection(o.key)}
                    >
                      <span className={styles.filterToggleText}>{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className={styles.yearRow}>
              <div className={styles.yearField}>
                <label className={styles.label} htmlFor="year-from">
                  From
                </label>
                <input
                  id="year-from"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={
                    yearBounds.min != null ? String(yearBounds.min) : "Any"
                  }
                  value={yearMin}
                  onChange={(e) => setYearMin(e.target.value)}
                  aria-describedby="year-hint"
                />
              </div>
              <div className={styles.yearField}>
                <label className={styles.label} htmlFor="year-to">
                  To
                </label>
                <input
                  id="year-to"
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={
                    yearBounds.max != null ? String(yearBounds.max) : "Any"
                  }
                  value={yearMax}
                  onChange={(e) => setYearMax(e.target.value)}
                  aria-describedby="year-hint"
                />
              </div>
            </div>
            <p id="year-hint" className={styles.srOnly}>
              Year range only includes entries with a year listed. Leave blank
              for any year.
            </p>

            {activeFilterCount > 0 && (
              <button
                type="button"
                className={styles.clearFilters}
                onClick={clearFilters}
              >
                Clear ({activeFilterCount})
              </button>
            )}
            </div>
          </details>
        </header>

        <div className={styles.panelBody}>
          <ul className={styles.ul}>
            {filtered.map((a) => (
              <li key={a.slug} className={styles.li}>
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => setSelectedSlug(a.slug)}
                  onMouseEnter={() => setHoveredSlug(a.slug)}
                  onMouseLeave={() => setHoveredSlug(undefined)}
                  onFocus={() => setHoveredSlug(a.slug)}
                  onBlur={() => setHoveredSlug(undefined)}
                >
                  <span className={styles.itemRow}>
                    <span
                      className={styles.listDot}
                      style={{
                        background: markerColorForCategory(a.category),
                      }}
                      aria-hidden
                    />
                    <span className={styles.title}>{a.title}</span>
                  </span>
                  <span className={styles.meta}>
                    {(a.category ?? "Artwork") +
                      (a.year != null ? ` · ${a.year}` : "") +
                      (a.address ? ` · ${a.address}` : "")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.count}>
            Showing <strong>{filtered.length}</strong> of <strong>{artworks.length}</strong>
          </p>
        </div>
      </aside>
    </div>
  );
}
