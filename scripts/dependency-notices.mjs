import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const sections = [
  "THIRD-PARTY NOTICES\nGenerated from the pinned production dependency tree. The application has no commercial license grant. Each dependency retains its own license. Electron additionally ships LICENSE and LICENSES.chromium.html beside the executable. OCR assets: Apache-2.0, see resources/ocr/LICENSE.\n",
];
for (const [path, entry] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!path || entry.dev) continue;
  let info;
  try {
    info = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
  } catch (e) {
    if (entry.optional && e.code === "ENOENT") continue;
    throw e;
  }
  let noticePath = path;
  if (
    info.name.startsWith("@napi-rs/canvas-") &&
    info.repository?.url === "git+https://github.com/Brooooooklyn/canvas.git"
  )
    noticePath = "node_modules/@napi-rs/canvas";
  const files = (await readdir(noticePath)).filter((n) =>
    /^(licen[cs]e|copying|notice)([._-]|$)/i.test(n),
  );
  let section = `\n===== ${info.name}@${info.version} =====\nLicense: ${typeof info.license === "string" ? info.license : JSON.stringify(info.license ?? "See package notices")}\n`;
  for (const file of files) {
    try {
      section +=
        `\n--- ${file} ---\n` +
        (await readFile(join(noticePath, file), "utf8"));
    } catch (e) {
      if (e.code !== "EISDIR") throw e;
    }
  }
  if (!files.length) {
    if (info.name !== "tr46" || info.version !== "0.0.3")
      throw Error("Missing license notice for " + info.name);
    section +=
      "The published package declares MIT but contains no full license text; its exact upstream commit also has no license file. Source: https://github.com/jsdom/tr46/tree/a8009f9ce80ff5dbe71dd71e203afe4e4c878d28 . Review this upstream omission before commercial redistribution.\n";
  }
  sections.push(section);
}
await mkdir("assets/legal", { recursive: true });
await writeFile("assets/legal/THIRD_PARTY_NOTICES.txt", sections.join("\n"));
