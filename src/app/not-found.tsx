import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg flex-1 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        That artwork or page does not exist.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block font-medium text-primary underline underline-offset-4 hover:opacity-90"
        transitionTypes={["nav-back"]}
      >
        Back to map
      </Link>
    </div>
  );
}
