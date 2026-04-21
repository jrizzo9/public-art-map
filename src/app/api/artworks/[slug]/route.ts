import { getArtworkBySlug } from "@/lib/sheet";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const artwork = await getArtworkBySlug(slug);

  if (!artwork) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: artwork });
}

