import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") return fallback;
  return v;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listFilesRecursive(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const ent of entries) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile()) out.push(p);
    }
  }
  return out;
}

function isImagePath(p) {
  const ext = path.extname(p).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".heic", ".heif"].includes(
    ext
  );
}

function sipsHeicToJpeg({ inPath, outPath, maxDim }) {
  // macOS-only fallback for HEIC/HEIF if sharp can't decode.
  const args = [];
  if (maxDim && Number.isFinite(maxDim) && maxDim > 0) {
    args.push("-Z", String(Math.floor(maxDim)));
  }
  args.push("-s", "format", "jpeg", inPath, "--out", outPath);
  const r = spawnSync("sips", args, { stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`sips failed: ${r.stderr || r.stdout || `exit ${r.status}`}`);
  }
}

async function processOne({
  inPath,
  outDir,
  maxDim,
  webpQuality,
  jpegQuality,
  skipExisting,
}) {
  const base = path.basename(inPath, path.extname(inPath));
  const outWebp = path.join(outDir, `${base}.webp`);
  const outJpg = path.join(outDir, `${base}.jpg`);

  if (skipExisting && fs.existsSync(outWebp) && fs.existsSync(outJpg)) {
    return { status: "skipped", outWebp, outJpg };
  }

  ensureDir(outDir);

  const pipeline = async (input) => {
    const img = sharp(input, { failOn: "none" }).rotate();
    const meta = await img.metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    const shouldResize = maxDim && (width > maxDim || height > maxDim);
    const resized = shouldResize
      ? img.resize({
          width: width >= height ? maxDim : undefined,
          height: height > width ? maxDim : undefined,
          fit: "inside",
          withoutEnlargement: true,
        })
      : img;

    await resized
      .clone()
      .webp({ quality: webpQuality, effort: 5 })
      .toFile(outWebp);

    await resized
      .clone()
      .jpeg({
        quality: jpegQuality,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: "4:2:0",
      })
      .toFile(outJpg);
  };

  try {
    await pipeline(inPath);
    return { status: "ok", outWebp, outJpg };
  } catch (e) {
    const ext = path.extname(inPath).toLowerCase();
    if (ext === ".heic" || ext === ".heif") {
      const tmpJpg = path.join(outDir, `${base}.__tmp__.jpg`);
      sipsHeicToJpeg({ inPath, outPath: tmpJpg, maxDim });
      await pipeline(tmpJpg);
      fs.rmSync(tmpJpg, { force: true });
      return { status: "ok", outWebp, outJpg, usedSips: true };
    }
    throw e;
  }
}

async function main() {
  const inDir = path.resolve(env("IN_DIR", "downloads/drive-photos"));
  const outDir = path.resolve(env("OUT_DIR", "downloads/drive-photos-web"));
  const maxDim = Number(env("MAX_DIM", "2400"));
  const webpQuality = Math.max(1, Math.min(100, Number(env("WEBP_QUALITY", "78")) || 78));
  const jpegQuality = Math.max(1, Math.min(100, Number(env("JPEG_QUALITY", "82")) || 82));
  const skipExisting = env("SKIP_EXISTING", "true") !== "false";

  if (!fs.existsSync(inDir)) {
    throw new Error(`Missing IN_DIR: ${inDir}`);
  }
  ensureDir(outDir);

  const files = listFilesRecursive(inDir).filter(isImagePath);
  if (files.length === 0) {
    console.log(`No images found in ${inDir}`);
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let usedSips = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const name = path.basename(f);
    try {
      const r = await processOne({
        inPath: f,
        outDir,
        maxDim,
        webpQuality,
        jpegQuality,
        skipExisting,
      });
      if (r.status === "skipped") skipped++;
      else ok++;
      if (r.usedSips) usedSips++;
      console.log(`[${i + 1}/${files.length}] ${r.status} ${name}`);
    } catch (e) {
      failed++;
      console.log(`[${i + 1}/${files.length}] error ${name}: ${e?.message || e}`);
    }
  }

  console.log(
    `\nDone. ok=${ok} skipped=${skipped} failed=${failed} out=${outDir}${
      usedSips ? ` (heic via sips: ${usedSips})` : ""
    }`
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});

