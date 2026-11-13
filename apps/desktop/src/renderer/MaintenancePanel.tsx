import { useState } from "react";
import type { Snapshot, Transaction } from "../../../../packages/contracts";
import { parseMoney } from "../../../../packages/contracts";
import type { DomainSnapshot } from "../../../../packages/contracts/domain";
import { localDate } from "../../../../packages/contracts/primitives";
const str = (v: FormData, k: string) => String(v.get(k) ?? "");
export function MaintenancePanel({
  page,
  finance,
  domain,
  action,
}: {
  page: string;
  finance: Snapshot;
  domain: DomainSnapshot;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [accountId, setAccount] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const perform =
    (fn: (v: FormData) => Promise<unknown>) =>
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const v = new FormData(event.currentTarget);
      void action(() => fn(v));
    };
  if (page === "Účty") {
    const a = finance.accounts.find((a) => a.id === accountId);
    return (
      <section>
        <h3>Upraviť alebo archivovať účet</h3>
        <label>
          Vyberte účet na úpravu
          <select
            value={accountId}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Vyberte účet</option>
            {finance.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? " · archivovaný" : ""}
              </option>
            ))}
          </select>
        </label>
        {a && (
          <form
            key={a.id}
            onSubmit={perform((v) =>
              window.finance.updateAccount({
                id: a.id,
                name: str(v, "name"),
                type: str(v, "type") as "current",
                currency: "EUR",
                opening: parseMoney(str(v, "opening")),
              }),
            )}
          >
            <label>
              Nový názov
              <input name="name" defaultValue={a.name} required />
            </label>
            <label>
              Typ účtu
              <select name="type" defaultValue={a.type}>
                <option value="current">Bežný</option>
                <option value="savings">Sporiaci</option>
                <option value="cash">Hotovosť</option>
                <option value="credit">Kreditný</option>
                <option value="other">Ostatný</option>
              </select>
            </label>
            <label>
              Počiatočný zostatok EUR
              <input
                name="opening"
                defaultValue={(a.opening / 100).toFixed(2)}
                required
              />
            </label>
            <button>Uložiť úpravu účtu</button>
            {a.archived ? (
              <button
                type="button"
                onClick={() =>
                  void action(() =>
                    window.finance.archiveEntity({
                      kind: "account",
                      id: a.id,
                      archived: false,
                    }),
                  )
                }
              >
                Obnoviť účet
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void action(() =>
                    window.finance.archiveEntity({ kind: "account", id: a.id }),
                  )
                }
              >
                Archivovať účet
              </button>
            )}
          </form>
        )}
      </section>
    );
  }
  if (page === "Transakcie")
    return (
      <section>
        <h3>Úpravy a história transakcií</h3>
        {transaction && (
          <form
            key={transaction.id}
            onSubmit={perform(async (v) => {
              await window.finance.updateTransaction({
                id: transaction.id,
                requestId: transaction.request_id,
                accountId: str(v, "accountId"),
                targetId: str(v, "targetId") || undefined,
                kind: str(v, "kind") as "expense",
                amount: parseMoney(str(v, "amount")),
                date: str(v, "date"),
                description: str(v, "description"),
                category: str(v, "category"),
                assetId: transaction.asset_id ?? undefined,
                contractId: transaction.contract_id ?? undefined,
                categoryId: transaction.category_id ?? undefined,
              });
              setTransaction(null);
            })}
          >
            <label>
              Účet
              <select name="accountId" defaultValue={transaction.account_id}>
                {finance.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Typ
              <select name="kind" defaultValue={transaction.kind}>
                <option value="expense">Výdavok</option>
                <option value="income">Príjem</option>
                <option value="transfer">Prevod</option>
              </select>
            </label>
            <label>
              Cieľový účet
              <select
                name="targetId"
                defaultValue={(transaction as any).target_id ?? ""}
              >
                <option value="">Bez cieľa</option>
                {finance.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Suma EUR
              <input
                name="amount"
                defaultValue={(transaction.amount / 100).toFixed(2)}
                required
              />
            </label>
            <label>
              Dátum
              <input
                name="date"
                type="date"
                defaultValue={transaction.date}
                required
              />
            </label>
            <label>
              Popis
              <input
                name="description"
                defaultValue={transaction.description}
              />
            </label>
            <label>
              Kategória
              <input name="category" defaultValue={transaction.category} />
            </label>
            <button>Uložiť úpravu transakcie</button>
            <button type="button" onClick={() => setTransaction(null)}>
              Zrušiť úpravu
            </button>
          </form>
        )}
        {finance.transactionHistory.map((t) => (
          <div className="row" key={t.id}>
            <span>
              {t.date} · {t.description || t.category} ·{" "}
              {(t.amount / 100).toFixed(2)} EUR{t.voided ? " · stornovaná" : ""}
            </span>
            {!t.voided ? (
              <>
                <button onClick={() => setTransaction(t)}>Upraviť</button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Stornovať transakciu? Zostane zachovaná v histórii.",
                      )
                    )
                      void action(() => window.finance.voidTransaction(t.id));
                  }}
                >
                  Stornovať
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  void action(() => window.finance.restoreTransaction(t.id))
                }
              >
                Obnoviť transakciu
              </button>
            )}
          </div>
        ))}
      </section>
    );
  if (page === "Povinnosti")
    return (
      <>
        <section>
          <h3>Zmena sumy alebo výnimka pravidelnej povinnosti</h3>
          <form
            onSubmit={perform((v) =>
              window.finance.changeRule({
                ruleId: str(v, "rule"),
                effective: str(v, "effective"),
                amount: str(v, "amount")
                  ? parseMoney(str(v, "amount"))
                  : undefined,
                skip: v.has("skip"),
              }),
            )}
          >
            <label>
              Pravidlo
              <select name="rule" required>
                <option value="">Vyberte povinnosť</option>
                {domain.rules
                  .filter((r) => r.active)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Účinnosť / vynechaná splatnosť
              <input
                name="effective"
                type="date"
                defaultValue={localDate()}
                required
              />
            </label>
            <label>
              Nová suma EUR (pri zmene)
              <input name="amount" />
            </label>
            <label>
              <input name="skip" type="checkbox" />
              Vynechať iba túto jednu splatnosť
            </label>
            <button>Uložiť zmenu povinnosti</button>
          </form>
          {domain.rules
            .filter((r) => r.active)
            .map((r) => (
              <div className="row" key={r.id}>
                <span>
                  {r.name} · opakovanie {r.interval} mesiacov
                </span>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Ukončiť budúce platby tohto pravidla? Minulé a zaplatené platby zostanú zachované.",
                      )
                    )
                      void action(() => window.finance.stopRule(r.id));
                  }}
                >
                  Ukončiť pravidlo
                </button>
              </div>
            ))}
        </section>
        <section>
          <h3>Zrušenie nezaplatenej povinnosti</h3>
          {finance.payables
            .filter((p) => !p.cancelled && !p.paid)
            .map((p) => (
              <div className="row" key={p.id}>
                <span>
                  {p.name} · {p.due}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm("Zrušiť túto jednu splatnú platbu?"))
                      void action(() => window.finance.cancelPayable(p.id));
                  }}
                >
                  Zrušiť platbu
                </button>
              </div>
            ))}
        </section>
      </>
    );
  return null;
}
