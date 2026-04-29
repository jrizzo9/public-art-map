"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Artwork } from "@/lib/sheet";
import styles from "./map-info-editor.module.css";

type LocationMode = "address" | "coordinates";

type Draft = {
  slug: string;
  title: string;
  artist: string;
  year: string;
  address: string;
  lat: string;
  lng: string;
  image: string;
  description: string;
  category: string;
  commission: string;
  collection: string;
};

function artworkToDraft(a: Artwork): Draft {
  return {
    slug: a.slug,
    title: a.title,
    artist: a.artist ?? "",
    year: a.year != null ? String(a.year) : "",
    address: a.address ?? "",
    lat: Number.isFinite(a.lat) ? String(a.lat) : "",
    lng: Number.isFinite(a.lng) ? String(a.lng) : "",
    image: a.image ?? "",
    description: a.description ?? "",
    category: a.category ?? "",
    commission: a.commission ?? "",
    collection: a.collection ?? "",
  };
}

function deriveLocationMode(d: Draft): LocationMode {
  const lat = d.lat.trim();
  const lng = d.lng.trim();
  if (lat && lng) return "coordinates";
  return "address";
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.slug === b.slug &&
    a.title.trim() === b.title.trim() &&
    a.artist.trim() === b.artist.trim() &&
    a.year.trim() === b.year.trim() &&
    a.address.trim() === b.address.trim() &&
    a.lat.trim() === b.lat.trim() &&
    a.lng.trim() === b.lng.trim() &&
    a.image.trim() === b.image.trim() &&
    a.description.trim() === b.description.trim() &&
    a.category.trim() === b.category.trim() &&
    a.commission.trim() === b.commission.trim() &&
    a.collection.trim() === b.collection.trim()
  );
}

function ImageUrlField({
  value,
  onChange,
  slug,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  slug: string;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  const trimmed = value.trim();
  const previewOk = /^https?:\/\//i.test(trimmed);

  /* eslint-disable react-hooks/set-state-in-effect -- reset preview state when URL changes */
  useEffect(() => {
    setPreviewBroken(false);
    setUploadErr(null);
  }, [trimmed]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "artwork";
      fd.append("publicId", `map-admin-${safeSlug}`);
      const res = await fetch("/api/admin/cloudinary", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        cloudinary?: { secure_url?: string };
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `Upload failed (${res.status}).`);
      }
      const url = json.cloudinary?.secure_url;
      if (!url) throw new Error("No image URL returned.");
      onChange(url);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.imageUrlField}>
      <span className={styles.fieldLabel}>Image</span>
      <div className={styles.imagePreviewRow}>
        <div className={styles.imagePreviewFrame}>
          {previewOk && !previewBroken ? (
            <img
              src={trimmed}
              alt=""
              className={styles.imagePreviewImg}
              onError={() => setPreviewBroken(true)}
            />
          ) : previewOk && previewBroken ? (
            <span className={styles.imagePreviewBroken}>Preview unavailable</span>
          ) : (
            <span className={styles.imagePreviewEmpty}>Paste a URL below or upload a file</span>
          )}
        </div>
        <div className={styles.imageUrlActions}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.heic"
            className={styles.visuallyHiddenInput}
            tabIndex={-1}
            onChange={handleFile}
            aria-label="Choose image file to upload"
          />
          <button
            type="button"
            className={styles.replaceImageBtn}
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Replace image…"}
          </button>
          {uploadErr ? <p className={styles.uploadErr}>{uploadErr}</p> : null}
        </div>
      </div>
      <label className={styles.fieldWrap}>
        <span className={styles.fieldLabel}>URL</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className={styles.inputBase}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
    </div>
  );
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
    <label className={styles.fieldWrap}>
      <span className={styles.fieldLabel}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
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

