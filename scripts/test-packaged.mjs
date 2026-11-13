import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
const require = createRequire(import.meta.url);
if (!process.env.FINANCE_PACKAGED_EXECUTABLE) {
  throw new Error(
    "Set FINANCE_PACKAGED_EXECUTABLE to the built application executable; this command never substitutes development Electron.",
  );
}
const result = spawnSync(
  process.execPath,
  [require.resolve("@playwright/test/cli"), "test"],
  { stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
