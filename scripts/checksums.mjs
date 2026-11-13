import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const names = (await readdir("release"))
  .filter((n) => /\.(exe|deb|AppImage)$/.test(n))
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
