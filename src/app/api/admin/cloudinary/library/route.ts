import { listCloudinaryImages } from "@/lib/cloudinary-admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const prefix = url.searchParams.get("prefix") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const folderPrefix = process.env.CLOUDINARY_FOLDER?.trim();
  const effectivePrefix =
    prefix?.trim() ||
    (folderPrefix ? folderPrefix.replace(/\/+$/, "") + "/" : undefined);

  const data = await listCloudinaryImages({
    nextCursor: cursor,
    maxResults: limit,
    prefix: effectivePrefix,
  });

  return Response.json({ ok: true, ...data, prefix: effectivePrefix ?? null });
}

