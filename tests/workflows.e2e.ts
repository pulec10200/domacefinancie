import {
  _electron as electron,
  test,
  expect,
  type ElectronApplication,
} from "@playwright/test";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { textPDF } from "./pdf-fixture";
async function launch(root: string) {
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
  expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(
    Boolean(executablePath),
  );
  return app;
}
async function choose(app: ElectronApplication, path: string) {
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
  }, path);
}
test("watches a folder, extracts and confirms an invoice, schedules a reminder, and persists it", async () => {
  test.setTimeout(60000);
  const root = await mkdtemp(join(tmpdir(), "finance-flow-"));
  const inbox = join(root, "source");
  await mkdir(inbox);
  let app = await launch(root);
  try {
    await app.evaluate(({ Notification }) => {
      Notification.isSupported = () => true;
      Notification.prototype.show = function () {
        (globalThis as any).financeNotifications =
          ((globalThis as any).financeNotifications ?? 0) + 1;
      };
    });
    let page = await app.firstWindow();
    await page.getByRole("button", { name: "Dokumenty", exact: true }).click();
    await choose(app, inbox);
    await page
      .getByRole("button", { name: "Sledovať priečinok", exact: false })
      .click();
    const today = new Date();
    const due = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    await writeFile(
      join(inbox, "synthetic-invoice.pdf"),
      textPDF(["Invoice", "TOTAL 25.00 EUR", "Due date: " + due]),
    );
    await expect(
      page.getByText("Spracovanie: Čaká na kontrolu", { exact: false }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel("Overená suma EUR")).toHaveValue("25.00");
    await expect(page.getByLabel("Splatnosť / dátum úhrady")).toHaveValue(due);
    await page.getByLabel("Popis", { exact: true }).fill("Synthetic Internet");
    await page.getByRole("button", { name: "Náhľad vedľa údajov" }).click();
    await expect(
      page.getByAltText("Originál dokumentu, strana 1"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Potvrdiť finančný záznam" })
      .click();
    await expect(
      page.getByText("Spracovanie: Potvrdené", { exact: false }),
    ).toBeVisible();
    const snapshot = await page.evaluate(() => window.finance.snapshot());
    expect(snapshot.payables).toHaveLength(1);
    expect(snapshot.monthly[0].unpaid).toBe(2500);
    await expect
      .poll(() =>
        app.evaluate(() => (globalThis as any).financeNotifications ?? 0),
      )
      .toBe(1);
    await page.getByRole("button", { name: "Prehľad", exact: true }).click();
    await expect(
      page.locator(".row").filter({ hasText: "Synthetic Internet" }),
    ).toBeVisible();
    await app.close();
    app = await launch(root);
    page = await app.firstWindow();
    await expect(
      page.locator(".row").filter({ hasText: "Synthetic Internet" }),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => window.finance.snapshot())).payables,
    ).toHaveLength(1);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("backs up through the desktop UI and restores a verified profile across restart", async () => {
  test.setTimeout(60000);
  const temp = await mkdtemp(join(tmpdir(), "finance-restore-ui-"));
  const root = join(temp, "app");
  const dest = join(temp, "backup");
  await mkdir(dest);
  let app = await launch(root);
  try {
    let page = await app.firstWindow();
    await page.evaluate(() =>
      window.finance.addAccount({
        name: "Preserved account",
        type: "cash",
        currency: "EUR",
        opening: 8765,
      }),
    );
    await page.getByRole("button", { name: "Nastavenia", exact: true }).click();
    await choose(app, dest);
    await page
      .getByRole("button", { name: "Vytvoriť zálohu", exact: true })
      .click();
    const status = page
      .getByRole("status")
      .filter({ hasText: "Záloha bola vytvorená:" });
    await expect(status).toBeVisible();
    const backup = (await status.innerText()).replace(
      "Záloha bola vytvorená: ",
      "",
    );
    expect(
      JSON.parse(await readFile(join(backup, "manifest.json"), "utf8")).version,
    ).toBe(2);
    await page.evaluate(() =>
      window.finance.addAccount({
        name: "After backup",
        type: "cash",
        currency: "EUR",
        opening: 100,
      }),
    );
    await choose(app, backup);
    await app.evaluate(({ dialog, app }) => {
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
      app.relaunch = () => {};
    });
    const closed = app.waitForEvent("close");
    await page
      .getByRole("button", { name: "Obnoviť zo zálohy…", exact: true })
      .click();
    await closed;
    app = await launch(root);
    page = await app.firstWindow();
    const snapshot = await page.evaluate(() => window.finance.snapshot());
    expect(snapshot.accounts.map((a) => a.name)).toEqual(["Preserved account"]);
    expect(snapshot.accounts[0].balance).toBe(8765);
    const pointer = JSON.parse(
      await readFile(join(root, "active-profile.json"), "utf8"),
    );
    expect(pointer.id).toBeTruthy();
  } finally {
    await app.close();
    await rm(temp, { recursive: true, force: true });
  }
});
test("configures domain records, a hierarchical budget and two independently routed AI models", async () => {
  test.setTimeout(60000);
  const root = await mkdtemp(join(tmpdir(), "finance-domain-ui-"));
  const app = await launch(root);
  try {
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "Majetok", exact: true }).click();
    await page.getByLabel("Názov majetku").fill("Synthetic flat");
    await page.getByLabel("Adresa", { exact: true }).fill("Test only");
    await page
      .getByRole("button", { name: "Uložiť majetok", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Synthetic flat", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Zmluvy a poistky", exact: true })
      .click();
    await page.getByLabel("Názov zmluvy").fill("Synthetic insurance");
    await page
      .getByLabel("Majetok", { exact: false })
      .selectOption({ label: "Synthetic flat" });
    await page
      .getByRole("button", { name: "Uložiť zmluvu", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Synthetic insurance", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kategórie", exact: true }).click();
    await page.getByLabel("Názov kategórie").fill("Home");
    await page
      .getByRole("button", { name: "Pridať kategóriu", exact: true })
      .click();
    await expect(
      page.locator(".row").filter({ hasText: "Home" }),
    ).toBeVisible();
    await page.getByLabel("Názov kategórie").fill("Energy");
    await page
      .getByLabel("Nadradená kategória")
      .selectOption({ label: "Home" });
    await page
      .getByRole("button", { name: "Pridať kategóriu", exact: true })
      .click();
    await expect(
      page.locator(".row").filter({ hasText: "Home → Energy" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Rozpočty", exact: true }).click();
    await page.getByLabel("Kategória", { exact: false }).fill("Home");
    await page.getByLabel("Plán EUR").fill("100");
    await page
      .getByRole("button", { name: "Uložiť rozpočet", exact: true })
      .click();
    await expect(
      page.getByRole("progressbar", { name: "Home", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "AI modely", exact: true }).click();
    for (const [name, kind, model] of [
      ["Local model", "ollama", "configured-local"],
      ["Other model", "compatible", "configured-other"],
    ]) {
      await page.getByLabel("Názov konfigurácie").fill(name);
      await page
        .getByRole("combobox", { name: /^Poskytovateľ/ })
        .selectOption(kind);
      await page.getByLabel("Identifikátor modelu").fill(model);
      await page
        .getByRole("button", { name: "Uložiť konfiguráciu", exact: true })
        .click();
      await expect(
        page.locator(".row").filter({ hasText: name + " ·" }),
      ).toBeVisible();
    }
    await page
      .getByLabel("Primárny model", { exact: false })
      .selectOption({ label: "Local model" });
    await page
      .getByLabel("Záložný model", { exact: false })
      .selectOption({ label: "Other model" });
    await page
      .getByRole("button", { name: "Uložiť priradenie", exact: true })
      .click();
    const state = await page.evaluate(() => window.finance.aiState());
    expect(state.configurations).toHaveLength(2);
    expect(
      state.configurations.every((c) => !c.cloudConsent && !c.hasKey),
    ).toBe(true);
    expect(state.routes[0].allowFallback).toBe(false);
    expect(
      (await page.evaluate(() => window.finance.domainSnapshot())).contracts[0]
        .assetId,
    ).toBeTruthy();
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
