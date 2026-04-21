import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
import { getAllSlugs } from "@/lib/sheet";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  let slugs: string[] = [];
  try {
    slugs = await getAllSlugs();
  } catch {
    slugs = [];
  }
  const lastMod = new Date();
  return [
    { url: base, lastModified: lastMod, changeFrequency: "weekly", priority: 1 },
    ...slugs.map((slug) => ({
      url: `${base}/art/${slug}`,
      lastModified: lastMod,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
