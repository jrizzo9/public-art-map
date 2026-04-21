import { getArtworks } from "@/lib/sheet";

function asString(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asInt(value: string | null): number | null {
  const s = asString(value);
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = asString(url.searchParams.get("q"));
  const category = asString(url.searchParams.get("category"));
  const limit = asInt(url.searchParams.get("limit"));

  const artworks = await getArtworks();

  let filtered = artworks;
  if (category) {
    const needle = category.toLowerCase();
    filtered = filtered.filter((a) => (a.category ?? "").toLowerCase() === needle);
  }

  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((a) => {
      const haystack = [
        a.title,
        a.artist ?? "",
        a.address ?? "",
        a.category ?? "",
        a.collection ?? "",
        a.commission ?? "",
        a.description ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  if (typeof limit === "number") {
    const safeLimit = Math.max(0, Math.min(10_000, limit));
    filtered = filtered.slice(0, safeLimit);
  }

  return Response.json({
    count: filtered.length,
    data: filtered,
  });
}

