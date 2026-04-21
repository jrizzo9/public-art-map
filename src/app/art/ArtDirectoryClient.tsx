"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Artwork } from "@/lib/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SortKey = "title-asc" | "year-desc";

function toNormalizedSearch(value: string): string {
  return value.trim().toLowerCase();
}

function getCategories(artworks: Artwork[]): string[] {
  const set = new Set<string>();
  for (const a of artworks) {
    const c = a.category?.trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function ArtDirectoryClient({ artworks }: { artworks: Artwork[] }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [sort, setSort] = React.useState<SortKey>("title-asc");

  const categories = React.useMemo(() => getCategories(artworks), [artworks]);
  const normalizedQuery = React.useMemo(() => toNormalizedSearch(query), [query]);

  const filtered = React.useMemo(() => {
    const q = normalizedQuery;
    const categoryFilter = category === "all" ? null : category;

    const results = artworks.filter((a) => {
      if (categoryFilter && a.category?.trim() !== categoryFilter) return false;
      if (!q) return true;

      const haystack = [
        a.title,
        a.artist,
        a.address,
        a.category,
        a.collection,
        a.commission,
        a.year != null ? String(a.year) : undefined,
      ]
        .filter(Boolean)
        .join(" • ")
        .toLowerCase();

      return haystack.includes(q);
    });

    results.sort((a, b) => {
      if (sort === "year-desc") {
        const ay = a.year ?? -Infinity;
        const by = b.year ?? -Infinity;
        if (ay !== by) return by - ay;
        return a.title.localeCompare(b.title);
      }
      return a.title.localeCompare(b.title);
    });

    return results;
  }, [artworks, normalizedQuery, category, sort]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-[220px] flex-1">
            <span className="sr-only">Search artworks</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, artist, location…"
              className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none backdrop-blur-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              inputMode="search"
              autoComplete="off"
            />
          </label>

          <label className="min-w-[180px]">
            <span className="sr-only">Filter by category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none backdrop-blur-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[160px]">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none backdrop-blur-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <option value="title-asc">A → Z</option>
              <option value="year-desc">Newest first</option>
            </select>
          </label>

          {(query || category !== "all" || sort !== "title-asc") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setSort("title-asc");
              }}
            >
              Reset
            </Button>
          )}

          <Badge variant="muted" className="ml-auto">
            {filtered.length.toLocaleString()} shown
          </Badge>
        </div>
      </div>

      {filtered.length ? (
        <section aria-label="Artwork directory">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => (
              <li key={a.slug}>
                <Card className="h-full overflow-hidden bg-card/70 backdrop-blur-sm">
                  <Link href={`/art/${a.slug}`} className="block h-full">
                    <div className="relative aspect-[16/9] w-full bg-muted">
                      {a.image ? (
                        <Image
                          src={a.image}
                          alt={a.title}
                          fill
                          sizes="(max-width: 720px) 92vw, (max-width: 1100px) 45vw, 360px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted-foreground">
                          Photo soon
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-3">
                      <CardTitle className="text-base leading-snug">{a.title}</CardTitle>
                      {(a.artist || a.year != null) && (
                        <div className="text-sm text-muted-foreground">
                          {[a.artist, a.year != null ? String(a.year) : null]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      )}
                      {a.category ? (
                        <div className="pt-1">
                          <Badge variant="muted">{a.category}</Badge>
                        </div>
                      ) : null}
                    </CardHeader>

                    {a.description ? (
                      <CardContent>
                        <p className="line-clamp-4 text-sm text-muted-foreground">
                          {a.description.slice(0, 200)}
                        </p>
                      </CardContent>
                    ) : null}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="No results" className="rounded-xl border border-border bg-background/60 p-4">
          <p className="text-sm font-medium">No matches.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search term, switch categories, or reset filters.
          </p>
        </section>
      )}
    </>
  );
}

