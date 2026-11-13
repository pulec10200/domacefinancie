import { _electron as electron, test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("creates an account through the sandboxed desktop UI", async () => {
  const root = await mkdtemp(join(tmpdir(), "finance-e2e-"));
  const app = await electron.launch({
    args: [".", "--ozone-platform=x11", "--user-data-dir=" + root],
    env: { ...process.env, NODE_ENV: "test", FINANCE_TEST_DATA: root },
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Prehľad", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Účty", exact: true }).click();
    await page.getByLabel("Názov", { exact: true }).fill("Testovací účet");
    await page.getByLabel("Počiatočný zostatok v EUR").fill("123,45");
    await page.getByRole("button", { name: "Pridať účet" }).click();
    await expect(
      page.getByText("Testovací účet", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("123,45", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => typeof (window as any).require)).toBe(
      "undefined",
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
