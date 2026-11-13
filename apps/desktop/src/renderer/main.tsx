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
const today = () => new Date().toISOString().slice(0, 10);
function App() {
  const [data, setData] = useState<Snapshot>();
  const [page, setPage] = useState("Prehľad");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupPath, setBackupPath] = useState("");
  const refresh = async () => setData(await window.finance.snapshot());
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
  const selectAccountOptional = () => (
    <select name="accountId">
      <option value="">Len pre bloček</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
  const selectAccount = (name = "accountId") => (
    <select name={name} required>
      <option value="">Vyberte účet</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
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
                        Zostáva uhradiť <b>{euro(m.unpaid)}</b>
                      </p>
                    </section>
                  ))}
                </div>
                <section>
                  <h3>Najbližšie nezaplatené povinnosti</h3>
                  {data.payables
                    .filter((p) => p.paid < p.amount)
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
                  {!data.payables.length && (
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
                        {accounts.map((a) => (
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
                      <input name="category" />
                    </label>
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
                        interval: Number(field(v, "interval")),
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
                      Opakovanie
                      <select name="interval">
                        <option value="0">Jednorazovo</option>
                        <option value="1">Mesačne</option>
                        <option value="3">Štvrťročne</option>
                        <option value="6">Polročne</option>
                        <option value="12">Ročne</option>
                      </select>
                    </label>
                    <button disabled={busy}>Vytvoriť povinnosť</button>
                  </form>
                </section>
                <section>
                  {data.payables.map((p) => (
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
                {data.documents.map((d) => (
                  <section key={d.id}>
                    <div className="row">
                      <h3>{d.name}</h3>
                      <button
                        onClick={() =>
                          void action(() => window.finance.openDocument(d.id))
                        }
                      >
                        Otvoriť originál
                      </button>
                    </div>
                    <p>
                      Spracovanie:{" "}
                      {(
                        {
                          pending: "Čaká vo fronte",
                          needs_review: "Čaká na kontrolu",
                          failed: "Chyba",
                          confirmed: "Potvrdené",
                        } as Record<string, string>
                      )[d.status] ?? d.status}{" "}
                      · eKasa: {d.ekasa}
                    </p>
                    {d.error && <p className="error">{d.error}</p>}
                    {d.text && <pre>{d.text}</pre>}
                    {d.status !== "confirmed" && (
                      <form
                        onSubmit={submit((v) =>
                          window.finance.confirmDocument({
                            documentId: d.id,
                            kind: field(v, "kind") as "invoice",
                            name: field(v, "name"),
                            amount: parseMoney(field(v, "amount")),
                            date: field(v, "date"),
                            accountId: field(v, "accountId") || undefined,
                          }),
                        )}
                      >
                        <label>
                          Typ záznamu
                          <select name="kind">
                            <option value="invoice">Faktúra → povinnosť</option>
                            <option value="receipt">Bloček → výdavok</option>
                          </select>
                        </label>
                        <label>
                          Popis
                          <input name="name" required defaultValue={d.name} />
                        </label>
                        <label>
                          Overená suma EUR
                          <input name="amount" required />
                        </label>
                        <label>
                          Splatnosť / dátum úhrady
                          <input
                            name="date"
                            type="date"
                            required
                            defaultValue={today()}
                          />
                        </label>
                        <label>Účet pre bloček{selectAccountOptional()}</label>
                        <button disabled={busy}>
                          Potvrdiť finančný záznam
                        </button>
                      </form>
                    )}
                  </section>
                ))}
                {!data.documents.length && (
                  <section>Importujte svoj prvý dokument.</section>
                )}
              </>
            )}
            {page === "Nastavenia" && (
              <section>
                <h3>Dáta a zálohy</h3>
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
                <h3>Stav tejto vývojovej verzie</h3>
                <p>
                  AI poskytovatelia, rozpočty, majetok a zmluvy zatiaľ nie sú
                  dostupné. Upozornenia fungujú iba počas spustenej aplikácie.
                  OCR obrázkov vyžaduje lokálne jazykové balíky.
                </p>
              </section>
            )}
          </>
        )}
        <footer>Domáce Financie · vývojová verzia 0.1.0 · EUR</footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
