import { MaintenancePanel } from "./MaintenancePanel";
import { PreferencesPanel } from "./PreferencesPanel";
import type { SettingsState } from "../../../../packages/contracts/settings";
import { localDate } from "../../../../packages/contracts/primitives";
import { AIModels } from "./AIModels";
import { DocumentReview } from "./DocumentReview";
import type { AIState } from "../../../../packages/contracts/ai";
import type { ExtractionField } from "../../../../packages/contracts/extraction";
import { DomainPanels } from "./DomainPanels";
import type { DomainSnapshot } from "../../../../packages/contracts/domain";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  parseMoney,
  type DesktopApi,
  type Snapshot,
} from "../../../../packages/contracts";
import "./style.css";
declare global {
  interface Window {
    finance: DesktopApi;
  }
}
const euro = (n: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
const today = localDate;
function App() {
  const [data, setData] = useState<Snapshot>();
  const [domain, setDomain] = useState<DomainSnapshot>();
  const [extractions, setExtractions] = useState<ExtractionField[]>([]);
  const [ai, setAI] = useState<AIState>();
  const [settings, setSettings] = useState<SettingsState>();
  const [page, setPage] = useState("Prehľad");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupPath, setBackupPath] = useState("");
  const refresh = async () => {
    const [f, d, e, a, s] = await Promise.all([
      window.finance.snapshot(),
      window.finance.domainSnapshot(),
      window.finance.extractions(),
      window.finance.aiState(),
      window.finance.settings(),
    ]);
    setData(f);
    setDomain(d);
    setExtractions(e);
    setAI(a);
    setSettings(s);
  };
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
    const timer = setInterval(
      () => void refresh().catch((e) => setError(String(e))),
      5000,
    );
    return () => clearInterval(timer);
  }, []);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage("Hotovo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const submit =
    (fn: (v: FormData) => Promise<unknown>) =>
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      void action(async () => {
        await fn(values);
        form.reset();
      });
    };
  const field = (v: FormData, k: string) => String(v.get(k) ?? "");
  const accounts = data?.accounts ?? [];
  const selectAccount = (name = "accountId") => (
    <select name={name} required>
      <option value="">Vyberte účet</option>
      {accounts
        .filter((a) => !a.archived)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
    </select>
  );
  const associations = () => (
    <>
      <label>
        Majetok
        <select name="assetId">
          <option value="">Bez majetku</option>
          {domain?.assets
            .filter((a) => !a.archived)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Zmluva
        <select name="contractId">
          <option value="">Bez zmluvy</option>
          {domain?.contracts
            .filter((c) => !c.archived)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
    </>
  );
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          DF
          <span>
            Domáce
            <br />
            Financie
          </span>
        </div>
        <small>VAŠA DOMÁCNOSŤ</small>
        <nav>
          {[
            "Prehľad",
            "Účty",
            "Transakcie",
            "Povinnosti",
            "Dokumenty",
            "Rozpočty",
            "Majetok",
            "Zmluvy a poistky",
            "Kategórie",
            "AI modely",
            "Nastavenia",
          ].map((p) => (
            <button
              className={page === p ? "active" : ""}
              onClick={() => setPage(p)}
              key={p}
            >
              {p}
            </button>
          ))}
        </nav>
        <div className="local">
          ● Lokálne uložené dáta
          <br />
          <small>Vaše financie zostávajú u vás.</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <small>OSOBNÉ FINANCIE BEZ CLOUDU</small>
            <h1>{page}</h1>
          </div>
          <span>
            {new Intl.DateTimeFormat("sk-SK", { dateStyle: "long" }).format(
              new Date(),
            )}
          </span>
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {!data ? (
          <p>Načítavam údaje…</p>
        ) : (
          <>
            {page === "Prehľad" && (
              <>
                {settings && !settings.lastBackup && (
                  <p className="error">
                    Zatiaľ nemáte kompletnú zálohu. Vytvorte ju v Nastaveniach.
                  </p>
                )}
                <section className="hero">
                  <small>CELKOVÝ ZOSTATOK</small>
                  <h2>{euro(accounts.reduce((s, a) => s + a.balance, 0))}</h2>
                  <p>Jasný prehľad o peniazoch vašej domácnosti.</p>
                </section>
                <div className="cards">
                  {data.monthly.map((m) => (
                    <section key={m.month}>
                      <h3>{m.month}</h3>
                      <p>
                        Príjmy <b>{euro(m.income)}</b>
                      </p>
                      <p>
                        Skutočné výdavky <b>{euro(m.expenses)}</b>
                      </p>
                      <p>
                        Očakávané príjmy <b>{euro(m.expectedIncome)}</b>
                      </p>
                      <p>
                        Povinné výdavky <b>{euro(m.mandatory)}</b>
                      </p>
                      <p>
                        Predpoveď zostatku <b>{euro(m.forecast)}</b>
                      </p>
                      <p>
                        Po splatnosti <b>{euro(m.overdue)}</b>
                      </p>
                      <p>
                        Zostáva uhradiť <b>{euro(m.unpaid)}</b>
                      </p>
                    </section>
                  ))}
                </div>
                <section>
                  <h3>Najbližšie nezaplatené povinnosti</h3>
                  {data.payables
                    .filter((p) => !p.cancelled && p.paid < p.amount)
                    .slice(0, 8)
                    .map((p) => (
                      <div className="row" key={p.id}>
                        <span>
                          {p.name}
                          <small>{p.due}</small>
                        </span>
                        <b>{euro(p.amount - p.paid)}</b>
                      </div>
                    ))}
                  {!data.payables.filter((p) => !p.cancelled).length && (
                    <p>
                      Zatiaľ nemáte žiadne povinnosti. Pridajte prvú v sekcii
                      Povinnosti.
                    </p>
                  )}
                </section>
              </>
            )}
            {page === "Účty" && (
              <>
                <section>
                  <h3>Nový účet</h3>
                  <form
                    onSubmit={submit((v) =>
                      window.finance.addAccount({
                        name: field(v, "name"),
                        type: field(v, "type") as "current",
                        currency: "EUR",
                        opening: parseMoney(field(v, "opening")),
                      }),
                    )}
                  >
                    <label>
                      Názov
                      <input name="name" required maxLength={120} />
                    </label>
                    <label>
                      Typ
                      <select name="type">
                        <option value="current">Bežný</option>
                        <option value="savings">Sporiaci</option>
                        <option value="cash">Hotovosť</option>
                        <option value="credit">Kreditný</option>
                        <option value="other">Ostatný</option>
                      </select>
                    </label>
                    <label>
                      Počiatočný zostatok v EUR
                      <input name="opening" defaultValue="0" required />
                    </label>
                    <button disabled={busy}>Pridať účet</button>
                  </form>
                </section>
                <section>
                  {accounts.map((a) => (
                    <div className="row" key={a.id}>
                      <span>{a.name}</span>
                      <b>{euro(a.balance)}</b>
                    </div>
                  ))}
                  {!accounts.length && <p>Zatiaľ nemáte žiadny účet.</p>}
                </section>
              </>
            )}
            {page === "Transakcie" && (
              <>
                <section>
                  <h3>Nová transakcia</h3>
                  <form
                    onSubmit={submit((v) =>
                      window.finance.addTransaction({
                        accountId: field(v, "accountId"),
                        targetId: field(v, "targetId") || undefined,
                        kind: field(v, "kind") as "income",
                        amount: parseMoney(field(v, "amount")),
                        date: field(v, "date"),
                        description: field(v, "description"),
                        category: field(v, "category") || "Ostatné",
                        categoryId: domain?.categories.find(
                          (c) => c.name === field(v, "category"),
                        )?.id,
                        assetId: field(v, "assetId") || undefined,
                        contractId: field(v, "contractId") || undefined,
                        requestId: crypto.randomUUID(),
                      }),
                    )}
                  >
                    <label>Účet{selectAccount()}</label>
                    <label>
                      Typ
                      <select name="kind">
                        <option value="expense">Výdavok</option>
                        <option value="income">Príjem</option>
                        <option value="transfer">Prevod</option>
                      </select>
                    </label>
                    <label>
                      Cieľ prevodu
                      <select name="targetId">
                        <option value="">Bez cieľového účtu</option>
                        {accounts
                          .filter((a) => !a.archived)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Suma EUR
                      <input name="amount" required />
                    </label>
                    <label>
                      Dátum
                      <input
                        type="date"
                        name="date"
                        defaultValue={today()}
                        required
                      />
                    </label>
                    <label>
                      Popis
                      <input name="description" />
                    </label>
                    <label>
                      Kategória
                      <input name="category" list="transaction-categories" />
                      <datalist id="transaction-categories">
                        {domain?.categories.map((c) => (
                          <option key={c.id}>{c.name}</option>
                        ))}
                      </datalist>
                    </label>
                    {associations()}
                    <button disabled={busy}>Uložiť transakciu</button>
                  </form>
                </section>
                <section>
                  {data.transactions.map((t) => (
                    <div className="row" key={t.id}>
                      <span>
                        {t.description || t.category}
                        <small>
                          {t.date} ·{" "}
                          {accounts.find((a) => a.id === t.account_id)?.name}
                        </small>
                      </span>
                      <b>
                        {t.kind === "income" ? "+" : "−"}
                        {euro(t.amount)}
                      </b>
                    </div>
                  ))}
                  {!data.transactions.length && (
                    <p>Zatiaľ nemáte žiadne transakcie.</p>
                  )}
                </section>
              </>
            )}
            {page === "Povinnosti" && (
              <>
                <section>
                  <h3>Nová finančná povinnosť</h3>
                  <form
                    onSubmit={submit((v) =>
                      window.finance.addRule({
                        name: field(v, "name"),
                        amount: parseMoney(field(v, "amount")),
                        start: field(v, "start"),
                        end: field(v, "end") || undefined,
                        interval: Number(
                          field(v, "customInterval") || field(v, "interval"),
                        ),
                        direction: field(v, "direction") as
                          "income" | "expense",
                        assetId: field(v, "assetId") || undefined,
                        contractId: field(v, "contractId") || undefined,
                      }),
                    )}
                  >
                    <label>
                      Názov
                      <input name="name" required />
                    </label>
                    <label>
                      Suma EUR
                      <input name="amount" required />
                    </label>
                    <label>
                      Prvá splatnosť
                      <input
                        type="date"
                        name="start"
                        required
                        defaultValue={today()}
                      />
                    </label>
                    <label>
                      Koniec (voliteľný)
                      <input type="date" name="end" />
                    </label>
                    <label>
                      Typ plánovanej platby
                      <select name="direction">
                        <option value="expense">Výdavok</option>
                        <option value="income">Očakávaný príjem</option>
                      </select>
                    </label>
                    <label>
                      Opakovanie
                      <select name="interval">
                        <option value="0">Jednorazovo</option>
                        <option value="1">Mesačne</option>
                        <option value="3">Štvrťročne</option>
                        <option value="6">Polročne</option>
                        <option value="12">Ročne</option>
                      </select>
                    </label>
                    <label>
                      Vlastný interval v mesiacoch (voliteľný)
                      <input
                        name="customInterval"
                        type="number"
                        min="1"
                        max="120"
                      />
                    </label>
                    {associations()}
                    <button disabled={busy}>Vytvoriť povinnosť</button>
                  </form>
                </section>
                <section>
                  {data.payables
                    .filter((p) => !p.cancelled)
                    .map((p) => (
                      <div key={p.id}>
                        <div className="row">
                          <span>
                            {p.name}
                            <small>
                              {p.due} ·{" "}
                              {p.paid >= p.amount
                                ? "Zaplatené"
                                : p.paid
                                  ? "Čiastočne zaplatené"
                                  : p.due < today()
                                    ? "Po splatnosti"
                                    : "Nezaplatené"}
                            </small>
                          </span>
                          <b>{euro(p.amount - p.paid)}</b>
                        </div>
                        {p.paid < p.amount && (
                          <form
                            onSubmit={submit((v) =>
                              window.finance.pay({
                                payableId: p.id,
                                accountId: field(v, "accountId"),
                                amount: parseMoney(field(v, "amount")),
                                date: today(),
                                requestId: crypto.randomUUID(),
                              }),
                            )}
                          >
                            {selectAccount()}
                            <input
                              aria-label="Suma úhrady"
                              name="amount"
                              required
                              placeholder="Suma úhrady EUR"
                            />
                            <button disabled={busy}>Zaznamenať úhradu</button>
                          </form>
                        )}
                      </div>
                    ))}
                </section>
              </>
            )}
            {page === "Dokumenty" && (
              <>
                <div className="toolbar">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(() => window.finance.importDocument())
                    }
                  >
                    Importovať dokument
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const path = await window.finance.watchFolder();
                        if (path) setMessage(path);
                      })
                    }
                  >
                    Sledovať priečinok
                  </button>
                  <button
                    onClick={() =>
                      void action(() => window.finance.openEkasa())
                    }
                  >
                    Manuálne overenie eKasa ↗
                  </button>
                </div>
                <p>
                  Originály sa archivujú bez zmien. Výsledky OCR vyžadujú
                  kontrolu. Automatické overenie eKasa nie je aktívne.
                </p>
                {domain &&
                  ai &&
                  data.documents.map((d) => (
                    <DocumentReview
                      key={d.id}
                      document={d}
                      finance={data}
                      domain={domain}
                      fields={extractions}
                      ai={ai}
                      action={action}
                    />
                  ))}
                {!data.documents.length && (
                  <section>Importujte svoj prvý dokument.</section>
                )}
              </>
            )}
            {page === "Nastavenia" && (
              <section>
                <h3>Dáta a zálohy</h3>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const path = await window.finance.exportData();
                      if (path) setBackupPath("Export JSON: " + path);
                    })
                  }
                >
                  Exportovať údaje do JSON
                </button>
                <p>
                  Export JSON obsahuje záznamy bez API kľúčov. Kompletná záloha
                  nižšie obsahuje aj originály dokumentov.
                </p>
                <p>
                  Dáta sú uložené v aplikačnom priečinku operačného systému.
                  Vyberte samostatný disk alebo priečinok pre zálohu.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const path = await window.finance.backup();
                      if (path) setBackupPath(path);
                    })
                  }
                >
                  Vytvoriť zálohu
                </button>
                <p>
                  Záloha obsahuje databázu, originály dokumentov a kontrolné
                  súčty.
                </p>
                {backupPath && (
                  <p role="status">Záloha bola vytvorená: {backupPath}</p>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(() => window.finance.restoreBackup())
                  }
                >
                  Obnoviť zo zálohy…
                </button>
                <p>
                  Pred obnovou sa skontroluje integrita. Po potvrdení sa
                  aplikácia reštartuje; pôvodný dátový profil zostane zachovaný.
                </p>
                <h3>Lokálne spracovanie</h3>
                <p>
                  Upozornenia fungujú počas spustenej aplikácie. AI modely sú
                  voliteľné a vyžadujú vlastnú konfiguráciu. Slovenské a
                  anglické OCR modely sú súčasťou inštalátora.
                </p>
              </section>
            )}
          </>
        )}
        {data && domain && (
          <DomainPanels
            page={page}
            data={domain}
            finance={data}
            action={action}
          />
        )}
        {page === "AI modely" && ai && <AIModels state={ai} action={action} />}
        {page === "Nastavenia" && settings && (
          <PreferencesPanel settings={settings} action={action} />
        )}
        {data && domain && (
          <MaintenancePanel
            page={page}
            finance={data}
            domain={domain}
            action={action}
          />
        )}
        <footer>Domáce Financie · verzia 1.0.0-rc.1 · EUR</footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
