"use client";

import type { Artwork } from "@/types/artwork";
import { ArtMap } from "@/components/ArtMap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

export function HomeExplorer({ artworks }: { artworks: Artwork[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<string | "all">("all");

  const onSelectSlug = useCallback(
    (slug: string) => {
      router.push(`/art/${slug}`);
    },
    [router],
  );

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const a of artworks) {
      if (a.category?.trim()) s.add(a.category.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [artworks]);

  const filtered = useMemo(() => {
    if (category === "all") return artworks;
    return artworks.filter(
      (a) => (a.category ?? "").toLowerCase() === category.toLowerCase(),
    );
  }, [artworks, category]);

  if (artworks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-zinc-900">No artwork data yet</p>
        <p className="mt-2 text-sm text-zinc-600">
          Add a published Google Sheet CSV URL as <code className="rounded bg-zinc-100 px-1.5 py-0.5">SHEET_CSV_URL</code>{" "}
          in Vercel, then redeploy or wait for cache to refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
      <aside className="flex w-full flex-col border-zinc-200 lg:w-[min(100%,380px)] lg:border-r lg:min-h-[calc(100vh-73px)]">
        <div className="border-b border-zinc-100 p-4">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as string | "all")}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-emerald-500 focus:ring-2"
          >
            <option value="all">All ({artworks.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {filtered.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/art/${a.slug}`}
                className="flex flex-col gap-0.5 rounded-lg px-3 py-3 text-left text-sm hover:bg-zinc-50"
              >
                <span className="font-medium text-zinc-900">{a.title}</span>
                {a.address ? <span className="text-xs text-zinc-500">{a.address}</span> : null}
              </Link>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-zinc-500">No items in this category.</li>
          ) : null}
        </ul>
      </aside>
      <div className="min-h-[420px] flex-1 bg-zinc-50 p-4 lg:min-h-[calc(100vh-73px)]">
        <ArtMap artworks={filtered} onSelectSlug={onSelectSlug} className="h-[min(70vh,640px)] w-full rounded-lg lg:h-[min(calc(100vh-105px),900px)]" />
      </div>
    </div>
  );
}
