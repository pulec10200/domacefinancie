import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("assets/ocr", { recursive: true });
const manifest = {};
for (const lang of ["slk", "eng"]) {
  const url = `https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/${lang}.traineddata.gz`;
  const response = await globalThis.fetch(url);
  if (!response.ok) throw Error(`Language download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(`assets/ocr/${lang}.traineddata.gz`, bytes);
  manifest[lang] = {
    url,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
await writeFile("assets/ocr/manifest.json", JSON.stringify(manifest, null, 2));
