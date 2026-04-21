import sharp from "sharp";
import { uploadToCloudinary } from "@/lib/cloudinary";

function jsonError(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

function asString(v: FormDataEntryValue | null): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return "";
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Expected multipart/form-data", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Missing file", 400);

  const folder = asString(form.get("folder")) || undefined;
  const publicId = asString(form.get("publicId")) || undefined;

  // Opinionated defaults: good visual quality without huge files.
  // - 2200px max dimension covers most web uses (retina-friendly).
  // - Quality 80 is a good size/quality tradeoff for photos.
  const maxDim = 2200;
  const quality = 80;

  const inBuf = Buffer.from(await file.arrayBuffer());
  const beforeBytes = inBuf.byteLength;

  let pipeline = sharp(inBuf, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata().catch(() => null);
  const w = meta?.width;
  const h = meta?.height;
  pipeline = pipeline.resize({
    width: w && h && w >= h ? maxDim : undefined,
    height: w && h && h > w ? maxDim : undefined,
    fit: "inside",
    withoutEnlargement: true,
  });

  const outBuf = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  const outBytes = new Uint8Array(outBuf);

  const uploaded = await uploadToCloudinary({
    file: new Blob([outBytes], { type: "image/jpeg" }),
    filename: (file.name || "upload").replace(/\.[^.]+$/, "") + ".jpg",
    folder,
    publicId,
  });

  return Response.json({
    ok: true,
    input: {
      name: file.name,
      type: file.type,
      bytes: beforeBytes,
      width: w ?? null,
      height: h ?? null,
    },
    output: {
      type: "image/jpeg",
      bytes: outBuf.byteLength,
      maxDim,
      quality,
    },
    cloudinary: uploaded,
  });
}

