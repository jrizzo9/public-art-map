import type { Artwork } from "@/lib/sheet";

export type CollectionSummary = {
  /** Display name from the sheet (trimmed), used for grouping and display. */
  name: string;
  count: number;
};

/** Unique non-empty `collection` values with artwork counts, sorted by name. */
export function getCollectionSummaries(artworks: Artwork[]): CollectionSummary[] {
  const counts = new Map<string, number>();
  for (const a of artworks) {
    const raw = a.collection?.trim();
    if (!raw) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