export function MapInfoEditor({ initialArtworks }: { initialArtworks: Artwork[] }) {
  const [artworks, setArtworks] = useState<Artwork[]>(initialArtworks);
  const firstSlug = initialArtworks[0]?.slug ?? "";
  const [selectedSlug, setSelectedSlug] = useState(firstSlug);
  const [baseline, setBaseline] = useState<Draft | null>(() =>
    initialArtworks[0] ? artworkToDraft(initialArtworks[0]) : null,
  );
  const [draft, setDraft] = useState<Draft | null>(() =>
    initialArtworks[0] ? artworkToDraft(initialArtworks[0]) : null,
  );
  const [locationMode, setLocationMode] = useState<LocationMode>(() =>
    initialArtworks[0] ? deriveLocationMode(artworkToDraft(initialArtworks[0])) : "address",
  );

  const [query, setQuery] = useState("");
  /** Artwork picker list is collapsed by default so the editor stays primary. */
  const [listOpen, setListOpen] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err" | "muted"; text: string } | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artworks;
    return artworks.filter((a) => {
      const hay = [
        a.title,
        a.artist ?? "",
        a.address ?? "",
        a.slug,
        a.category ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [artworks, query]);

  const selected = useMemo(
    () => artworks.find((a) => a.slug === selectedSlug) ?? null,
    [artworks, selectedSlug],
  );

  const dirty = Boolean(draft && baseline && !draftsEqual(draft, baseline));

  async function refreshArtworks(): Promise<Artwork[]> {
    const res = await fetch("/api/artworks?limit=10000");
    const json = (await res.json()) as { data?: Artwork[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? "Failed to load artworks.");
    const next = json.data ?? [];
    setArtworks(next);
    return next;
  }

  function select(slug: string) {
    const item = artworks.find((a) => a.slug === slug);
    if (!item) return;
    const d = artworkToDraft(item);
    setSelectedSlug(slug);
    setBaseline(d);
    setDraft({ ...d });
    setLocationMode(deriveLocationMode(d));
    setStatus(null);
    setListOpen(false);
  }

  function setMode(next: LocationMode) {
    if (!draft) return;
    setLocationMode(next);
    if (next === "address") {
      setDraft((d) => (d ? { ...d, lat: "", lng: "" } : d));
    } else {
      setDraft((d) => (d ? { ...d, address: "" } : d));
    }
  }

  function handleReset() {
    if (!baseline) return;
    setDraft({ ...baseline });
    setLocationMode(deriveLocationMode(baseline));
    setStatus(null);
  }

  if (!artworks.length) {
    return (
      <div className={styles.emptyState}>
        No artworks loaded. Check your configured data provider env (sheet CSV or Airtable).
      </div>
    );
  }

  return (
    <div className={styles.editorShell}>
      <aside className={styles.listAside}>
        <div className={styles.listAsideBar}>
          <button
            type="button"
            className={styles.listToggleBtn}
            aria-expanded={listOpen}
            onClick={() => setListOpen((o) => !o)}
          >
            <span className={styles.listToggleLabel}>
              {listOpen ? "Hide artwork list" : "Browse artworks"}
            </span>
            <span className={styles.listToggleMeta} title={selected?.title ?? undefined}>
              {artworks.length.toLocaleString()} · {selected?.title ?? "—"}
            </span>
          </button>
        </div>
        {listOpen ? (
          <>
            <div className={styles.listSearch}>
              <label className={styles.fieldWrap}>
                <span className={styles.fieldLabel}>Search</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Title, artist, address…"
                  className={styles.inputBase}
                />
              </label>
            </div>
            <div className={styles.listScroll}>
              {filtered.length ? (
                filtered.map((a) => {
                  const active = a.slug === selectedSlug;
                  return (
                    <button
                      key={a.slug}
                      type="button"
                      className={styles.listBtn}
                      data-active={active ? "true" : "false"}
                      onClick={() => select(a.slug)}
                    >
                      <div className={styles.listTitle}>{a.title}</div>
                      <div className={styles.listMeta}>
                        {[a.artist, a.year != null ? String(a.year) : null].filter(Boolean).join(" · ") ||
                          "—"}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className={styles.statusMuted}>No matches.</div>
              )}
            </div>
          </>
        ) : null}
      </aside>

      <section className={styles.editorPanel} aria-label="Editor">
        <div className={styles.editorHeader}>
          <div className={styles.editorTitleBlock}>
            <div className={styles.editorLabel}>Selected</div>
            <div className={styles.editorSelectedTitle}>{selected?.title ?? "—"}</div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.resetBtn}
              disabled={!draft || !dirty}
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </div>

        {draft ? (
          <>
            <div>
              <span className={styles.fieldLabel}>Slug (read-only)</span>
              <p className={styles.slugReadonly}>{draft.slug}</p>
            </div>

            <div className={styles.formFields}>
              <div className={styles.formRow2}>
                <Field
                  label="Title"
                  value={draft.title}
                  onChange={(v) => setDraft((d) => (d ? { ...d, title: v } : d))}
                  placeholder="Artwork title"
                />
                <Field
                  label="Artist"
                  value={draft.artist}
                  onChange={(v) => setDraft((d) => (d ? { ...d, artist: v } : d))}
                  placeholder="Artist name"
                />
              </div>
              <div className={styles.formRow2}>
                <Field
                  label="Year"
                  value={draft.year}
                  onChange={(v) => setDraft((d) => (d ? { ...d, year: v } : d))}
                  placeholder="YYYY"
                />
                <Field
                  label="Category"
                  value={draft.category}
                  onChange={(v) => setDraft((d) => (d ? { ...d, category: v } : d))}
                  placeholder="Murals, Sculptures, …"
                />
              </div>
              <div className={styles.formRow2}>
                <Field
                  label="Collection"
                  value={draft.collection}
                  onChange={(v) => setDraft((d) => (d ? { ...d, collection: v } : d))}
                  placeholder="Collection name"
                />
                <Field
                  label="Commissioned by"
                  value={draft.commission}
                  onChange={(v) => setDraft((d) => (d ? { ...d, commission: v } : d))}
                  placeholder="Commissioning body"
                />
              </div>

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
                <p className={styles.locationHint}>Switching mode clears the other field.</p>

                {locationMode === "address" ? (
                  <Field
                    label="Street address"
                    value={draft.address}
                    onChange={(v) => setDraft((d) => (d ? { ...d, address: v } : d))}
                    placeholder="123 Example St, Waco, TX"
                  />
                ) : (
                  <div className={styles.coordsRow}>
                    <Field
                      label="Latitude"
                      value={draft.lat}
                      onChange={(v) => setDraft((d) => (d ? { ...d, lat: v } : d))}
                      placeholder="31.55"
                    />
                    <Field
                      label="Longitude"
                      value={draft.lng}
                      onChange={(v) => setDraft((d) => (d ? { ...d, lng: v } : d))}
                      placeholder="-97.14"
                    />
                  </div>
                )}
              </div>

              <ImageUrlField
                slug={draft.slug}
                disabled={false}
                value={draft.image}
                onChange={(v) => setDraft((d) => (d ? { ...d, image: v } : d))}
              />

              <Field
                label="Description"
                value={draft.description}
                onChange={(v) => setDraft((d) => (d ? { ...d, description: v } : d))}
                placeholder="Short blurb for the map popup/details."
                multiline
              />

              {status ? (
                <p
                  className={
                    status.type === "ok"
                      ? styles.statusOk
                      : status.type === "err"
                        ? styles.statusErr
                        : styles.statusMuted
                  }
                >
                  {status.text}
                </p>
              ) : null}
              <p className={styles.statusMuted}>Admin saving is disabled. Airtable form workflow is the source of truth.</p>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
