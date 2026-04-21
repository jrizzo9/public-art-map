"use client";

import { useCallback, useState } from "react";
import styles from "./submit.module.css";

type PrepareOk = {
  ok: true;
  token: string;
  submissionId: string;
  slots: Array<{
    index: number;
    uploadUrl: string;
    fields: Record<string, string>;
    expectedPublicId: string;
  }>;
};

type CloudinaryUploadJson = {
  public_id?: string;
  secure_url?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  error?: { message?: string };
};

const MAX_IMAGE_COUNT = 8;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPT_ATTR =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const LOOKS_IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

function validatePhotoFile(f: File): string | null {
  if (f.size > MAX_IMAGE_BYTES) {
    return `“${f.name}” is larger than 10 MB.`;
  }
  if (f.type === "image/svg+xml") {
    return "SVG images are not accepted.";
  }
  if (ALLOWED_IMAGE_TYPES.has(f.type)) return null;
  if ((!f.type || f.type === "") && LOOKS_IMAGE_EXT.test(f.name)) return null;
  if (f.type.startsWith("image/")) {
    return `“${f.name}” is not an accepted image type (JPEG, PNG, WebP, GIF, or HEIC).`;
  }
  return `“${f.name}” must be JPEG, PNG, WebP, GIF, or HEIC.`;
}

