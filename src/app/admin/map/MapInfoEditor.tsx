"use client";

import { useMemo, useState } from "react";
import styles from "./map-info-editor.module.css";

type LocationMode = "address" | "coordinates";

type MapItem = {
  id: string;
  title: string;
  artist: string;
  year?: string;
  address?: string;
  lat?: string;
  lng?: string;
  imageUrl?: string;
  description?: string;
};

/** Demo rows: uses address alone or coordinates alone (not both). */
const SEED_ITEMS: MapItem[] = [
  {
    id: "seed-1",
    title: "Example mural",
    artist: "Artist name",
    year: "2024",
    address: "123 Example St, Waco, TX",
    imageUrl: "https://res.cloudinary.com/example/image.jpg",
    description: "Short description shown in the map popup / details panel.",
  },
  {
    id: "seed-2",
    title: "Example sculpture",
    artist: "Another artist",
    year: "2019",
    lat: "31.5512",
    lng: "-97.1379",
    imageUrl: "",
    description: "",
  },
];

function deriveLocationMode(item: MapItem): LocationMode {
  const lat = item.lat?.trim();
  const lng = item.lng?.trim();
  if (lat && lng) return "coordinates";
  return "address";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className={styles.fieldLabel}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className={`${styles.inputBase} ${styles.textareaBase}`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={styles.inputBase}
        />
      )}
    </label>
  );
}

export function MapInfoEditor() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(SEED_ITEMS[0]?.id ?? "");
  const [draft, setDraft] = useState<MapItem>(SEED_ITEMS[0] ?? ({} as MapItem));
  const [locationMode, setLocationMode] = useState<LocationMode>(() =>
    SEED_ITEMS[0] ? deriveLocationMode(SEED_ITEMS[0]) : "address"
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEED_ITEMS;
    return SEED_ITEMS.filter((i) => {
      const hay = `${i.title} ${i.artist} ${i.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const selected = useMemo(
    () => SEED_ITEMS.find((i) => i.id === selectedId) ?? null,
    [selectedId]
  );

  function select(id: string) {
    setSelectedId(id);
    const item = SEED_ITEMS.find((i) => i.id === id);
    if (item) {
      setDraft(item);
      setLocationMode(deriveLocationMode(item));
    }
  }

  function setMode(next: LocationMode) {
    setLocationMode(next);
    if (next === "address") {
      setDraft((d) => ({ ...d, lat: "", lng: "" }));
    } else {
      setDraft((d) => ({ ...d, address: "" }));
    }
  }

  return (
    <div className={styles.editorShell}>
        <aside
          style={{
            border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
            borderRadius: 16,
            background: "color-mix(in oklch, var(--muted) 22%, transparent)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid color-mix(in oklch, var(--border) 55%, transparent)" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                Search artworks
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, artist, address…"
                className={styles.inputBase}
              />
            </label>
          </div>
          <div style={{ display: "grid", padding: 8, gap: 6 }}>
            {filtered.length ? (
              filtered.map((i) => {
                const active = i.id === selectedId;
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => select(i.id)}
                    style={{
                      textAlign: "left",
                      padding: "10px 10px",
                      borderRadius: 12,
                      border: active
                        ? "1px solid color-mix(in oklch, var(--primary) 55%, var(--border))"
                        : "1px solid color-mix(in oklch, var(--border) 55%, transparent)",
                      background: active
                        ? "color-mix(in oklch, var(--primary) 10%, var(--card))"
                        : "color-mix(in oklch, var(--card) 80%, transparent)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{i.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {i.artist}
                      {i.year ? ` · ${i.year}` : ""}
                    </div>
                  </button>
                );
              })
            ) : (
              <div style={{ padding: 10, fontSize: 12, opacity: 0.75 }}>
                No matches.
              </div>
            )}
          </div>
        </aside>

        <section
          style={{
            display: "grid",
            gap: 12,
            border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
            borderRadius: 16,
            background: "color-mix(in oklch, var(--card) 92%, transparent)",
            padding: 12,
          }}
          aria-label="Editor"
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                Selected
              </div>
              <div style={{ fontSize: 14, fontWeight: 950 }}>
                {selected ? selected.title : "—"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                disabled
                title="Wire this up to persist changes (coming soon)"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
                  background: "color-mix(in oklch, var(--primary) 20%, var(--card))",
                  color: "var(--foreground)",
                  fontWeight: 900,
                  cursor: "not-allowed",
                }}
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selected) return;
                  setDraft(selected);
                  setLocationMode(deriveLocationMode(selected));
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
                  background: "color-mix(in oklch, var(--muted) 42%, transparent)",
                  color: "var(--foreground)",
                  fontWeight: 900,
                  cursor: selected ? "pointer" : "not-allowed",
                  opacity: selected ? 1 : 0.6,
                }}
                disabled={!selected}
              >
                Reset
              </button>
            </div>
          </div>

          <div className={styles.formFields}>
            <Field
              label="Title"
              value={draft.title ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
              placeholder="Artwork title"
            />
            <Field
              label="Artist"
              value={draft.artist ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, artist: v }))}
              placeholder="Artist name"
            />
            <Field
              label="Year"
              value={draft.year ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, year: v }))}
              placeholder="YYYY"
            />

            <div className={styles.locationBlock}>
              <p className={styles.sectionLabel}>Location</p>
              <div className={styles.locationToggle} role="group" aria-label="Location type">
                <button
                  type="button"
                  data-active={locationMode === "address" ? "true" : "false"}
                  onClick={() => setMode("address")}
                >
                  Address
                </button>
                <button
                  type="button"
                  data-active={locationMode === "coordinates" ? "true" : "false"}
                  onClick={() => setMode("coordinates")}
                >
                  Latitude &amp; longitude
                </button>
              </div>
              <p className={styles.locationHint}>
                Use either a street address or coordinates—switching clears the other.
              </p>

              {locationMode === "address" ? (
                <Field
                  label="Street address"
                  value={draft.address ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, address: v }))}
                  placeholder="123 Example St, Waco, TX"
                />
              ) : (
                <div className={styles.coordsRow}>
                  <Field
                    label="Latitude"
                    value={draft.lat ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, lat: v }))}
                    placeholder="31.55"
                  />
                  <Field
                    label="Longitude"
                    value={draft.lng ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, lng: v }))}
                    placeholder="-97.14"
                  />
                </div>
              )}
            </div>

            <Field
              label="Image URL"
              value={draft.imageUrl ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, imageUrl: v }))}
              placeholder="https://…"
            />

            <Field
              label="Description"
              value={draft.description ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
              placeholder="Short blurb for the map popup/details."
              multiline
            />

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Next step: connect this UI to your map data source and enable Save.
            </div>
          </div>
        </section>
    </div>
  );
}
