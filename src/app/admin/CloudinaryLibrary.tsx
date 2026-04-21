"use client";

import { useEffect, useMemo, useState } from "react";

type Resource = {
  public_id: string;
  secure_url?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  created_at?: string;
};

type ApiResponse =
  | {
      ok: true;
      resources: Resource[];
      next_cursor?: string;
      prefix?: string | null;
    }
  | { ok: false; error?: string };

function formatBytes(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

export function CloudinaryLibrary() {
  const [items, setItems] = useState<Resource[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<string>("");

  const canLoadMore = useMemo(() => cursor !== "", [cursor]);

  async function loadNext(reset = false) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "30");
      const nextCursor = reset ? null : cursor;
      if (nextCursor) qs.set("cursor", nextCursor);
      const res = await fetch(`/api/admin/cloudinary/library?${qs.toString()}`, {
        method: "GET",
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!json || !("ok" in json)) throw new Error("Invalid response");
      if (!json.ok) throw new Error(json.error || "Failed to load library");

      setItems((prev) => (reset ? json.resources : [...prev, ...json.resources]));
      setCursor(json.next_cursor ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }

  async function copy(url?: string) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNext(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => loadNext(true)}
          disabled={loading}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
            background: "color-mix(in oklch, var(--muted) 42%, transparent)",
            color: "var(--foreground)",
            fontWeight: 800,
            fontSize: 13,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Refresh
        </button>
        {error ? <div style={{ fontSize: 12, color: "var(--destructive)" }}>{error}</div> : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        }}
      >
        {items.map((r) => (
          <button
            key={r.public_id}
            onClick={() => copy(r.secure_url)}
            title="Click to copy URL"
            style={{
              textAlign: "left",
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
              background: "color-mix(in oklch, var(--card) 88%, transparent)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <div
              style={{
                aspectRatio: "4 / 3",
                background: "color-mix(in oklch, var(--muted) 42%, transparent)",
              }}
            >
              {r.secure_url ? (
                <img
                  src={r.secure_url}
                  alt={r.public_id}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="lazy"
                />
              ) : null}
            </div>
            <div style={{ padding: 10, display: "grid", gap: 4 }}>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  opacity: 0.9,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.public_id}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {r.width && r.height ? `${r.width}×${r.height}` : ""}
                {r.bytes ? ` · ${formatBytes(r.bytes)}` : ""}
                {r.format ? ` · ${r.format}` : ""}
              </div>
              {copied === r.secure_url ? (
                <div style={{ fontSize: 12, opacity: 0.85 }}>Copied URL</div>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => loadNext(false)}
          disabled={loading || !canLoadMore}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
            background: "color-mix(in oklch, var(--muted) 42%, transparent)",
            color: "var(--foreground)",
            fontWeight: 800,
            fontSize: 13,
            cursor: loading || !canLoadMore ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Click any image card to copy its Cloudinary URL.
        </div>
      </div>
    </div>
  );
}