export function SubmitArtPanel() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ submissionId: string } | null>(null);

  const onFiles = useCallback((list: FileList | null) => {
    setError(null);
    setDone(null);
    if (!list?.length) {
      setFiles([]);
      return;
    }
    const chosen = Array.from(list);
    const next: File[] = [];
    for (const f of chosen) {
      const msg = validatePhotoFile(f);
      if (msg) {
        setError(msg);
        setFiles([]);
        return;
      }
      next.push(f);
      if (next.length >= MAX_IMAGE_COUNT) break;
    }
    setFiles(next);
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    setDone(null);

    if (honeypot.trim()) {
      setError("Something went wrong.");
      return;
    }

    if (!email.trim() || !title.trim() || !description.trim()) {
      setError("Email, title, and description are required.");
      return;
    }

    if (files.length === 0) {
      setError("Add at least one photo.");
      return;
    }

    for (const f of files) {
      const msg = validatePhotoFile(f);
      if (msg) {
        setError(msg);
        return;
      }
    }

    setBusy(true);
    try {
      const prepRes = await fetch("/api/submissions/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          title: title.trim(),
          description: description.trim(),
          photoCount: files.length,
          company: "",
          artist: artist.trim() || undefined,
          year: year.trim() || undefined,
          address: address.trim() || undefined,
          category: category.trim() || undefined,
          phone: phone.trim() || undefined,
          artworkUrl: artworkUrl.trim() || undefined,
        }),
      });

      const prepJson = (await prepRes.json().catch(() => ({}))) as
        | PrepareOk
        | { ok?: false; error?: string };

      if (!prepRes.ok || !("ok" in prepJson) || prepJson.ok !== true) {
        throw new Error(
          "error" in prepJson && prepJson.error
            ? prepJson.error
            : "Could not start submission.",
        );
      }

      const { token, slots } = prepJson;

      if (slots.length !== files.length) {
        throw new Error("Session mismatch. Please try again.");
      }

      const uploads: CloudinaryUploadJson[] = [];

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const file = files[i];
        const fd = new FormData();
        for (const [k, v] of Object.entries(slot.fields)) {
          fd.append(k, v);
        }
        fd.append("file", file);

        const upRes = await fetch(slot.uploadUrl, {
          method: "POST",
          body: fd,
        });

        const upJson = (await upRes.json().catch(() => ({}))) as CloudinaryUploadJson;

        if (!upRes.ok || !upJson.public_id || !upJson.secure_url) {
          const msg =
            upJson.error?.message ||
            `Upload failed for “${file.name}”.`;
          throw new Error(msg);
        }

        if (upJson.public_id !== slot.expectedPublicId) {
          throw new Error(
            "Photo upload did not match the expected location. Please try again.",
          );
        }

        uploads.push({
          public_id: upJson.public_id,
          secure_url: upJson.secure_url,
          width: upJson.width,
          height: upJson.height,
          bytes: upJson.bytes,
          format: upJson.format,
        });
      }

      const finRes = await fetch("/api/submissions/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, uploads }),
      });

      const finJson = (await finRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        submissionId?: string;
      };

      if (!finRes.ok || !finJson.ok) {
        throw new Error(finJson.error || "Could not finalize submission.");
      }

      setDone({ submissionId: finJson.submissionId ?? prepJson.submissionId });
      setEmail("");
      setPhone("");
      setTitle("");
      setArtist("");
      setYear("");
      setDescription("");
      setAddress("");
      setCategory("");
      setArtworkUrl("");
      setFiles([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submission failed.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [
    address,
    artist,
    artworkUrl,
    category,
    description,
    email,
    files,
    honeypot,
    phone,
    title,
    year,
  ]);

  if (done) {
    return (
      <div className={styles.submitWrap}>
        <p className={styles.submitLead}>
          Thank you — your suggestion was received. We review submissions before they appear on
          the map.
        </p>
        <p className={styles.submitHint}>
          Reference ID:{" "}
          <span className={styles.submitRef}>{done.submissionId}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.submitWrap}>
      <div className={styles.hpWrap} aria-hidden="true">
        <label htmlFor="submit-company">Company</label>
        <input
          id="submit-company"
          tabIndex={-1}
          autoComplete="off"
          className={styles.input}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <div className={styles.formFields}>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="submit-title">
          Title <span aria-hidden>(required)</span>
        </label>
        <input
          id="submit-title"
          type="text"
          className={styles.input}
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-artist">
            Artist <span className={styles.optionalMark}>(optional)</span>
          </label>
          <input
            id="submit-artist"
            type="text"
            className={styles.input}
            maxLength={200}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-year">
            Year <span className={styles.optionalMark}>(optional)</span>
          </label>
          <input
            id="submit-year"
            type="text"
            className={styles.input}
            inputMode="numeric"
            maxLength={32}
            placeholder="e.g. 2019"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="submit-desc">
          Description <span aria-hidden>(required)</span>
        </label>
        <textarea
          id="submit-desc"
          className={styles.textarea}
          required
          rows={4}
          maxLength={8000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-category">
            Category <span className={styles.optionalMark}>(optional)</span>
          </label>
          <input
            id="submit-category"
            type="text"
            className={styles.input}
            maxLength={100}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-address">
            Location <span className={styles.optionalMark}>(optional)</span>
          </label>
          <input
            id="submit-address"
            type="text"
            className={styles.input}
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="submit-artwork-url">
          Link <span className={styles.optionalMark}>(optional)</span>
        </label>
        <input
          id="submit-artwork-url"
          type="url"
          className={styles.input}
          inputMode="url"
          maxLength={500}
          placeholder="https://…"
          value={artworkUrl}
          onChange={(e) => setArtworkUrl(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-email">
            Email <span aria-hidden>(required)</span>
          </label>
          <input
            id="submit-email"
            type="email"
            className={styles.input}
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="submit-phone">
            Phone <span className={styles.optionalMark}>(optional)</span>
          </label>
          <input
            id="submit-phone"
            type="tel"
            className={styles.input}
            autoComplete="tel"
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className={styles.field}>
        <div id="submit-photos-label" className={styles.label}>
          Photos <span aria-hidden>(required)</span>
        </div>
        <div className={styles.filePick}>
          <input
            id="submit-photos"
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            className={styles.fileInputHidden}
            aria-labelledby="submit-photos-label"
            onChange={(e) => onFiles(e.target.files)}
            disabled={busy}
          />
          <label
            htmlFor="submit-photos"
            className={`${styles.filePickBtn}${busy ? ` ${styles.filePickBtnDisabled}` : ""}`}
          >
            {files.length === 0
              ? "Choose photos…"
              : `${files.length} photo${files.length === 1 ? "" : "s"} selected`}
          </label>
        </div>
        <p className={styles.submitHint}>
          Up to 8 images. JPEG, PNG, WebP, GIF, or HEIC; max 10 MB each.
        </p>
        {files.length > 0 ? (
          <ul className={styles.fileList}>
            {files.map((f) => (
              <li key={f.name + f.size}>{f.name}</li>
            ))}
          </ul>
        ) : null}
      </div>
      </div>

      {error ? (
        <p className={styles.submitError} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={() => void submit()}
        disabled={busy}
      >
        {busy ? "Sending…" : "Submit suggestion"}
      </button>
    </div>
  );
}
