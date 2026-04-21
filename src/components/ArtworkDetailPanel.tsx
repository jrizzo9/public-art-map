import type { Artwork } from "@/types/artwork";

type ArtworkDetailPanelProps = {
  artwork: Artwork;
  compact?: boolean;
};

export function ArtworkDetailPanel({ artwork, compact }: ArtworkDetailPanelProps) {
  return (
    <article className={compact ? "space-y-3" : "space-y-6"}>
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Public art</p>
        <h1
          className={
            compact ? "text-xl font-semibold tracking-tight text-zinc-900" : "text-3xl font-semibold tracking-tight text-zinc-900"
          }
        >
          {artwork.title}
        </h1>
        {artwork.address ? (
          <p className="text-sm text-zinc-600">{artwork.address}</p>
        ) : null}
        {artwork.category ? (
          <p className="text-xs font-medium text-emerald-800">{artwork.category}</p>
        ) : null}
      </header>

      {artwork.image ? (
        <div
          className={
            compact ? "relative aspect-[16/10] overflow-hidden rounded-lg bg-zinc-100" : "relative aspect-[16/10] overflow-hidden rounded-xl bg-zinc-100"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- CMS URLs are arbitrary */}
          <img
            src={artwork.image}
            alt=""
            className="h-full w-full object-cover"
            loading={compact ? "lazy" : "eager"}
          />
        </div>
      ) : null}

      {artwork.description ? (
        <div className="prose prose-zinc max-w-none prose-p:leading-relaxed">
          {artwork.description.split(/\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No description yet for this piece.</p>
      )}
    </article>
  );
}
