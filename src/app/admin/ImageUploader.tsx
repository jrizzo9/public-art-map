"use client";

import { useEffect, useMemo, useState } from "react";

type UploadResult =
  | { ok: true; cloudinary?: { secure_url?: string; public_id?: string } }
  | { ok: false; error?: string }
  | null;

export function ImageUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string>("");

  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setResult("");
    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/admin/cloudinary", {
        method: "POST",
        body: fd,
      });
      const text = await res.text();
      setResult(text);

      // convenience: copy URL if present
      try {
        const parsed = JSON.parse(text) as UploadResult;
        const url =
          parsed && parsed.ok ? parsed.cloudinary?.secure_url : undefined;
        if (url) await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>Image</label>
        <input
          type="file"
          accept="image/*,.heic,.heif"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Preview"
          style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
        />
      ) : null}

      <button
        onClick={upload}
        disabled={!file || uploading}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
          background: "color-mix(in oklch, var(--primary) 20%, var(--card))",
          color: "var(--foreground)",
          fontWeight: 800,
          fontSize: 13,
          cursor: !file || uploading ? "not-allowed" : "pointer",
        }}
      >
        {uploading ? "Uploading…" : "Convert + upload to Cloudinary"}
      </button>

      {result ? (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 10,
            border: "1px solid color-mix(in oklch, var(--border) 72%, transparent)",
            background: "color-mix(in oklch, var(--muted) 42%, transparent)",
            overflowX: "auto",
            fontSize: 12,
          }}
        >
          {result}
        </pre>
      ) : null}

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        We auto-resize + compress for web. If the upload succeeds, the Cloudinary URL is
        copied to your clipboard.
      </div>
    </div>
  );
}
