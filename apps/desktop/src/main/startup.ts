import { app } from "electron";
import { join } from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
export async function configureStartup(enabled: boolean) {
  if (process.env.NODE_ENV === "test") return;
  if (!app.isPackaged) {
    if (enabled)
      throw Error(
        "Spustenie po prihlásení je dostupné v nainštalovanej aplikácii.",
      );
    return;
  }
  if (process.platform === "win32") {
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
    return;
  }
  if (process.platform === "linux") {
    const directory = join(app.getPath("appData"), "autostart");
    const file = join(directory, "domace-financie.desktop");
    if (!enabled) {
      await unlink(file).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      return;
    }
    await mkdir(directory, { recursive: true });
    const executable = (process.env.APPIMAGE ?? process.execPath)
      .replace(/([\\"`$])/g, "\\$1")
      .replace(/%/g, "%%");
    await writeFile(
      file,
      `[Desktop Entry]\nType=Application\nName=Domáce Financie\nExec="${executable}"\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`,
      { mode: 0o600 },
    );
    return;
  }
  if (enabled)
    throw Error("Automatický štart nie je podporovaný na tomto systéme.");
}
