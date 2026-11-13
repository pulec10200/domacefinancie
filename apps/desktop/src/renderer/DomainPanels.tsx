import { useState } from "react";
import type {
  DomainSnapshot,
  Asset,
  Contract,
  Category,
} from "../../../../packages/contracts/domain";
import type { Snapshot } from "../../../../packages/contracts";
import { parseMoney } from "../../../../packages/contracts";
import { localDate } from "../../../../packages/contracts/primitives";
const currency = (n: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
const text = (v: FormData, k: string) => String(v.get(k) ?? "");
const optional = (v: FormData, k: string) => text(v, k) || null;
export function DomainPanels({
  page,
  data,
  finance,
  action,
}: {
  page: string;
  data: DomainSnapshot;
  finance: Snapshot;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
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
  const assets = (
    <>
      <option value="">Bez priradeného majetku</option>
      {data.assets
        .filter((a) => !a.archived)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
    </>
  );
  if (page === "Majetok")
    return (
      <>
        <section>
          <h3>{asset ? "Upraviť majetok" : "Nový majetok"}</h3>
          <form
            key={asset?.id ?? "new"}
            onSubmit={submit(async (v) => {
              await window.finance.saveAsset({
                id: asset?.id,
                name: text(v, "name"),
                type: text(v, "type") as Asset["type"],
                value: text(v, "value") ? parseMoney(text(v, "value")) : null,
                details: {
                  address: text(v, "address"),
                  ownership: text(v, "ownership"),
                  identifier: text(v, "identifier"),
                  notes: text(v, "notes"),
                },
              });
              setAsset(null);
            })}
          >
            <label>
              Názov majetku
              <input name="name" defaultValue={asset?.name} required />
            </label>
            <label>
              Druh
              <select name="type" defaultValue={asset?.type ?? "property"}>
                <option value="property">Nehnuteľnosť</option>
                <option value="vehicle">Vozidlo</option>
                <option value="financial">Finančné aktívum</option>
                <option value="other">Iný majetok</option>
              </select>
            </label>
            <label>
              Adresa
              <input name="address" defaultValue={asset?.details.address} />
            </label>
            <label>
              Vlastnícke informácie
              <input name="ownership" defaultValue={asset?.details.ownership} />
            </label>
            <label>
              EČV / identifikátor
              <input
                name="identifier"
                defaultValue={asset?.details.identifier}
              />
            </label>
            <label>
              Odhadovaná hodnota EUR
              <input
                name="value"
                defaultValue={
                  asset?.value == null ? "" : (asset.value / 100).toFixed(2)
                }
              />
            </label>
            <label>
              Poznámky
              <input name="notes" defaultValue={asset?.details.notes} />
            </label>
            <button>Uložiť majetok</button>
            {asset && (
              <button type="button" onClick={() => setAsset(null)}>
                Zrušiť úpravu
              </button>
            )}
          </form>
        </section>
        {data.assets.map((a) => (
          <section key={a.id}>
            <div className="row">
              <h3>
                {a.name}
                {a.archived ? " · archivovaný" : ""}
              </h3>
              <button onClick={() => setAsset(a)}>Upraviť</button>
            </div>
            <p>
              {a.details.address} {a.details.identifier}
            </p>
            <p>
              Vlastníctvo: {a.details.ownership || "Neuvedené"} · Hodnota:{" "}
              {a.value == null ? "Neuvedená" : currency(a.value)}
            </p>
            <p>
              Príjmy {currency(a.income)} · Náklady {currency(a.expenses)}
            </p>
            <p>
              Zmluvy:{" "}
              {data.contracts
                .filter((c) => c.assetId === a.id)
                .map((c) => c.name)
                .join(", ") || "Žiadne"}
            </p>
            <p>{a.details.notes}</p>
            {a.archived ? (
              <button
                onClick={() =>
                  void action(() =>
                    window.finance.archiveEntity({
                      kind: "asset",
                      id: a.id,
                      archived: false,
                    }),
                  )
                }
              >
                Obnoviť majetok
              </button>
            ) : (
              <button
                onClick={() =>
                  void action(() =>
                    window.finance.archiveEntity({ kind: "asset", id: a.id }),
                  )
                }
              >
                Archivovať majetok
              </button>
            )}
          </section>
        ))}
      </>
    );
  if (page === "Zmluvy a poistky")
    return (
      <>
        <section>
          <h3>{contract ? "Upraviť zmluvu" : "Nová zmluva alebo poistka"}</h3>
          <form
            key={contract?.id ?? "new"}
            onSubmit={submit(async (v) => {
              await window.finance.saveContract({
                id: contract?.id,
                name: text(v, "name"),
                type: text(v, "type") as Contract["type"],
                provider: text(v, "provider"),
                assetId: optional(v, "assetId"),
                documentId: optional(v, "documentId"),
                details: {
                  start: optional(v, "start"),
                  end: optional(v, "end"),
                  anniversary: optional(v, "anniversary"),
                  premiumDue: optional(v, "premiumDue"),
                  noticeDays: text(v, "noticeDays")
                    ? Number(text(v, "noticeDays"))
                    : null,
                  insuredAmount: text(v, "insuredAmount")
                    ? parseMoney(text(v, "insuredAmount"))
                    : null,
                  notes: text(v, "notes"),
                },
              });
              setContract(null);
            })}
          >
            <label>
              Názov zmluvy
              <input name="name" defaultValue={contract?.name} required />
            </label>
            <label>
              Druh
              <select name="type" defaultValue={contract?.type ?? "insurance"}>
                <option value="insurance">Poistenie</option>
                <option value="loan">Úver</option>
                <option value="rental">Nájom</option>
                <option value="service">Služby</option>
                <option value="other">Iná zmluva</option>
              </select>
            </label>
            <label>
              Poskytovateľ / poisťovňa
              <input name="provider" defaultValue={contract?.provider} />
            </label>
            <label>
              Majetok
              <select name="assetId" defaultValue={contract?.assetId ?? ""}>
                {assets}
              </select>
            </label>
            <label>
              Originálny dokument
              <select
                name="documentId"
                defaultValue={contract?.documentId ?? ""}
              >
                <option value="">Bez dokumentu</option>
                {finance.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {[
              ["start", "Začiatok"],
              ["end", "Koniec obdobia"],
              ["anniversary", "Výročie"],
              ["premiumDue", "Splatnosť poistného"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type="date"
                  defaultValue={(contract?.details as any)?.[key] ?? ""}
                />
              </label>
            ))}
            <label>
              Lehota výpovede (dni)
              <input
                type="number"
                min="0"
                name="noticeDays"
                defaultValue={contract?.details.noticeDays ?? ""}
              />
            </label>
            <label>
              Poistná suma EUR
              <input
                name="insuredAmount"
                defaultValue={
                  contract?.details.insuredAmount == null
                    ? ""
                    : (contract.details.insuredAmount / 100).toFixed(2)
                }
              />
            </label>
            <label>
              Poznámky
              <input name="notes" defaultValue={contract?.details.notes} />
            </label>
            <button>Uložiť zmluvu</button>
            {contract && (
              <button type="button" onClick={() => setContract(null)}>
                Zrušiť úpravu
              </button>
            )}
          </form>
        </section>
        {data.contracts.map((c) => (
          <section key={c.id}>
            <div className="row">
              <h3>
                {c.name}
                {c.archived ? " · archivovaná" : ""}
              </h3>
              <button onClick={() => setContract(c)}>Upraviť</button>
            </div>
            <p>
              {c.provider} · {data.assets.find((a) => a.id === c.assetId)?.name}
            </p>
            <p>
              Začiatok: {c.details.start ?? "Neuvedený"} · Koniec:{" "}
              {c.details.end ?? "Neuvedený"}
            </p>
            <p>
              Výročie: {c.details.anniversary ?? "Neuvedené"} · Splatnosť:{" "}
              {c.details.premiumDue ?? "Neuvedená"}
            </p>
            <p>
              Lehota výpovede: {c.details.noticeDays ?? "Neuvedená"} · Poistná
              suma:{" "}
              {c.details.insuredAmount == null
                ? "Neuvedená"
                : currency(c.details.insuredAmount)}
            </p>
            {c.documentId && (
              <button
                onClick={() =>
                  void action(() => window.finance.openDocument(c.documentId!))
                }
              >
                Otvoriť zmluvu
              </button>
            )}
            {c.archived ? (
              <button
                onClick={() =>
                  void action(() =>
                    window.finance.archiveEntity({
                      kind: "contract",
                      id: c.id,
                      archived: false,
                    }),
                  )
                }
              >
                Obnoviť zmluvu
              </button>
            ) : (
              <button
                onClick={() =>
                  void action(() =>
                    window.finance.archiveEntity({
                      kind: "contract",
                      id: c.id,
                    }),
                  )
                }
              >
                Archivovať zmluvu
              </button>
            )}
            <p>
              Povinnosti:{" "}
              {data.rules
                .filter((r) => r.contract_id === c.id)
                .map((r) => r.name)
                .join(", ") ||
                "Zatiaľ žiadne — priraďte pri vytvorení povinnosti."}
            </p>
          </section>
        ))}
      </>
    );
  if (page === "Rozpočty")
    return (
      <>
        <section>
          <h3>Mesačný rozpočet podľa kategórie</h3>
          <form
            onSubmit={submit((v) =>
              window.finance.saveBudget({
                month: text(v, "month"),
                category: text(v, "category"),
                amount: parseMoney(text(v, "amount")),
              }),
            )}
          >
            <label>
              Mesiac
              <input
                name="month"
                type="month"
                defaultValue={localDate().slice(0, 7)}
                required
              />
            </label>
            <label>
              Kategória
              <input name="category" list="budget-categories" required />
              <datalist id="budget-categories">
                {[
                  ...new Set([
                    ...data.categories.map((c) => c.name),
                    ...finance.transactions.map((t) => t.category),
                  ]),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
            <label>
              Plán EUR
              <input name="amount" required />
            </label>
            <button>Uložiť rozpočet</button>
          </form>
        </section>
        {data.budgets.map((b) => (
          <section key={b.id}>
            <h3>
              {b.month} · {b.category}
            </h3>
            <p>
              Plán {currency(b.amount)} · Skutočnosť {currency(b.actual)} ·
              Zostáva {currency(b.remaining)}
            </p>
            <progress
              aria-label={b.category}
              max={Math.max(b.amount, b.actual, 1)}
              value={b.actual}
            />
          </section>
        ))}
        {!data.budgets.length && <section>Zatiaľ nemáte rozpočty.</section>}
      </>
    );
  if (page === "Kategórie")
    return (
      <>
        <section>
          <h3>{category ? "Upraviť kategóriu" : "Nová kategória"}</h3>
          <form
            key={category?.id ?? "new"}
            onSubmit={submit(async (v) => {
              await window.finance.saveCategory({
                id: category?.id,
                name: text(v, "name"),
                parentId: optional(v, "parentId"),
                kind: text(v, "kind") as CategoryKind,
              });
              setCategory(null);
            })}
          >
            <label>
              Názov kategórie
              <input name="name" defaultValue={category?.name} required />
            </label>
            <label>
              Nadradená kategória
              <select name="parentId" defaultValue={category?.parentId ?? ""}>
                <option value="">Hlavná kategória</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Druh
              <select name="kind" defaultValue={category?.kind ?? "expense"}>
                <option value="expense">Výdavok</option>
                <option value="income">Príjem</option>
                <option value="both">Oboje</option>
              </select>
            </label>
            <button>
              {category ? "Uložiť kategóriu" : "Pridať kategóriu"}
            </button>
            {category && (
              <button type="button" onClick={() => setCategory(null)}>
                Zrušiť úpravu
              </button>
            )}
          </form>
        </section>
        <section>
          {data.categories.map((c) => (
            <div className="row" key={c.id}>
              <span>
                {c.parentId
                  ? data.categories.find((p) => p.id === c.parentId)?.name +
                    " → "
                  : ""}
                {c.name}
              </span>
              <button onClick={() => setCategory(c)}>Upraviť kategóriu</button>
            </div>
          ))}
        </section>
      </>
    );
  return null;
}
type CategoryKind = "income" | "expense" | "both";
