import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg flex-1 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">Page not found</h1>
      <p className="mt-2 text-zinc-600">That artwork or page does not exist.</p>
      <Link
        href="/"
        className="mt-6 inline-block font-medium text-emerald-800 underline decoration-emerald-800/30 hover:decoration-emerald-800"
      >
        Back to map
      </Link>
    </div>
  );
}
