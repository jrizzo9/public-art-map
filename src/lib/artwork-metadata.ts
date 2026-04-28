import type { Artwork } from "@/lib/sheet";

const TITLE_SUFFIX = "Waco Public Art Map";

/** Visible `<title>` / social titles — bypasses root layout `title.template`. */
export function artworkDocumentTitle(artwork: Artwork): string {
  const name = artwork.title.trim();
  const artist = artwork.artist?.trim();
  if (artist) return `${name} - ${artist} - ${TITLE_SUFFIX}`;
  return `${name} - ${TITLE_SUFFIX}`;
}

/** Body text before truncation: "Category, year. Description." style. */
export function artworkMetaDescriptionFull(artwork: Artwork): string {
  const cat = artwork.category?.trim() ?? "";
  const yearOk = artwork.year != null && Number.isFinite(artwork.year);
  const yearStr = yearOk ? String(Math.round(artwork.year as number)) : "";
  const body = artwork.description?.trim() ?? "";

  let prefix = "";
  if (cat && yearStr) prefix = `${cat}, ${yearStr}.`;
  else if (cat) prefix = `${cat}.`;
  else if (yearStr) prefix = `${yearStr}.`;

  if (prefix && body) return `${prefix} ${body}`;
  if (prefix) return prefix;
  if (body) return body;
  return `Public art in Waco — ${artwork.title.trim()}.`;
}

export function truncateMetaDescription(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 3)).trimEnd()}...`;
}
