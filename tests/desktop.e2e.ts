import { _electron as electron, test, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("creates an account and recognizes an offline document in the desktop UI", async () => {
  const root = await mkdtemp(join(tmpdir(), "finance-e2e-"));
  const executablePath = process.env.FINANCE_PACKAGED_EXECUTABLE;
  const app = await electron.launch({
    executablePath,
    args: [
      ...(executablePath ? [] : ["."]),
      "--ozone-platform=x11",
      "--user-data-dir=" + root,
    ],
    env: { ...process.env, NODE_ENV: "test", FINANCE_TEST_DATA: root },
  });
  try {
    expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(
      Boolean(executablePath),
    );
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
    const fixture = join(process.cwd(), "tests", "fixtures", "receipt.png");
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, fixture);
    await page.getByRole("button", { name: "Dokumenty", exact: true }).click();
    await page
      .getByRole("button", { name: "Importovať dokument", exact: true })
      .click();
    await expect(
      page.getByText("Spracovanie: Čaká na kontrolu", { exact: false }),
    ).toBeVisible({ timeout: 25000 });
    await expect(page.locator("pre")).toContainText("12.34");
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
