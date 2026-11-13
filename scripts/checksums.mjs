import { readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const names = (await readdir("release"))
  .filter((n) => n.includes(version) && /\.(exe|deb|AppImage)$/.test(n))
  .sort();
if (!names.length) throw Error("No distribution artifacts found");
const lines = [];
for (const name of names)
  lines.push(
    createHash("sha256")
      .update(await readFile("release/" + name))
      .digest("hex") +
      "  " +
      name,
  );
await writeFile("release/SHA256SUMS.txt", lines.join("\n") + "\n");

await copyFile(
  "assets/legal/THIRD_PARTY_NOTICES.txt",
  "release/THIRD_PARTY_NOTICES.txt",
);
