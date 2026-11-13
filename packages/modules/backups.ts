import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  readdir,
  lstat,
  realpath,
} from "node:fs/promises";
import { join, relative, isAbsolute, dirname } from "node:path";
import { z } from "zod";
import {
  openDatabase,
  inspectDatabase,
  type FinanceDatabase,
} from "../database";
import { relocateArchive } from "./documents";

const fileEntry = z.object({
  path: z
    .string()
    .regex(
      /^(finance\.db|documents\/Archive\/[a-f0-9]{64}\.(pdf|png|jpg|jpeg|webp))$/,
    ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().nonnegative(),
});
const manifestSchema = z.object({
  version: z.literal(2),
  createdAt: z.string().datetime(),
  files: z.array(fileEntry).min(1).max(100000),
});
async function digest(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function regularFile(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink())
    throw Error("Záloha obsahuje nepovolený typ súboru.");
  return info;
}
async function validateAncestors(root: string, file: string) {
  const parts = file.split("/");
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw Error("Záloha obsahuje nebezpečný odkaz.");
  }
}
export async function validateBackup(path: string) {
  const manifestPath = join(path, "manifest.json");
  if ((await regularFile(manifestPath)).size > 25 * 1024 * 1024)
    throw Error("Manifest je príliš veľký.");
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  const names = new Set<string>();
  for (const file of manifest.files) {
    if (names.has(file.path)) throw Error("Duplicitná cesta v zálohe.");
    names.add(file.path);
    await validateAncestors(path, file.path);
    const full = join(path, file.path);
    const info = await regularFile(full);
    if (info.size !== file.size || (await digest(full)) !== file.sha256)
      throw Error("Kontrolný súčet zálohy nesúhlasí: " + file.path);
  }
  if (!names.has("finance.db")) throw Error("V zálohe chýba databáza.");
  inspectDatabase(join(path, "finance.db"));
  return manifest;
}
export async function activeDataDirectory(root: string) {
  let pointer: string;
  try {
    pointer = await readFile(join(root, "active-profile.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return root;
    throw error;
  }
  const id = z.string().uuid().parse(JSON.parse(pointer).id);
  const path = join(root, "profiles", id);
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw Error("Neplatný dátový profil.");
  return path;
}
export class BackupService {
  constructor(
    readonly db: FinanceDatabase,
    readonly applicationRoot: string,
    readonly dataDirectory: string,
  ) {}
  async create(destination: string) {
    const source = await realpath(this.applicationRoot);
    const targetRoot = await realpath(destination);
    const rel = relative(source, targetRoot);
    if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)))
      throw Error("Vyberte zálohovací priečinok mimo aplikačných dát.");
    const id = randomUUID();
    const pending = join(targetRoot, ".domace-financie-" + id + ".incomplete");
    const complete = join(targetRoot, "domace-financie-" + id);
    await mkdir(join(pending, "documents", "Archive"), { recursive: true });
    await this.db.backup(join(pending, "finance.db"));
    const archive = join(this.dataDirectory, "documents", "Archive");
    for (const entry of await readdir(archive, { withFileTypes: true })) {
      if (
        !entry.isFile() ||
        !/^[a-f0-9]{64}\.(pdf|png|jpg|jpeg|webp)$/.test(entry.name)
      )
        throw Error("Neočakávaný súbor v archíve.");
      await regularFile(join(archive, entry.name));
      await copyFile(
        join(archive, entry.name),
        join(pending, "documents", "Archive", entry.name),
      );
    }
    const files = [];
    const paths = [
      "finance.db",
      ...(await readdir(join(pending, "documents", "Archive"))).map(
        (n) => "documents/Archive/" + n,
      ),
    ];
    for (const path of paths) {
      const full = join(pending, path);
      files.push({
        path,
        size: (await regularFile(full)).size,
        sha256: await digest(full),
      });
    }
    await writeFile(
      join(pending, "manifest.json"),
      JSON.stringify(
        { version: 2, createdAt: new Date().toISOString(), files },
        null,
        2,
      ),
    );
    await validateBackup(pending);
    await rename(pending, complete);
    return complete;
  }
  async restore(source: string) {
    const manifest = await validateBackup(source);
    const id = randomUUID();
    const profile = join(this.applicationRoot, "profiles", id);
    await mkdir(profile, { recursive: true });
    for (const file of manifest.files) {
      const target = join(profile, file.path);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(source, file.path), target);
      if ((await digest(target)) !== file.sha256)
        throw Error("Záloha sa počas kopírovania zmenila.");
    }
    const restored = openDatabase(join(profile, "finance.db"));
    try {
      await relocateArchive(restored, join(profile, "documents"));
      restored.pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      restored.close();
    }
    const temporary = join(
      this.applicationRoot,
      "active-profile-" + id + ".tmp",
    );
    await writeFile(temporary, JSON.stringify({ id }), { flag: "wx" });
    await rename(temporary, join(this.applicationRoot, "active-profile.json"));
    return profile;
  }
}
