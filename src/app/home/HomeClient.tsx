"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Artwork } from "@/lib/sheet";
import { markerColorForCategory } from "@/lib/category-colors";
import { MapView } from "@/components/MapView";
import styles from "./home.module.css";

type Props = {
  artworks: Artwork[];
  mapboxStyleUrl?: string;
};

type FacetOption = { key: string; label: string };

const UNCATEGORIZED_KEY = "__uncategorized__";
const NO_COMMISSION_KEY = "__none__";

function categoryFacetKey(a: Artwork): string {
  const t = a.category?.trim();
  return t ? t.toLowerCase() : UNCATEGORIZED_KEY;
}

function commissionFacetKey(a: Artwork): string {
  const t = a.commission?.trim();
  return t ? t.toLowerCase() : NO_COMMISSION_KEY;
}

export function HomeClient({ artworks, mapboxStyleUrl }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | undefined>(undefined);
  const [hoveredSlug, setHoveredSlug] = useState<string | undefined>(undefined);

  const categoryOptions = useMemo((): FacetOption[] => {
    const labels = new Map<string, string>();
    for (const a of artworks) {
      const key = categoryFacetKey(a);
      if (labels.has(key)) continue;
      labels.set(key, a.category?.trim() || "Uncategorized");
    }
    return [...labels.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [artworks]);

  const commissionOptions = useMemo((): FacetOption[] => {
    const labels = new Map<string, string>();
    for (const a of artworks) {
      const key = commissionFacetKey(a);
      if (labels.has(key)) continue;
      labels.set(key, a.commission?.trim() || "Not listed");
    }
    return [...labels.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [artworks]);

  const yearBounds = useMemo(() => {
    const years = artworks
      .map((a) => a.year)
      .filter((y): y is number => y != null && Number.isFinite(y));
    if (years.length === 0) return { min: undefined as number | undefined, max: undefined as number | undefined };
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [artworks]);

  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(() => new Set());
  const [disabledCommissions, setDisabledCommissions] = useState<Set<string>>(() => new Set());
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");

  const filtered = useMemo(() => {
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

    return artworks.filter((a) => {
      if (disabledCategories.has(categoryFacetKey(a))) return false;
      if (disabledCommissions.has(commissionFacetKey(a))) return false;

      if (hasYearFilter) {
        if (a.year == null || !Number.isFinite(a.year)) return false;
        if (yminOk && a.year < ymin!) return false;
        if (ymaxOk && a.year > ymax!) return false;
      }

      return true;
    });
  }, [
    artworks,
    disabledCategories,
    disabledCommissions,
    yearMin,
    yearMax,
  ]);

  const toggleCategory = useCallback((key: string) => {
    setDisabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleCommission = useCallback((key: string) => {
    setDisabledCommissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setDisabledCategories(new Set());
    setDisabledCommissions(new Set());
    setYearMin("");
    setYearMax("");
  }, []);

  const categoriesAllOn =
    categoryOptions.length > 0 &&
    categoryOptions.every((o) => !disabledCategories.has(o.key));
  const commissionsAllOn =
    commissionOptions.length > 0 &&
    commissionOptions.every((o) => !disabledCommissions.has(o.key));

  const activeFilterCount =
    disabledCategories.size +
    disabledCommissions.size +
    (yearMin.trim() !== "" || yearMax.trim() !== "" ? 1 : 0);

  const onSelectArtwork = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const onClearSelection = useCallback(() => {
    setSelectedSlug(undefined);
  }, []);

  return (
    <div className={styles.shell}>
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
                  disabled={categoriesAllOn}
                  onClick={() => setDisabledCategories(new Set())}
                >
                  All
                </button>
                <button
                  type="button"
                  className={styles.filterLink}
                  disabled={categoryOptions.length === 0}
                  onClick={() =>
                    setDisabledCategories(new Set(categoryOptions.map((o) => o.key)))
                  }
                >
                  None
                </button>
              </div>
            </div>
            <ul className={styles.filterToggleList} aria-label="Categories">
              {categoryOptions.map((o) => {
                const on = !disabledCategories.has(o.key);
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
                  disabled={commissionsAllOn}
                  onClick={() => setDisabledCommissions(new Set())}
                >
                  All
                </button>
                <button
                  type="button"
                  className={styles.filterLink}
                  disabled={commissionOptions.length === 0}
                  onClick={() =>
                    setDisabledCommissions(new Set(commissionOptions.map((o) => o.key)))
                  }
                >
                  None
                </button>
              </div>
            </div>
            <ul className={styles.filterToggleList} aria-label="Commission">
              {commissionOptions.map((o) => {
                const on = !disabledCommissions.has(o.key);
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
