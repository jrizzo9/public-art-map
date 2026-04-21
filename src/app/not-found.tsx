import Link from "next/link";
import { SiteBrandBar } from "@/components/SiteBrandBar";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteBrandBar titleAs="p" />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 pb-20 pt-[max(4rem,calc(env(safe-area-inset-top)+3rem))] text-center">
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
    </div>
  );
}
