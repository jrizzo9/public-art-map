import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
          Creative Waco{" "}
          <span className="font-normal text-zinc-600">Public Art Map</span>
        </Link>
      </div>
    </header>
  );
}
