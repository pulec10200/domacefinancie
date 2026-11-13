import { ReceiptItems } from "./ReceiptItems";
import { useState, useEffect } from "react";
import type { DocumentRow, Snapshot } from "../../../../packages/contracts";
import { parseMoney } from "../../../../packages/contracts";
import type { DomainSnapshot } from "../../../../packages/contracts/domain";
import type { ExtractionField } from "../../../../packages/contracts/extraction";
import type { AIState, AITask } from "../../../../packages/contracts/ai";
import { taskNames } from "./AIModels";
const labels: Record<string, string> = {
  pending: "Čaká vo fronte",
  running: "Spracúva sa",
  needs_review: "Čaká na kontrolu",
  failed: "Chyba",
  confirmed: "Potvrdené",
};
const ekasa: Record<string, string> = {
  Verified: "Overené",
  NotFound: "Nenájdené",
  Unavailable: "Nedostupná služba",
  NotSupported: "Automatické overenie nie je podporované",
  NotAttempted: "Bez automatického overenia",
  RequiresManualVerification: "Vyžaduje manuálne overenie",
};
export function DocumentReview({
  document: d,
  finance,
  domain,
  fields,
  ai,
  action,
}: {
  document: DocumentRow;
  finance: Snapshot;
  domain: DomainSnapshot;
  fields: ExtractionField[];
  ai: AIState;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const own = fields.filter((f) => f.documentId === d.id);
  const values = (name: string) =>
    [
      ...new Set(
        own.filter((f) => f.field === name).map((f) => JSON.stringify(f.value)),
      ),
    ].map((v) => JSON.parse(v));
  const proposed = (name: string) => {
    const list = values(name);
    return list.length === 1 ? list[0] : undefined;
  };
  const [image, setImage] = useState<{ image: string; pages: number } | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [task, setTask] = useState<AITask>("classification");
  const [approved, setApproved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState(d.name);
  const [kind, setKind] = useState("");
  const [wantRule, setWantRule] = useState(false);
  const amountProposal = proposed("amount");
  const dateProposal = proposed("date");
  const typeProposal = proposed("documentType");
  const nameProposal = proposed("name");
  useEffect(() => {
    if (!dirty) {
      if (typeof nameProposal === "string") setName(nameProposal);
      setAmount(
        typeof amountProposal === "number"
          ? (amountProposal / 100).toFixed(2)
          : "",
      );
      setDate(typeof dateProposal === "string" ? dateProposal : "");
      setKind(
        typeProposal === "receipt"
          ? "receipt"
          : typeProposal === "invoice"
            ? "invoice"
            : [
                  "insurance",
                  "loan",
                  "rental",
                  "service",
                  "other_contract",
                ].includes(typeProposal)
              ? "contract"
              : "",
      );
    }
  }, [amountProposal, dateProposal, typeProposal, nameProposal, dirty]);
  const route = ai.routes.find((r) => r.task === task);
  const providers = route
    ? [
        route.primaryId,
        ...(route.allowFallback && route.fallbackId ? [route.fallbackId] : []),
      ]
    : [];
  const providerNames = providers
    .map((id) => ai.configurations.find((c) => c.id === id)?.name ?? id)
    .join(" → ");
  return (
    <section>
      <div className="row">
        <h3>{d.name}</h3>
        <button
          onClick={() => void action(() => window.finance.openDocument(d.id))}
        >
          Otvoriť originál
        </button>
        <button
          onClick={() =>
            void action(async () =>
              setImage(
                await window.finance.previewDocument({
                  documentId: d.id,
                  page,
                }),
              ),
            )
          }
        >
          Náhľad vedľa údajov
        </button>
        {d.status !== "confirmed" && d.status !== "running" && (
          <button
            onClick={() =>
              void action(() => window.finance.retryDocument(d.id))
            }
          >
            Spracovať znovu
          </button>
        )}
      </div>
      <p>
        Spracovanie: {labels[d.status] ?? d.status} · eKasa:{" "}
        {ekasa[d.ekasa] ?? d.ekasa}
      </p>
      {d.status === "running" && (
        <>
          <progress
            max={100}
            value={d.progress ?? 0}
            aria-label="Priebeh spracovania"
          />
          <p>
            {d.progress ?? 0} % · pokus {d.attempts ?? 1}
          </p>
          <button
            onClick={() =>
              void action(() => window.finance.cancelDocument(d.id))
            }
          >
            Prerušiť spracovanie
          </button>
        </>
      )}
      <details>
        <summary>Ručné overenie eKasa</summary>
        <p>
          Otvorte oficiálnu službu, vyhľadajte doklad a porovnajte údaje. Záznam
          nižšie je vaše potvrdenie kontroly; automatický stav eKasa zostáva
          nezmenený.
        </p>
        <button onClick={() => void action(() => window.finance.openEkasa())}>
          Otvoriť Over doklad ↗
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const result = new FormData(e.currentTarget).get("verification") as
              "matched" | "not_found" | "mismatch";
            void action(() =>
              window.finance.recordManualVerification({
                documentId: d.id,
                result,
              }),
            );
          }}
        >
          <label>
            Výsledok ručnej kontroly
            <select name="verification" required>
              <option value="">Vyberte výsledok</option>
              <option value="matched">Doklad a údaje súhlasia</option>
              <option value="not_found">Doklad sa nenašiel</option>
              <option value="mismatch">Údaje sa rozchádzajú</option>
            </select>
          </label>
          <button>Uložiť výsledok kontroly</button>
        </form>
      </details>
      {d.error && <p className="error">{d.error}</p>}
      <div className={image ? "review-grid" : ""}>
        {image && (
          <div>
            <img
              className="document-preview"
              src={image.image}
              alt={`Originál dokumentu, strana ${page}`}
            />
            <div className="toolbar">
              <button
                disabled={page <= 1}
                onClick={() =>
                  void action(async () => {
                    const next = page - 1;
                    setImage(
                      await window.finance.previewDocument({
                        documentId: d.id,
                        page: next,
                      }),
                    );
                    setPage(next);
                  })
                }
              >
                Predchádzajúca
              </button>
              <span>
                {page} / {image.pages}
              </span>
              <button
                disabled={page >= image.pages}
                onClick={() =>
                  void action(async () => {
                    const next = page + 1;
                    setImage(
                      await window.finance.previewDocument({
                        documentId: d.id,
                        page: next,
                      }),
                    );
                    setPage(next);
                  })
                }
              >
                Nasledujúca
              </button>
            </div>
          </div>
        )}
        <div>
          {d.text && (
            <details open={!image}>
              <summary>Rozpoznaný text</summary>
              <pre>{d.text}</pre>
            </details>
          )}
          {own.length > 0 && (
            <details>
              <summary>Zdroje a história extrakcie</summary>
              {own.map((f) => (
                <p key={f.id}>
                  {(
                    {
                      amount: "Suma (centy)",
                      date: "Dátum",
                      name: "Názov",
                      documentType: "Typ dokumentu",
                      summary: "Zhrnutie",
                      items: "Položky",
                      interval: "Interval",
                      contract: "Zmluva",
                      manualVerification: "Ručné overenie používateľom",
                    } as Record<string, string>
                  )[f.field] ?? f.field}
                  : {JSON.stringify(f.value)} ·{" "}
                  {ai.configurations.find((c) => c.id === f.source)?.name ??
                    (
                      {
                        ocr: "Lokálne OCR",
                        pdf_or_ocr: "Text PDF alebo OCR",
                        ekasa: "eKasa",
                        user: "Používateľ",
                      } as Record<string, string>
                    )[f.source] ??
                    f.source}{" "}
                  /{" "}
                  {(
                    {
                      ai: "AI extrakcia",
                      labelled_text: "Textové pravidlá",
                      confirmation: "Potvrdenie používateľom",
                      verified_service: "Overená služba",
                      manual: "Ručné zadanie",
                    } as Record<string, string>
                  )[f.method] ?? f.method}
                  {f.page ? " · strana " + f.page : ""}
                  {f.confidence !== null
                    ? " · istota enginu " + f.confidence
                    : ""}
                  {f.confirmedValue !== null
                    ? " · potvrdené: " + JSON.stringify(f.confirmedValue)
                    : " · nepotvrdené"}
                </p>
              ))}
            </details>
          )}
          {(values("amount").length > 1 || values("date").length > 1) && (
            <p className="error">
              Zdroje sa rozchádzajú. Skontrolujte originál a zadajte správnu
              sumu alebo dátum.
            </p>
          )}
          <ReceiptItems
            documentId={d.id}
            totalCents={
              /^\d+([.,]\d{1,2})?$/.test(amount)
                ? parseMoney(amount)
                : undefined
            }
            proposed={proposed("items")}
            action={action}
          />
          {d.status !== "confirmed" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget);
                void action(async () => {
                  if (kind === "contract") {
                    const opt = (key: string) =>
                      String(v.get(key) ?? "") || null;
                    const type = String(v.get("contractType")) as
                      "insurance" | "loan" | "rental" | "service" | "other";
                    await window.finance.confirmContract({
                      documentId: d.id,
                      contract: {
                        name,
                        type,
                        provider: String(v.get("provider") ?? ""),
                        assetId: opt("assetId"),
                        documentId: d.id,
                        details: {
                          start: opt("contractStart"),
                          end: opt("contractEnd"),
                          anniversary: opt("anniversary"),
                          premiumDue:
                            type === "insurance" && date ? date : null,
                          noticeDays: opt("noticeDays")
                            ? Number(opt("noticeDays"))
                            : null,
                          insuredAmount: opt("insuredAmount")
                            ? parseMoney(opt("insuredAmount")!)
                            : null,
                          notes: String(v.get("notes") ?? ""),
                        },
                      },
                      rule: wantRule
                        ? {
                            name,
                            amount: parseMoney(amount),
                            start: date,
                            end: opt("ruleEnd") ?? undefined,
                            interval: Number(v.get("interval")),
                            direction: "expense",
                          }
                        : undefined,
                    });
                  } else
                    await window.finance.confirmDocument({
                      documentId: d.id,
                      kind: kind as "invoice" | "receipt",
                      name,
                      amount: parseMoney(amount),
                      date,
                      accountId: String(v.get("accountId") ?? "") || undefined,
                      payableId: String(v.get("payableId") ?? "") || undefined,
                      assetId: String(v.get("assetId") ?? "") || undefined,
                      contractId:
                        String(v.get("contractId") ?? "") || undefined,
                    });
                });
              }}
            >
              <label>
                Typ záznamu
                <select
                  name="kind"
                  required
                  value={kind}
                  onChange={(e) => {
                    setDirty(true);
                    setKind(e.target.value);
                  }}
                >
                  <option value="">Vyberte typ</option>
                  <option value="invoice">Faktúra → povinnosť</option>
                  <option value="receipt">Bloček → výdavok</option>
                  <option value="contract">Zmluva → zmluva a povinnosti</option>
                </select>
              </label>
              {kind === "contract" && (
                <>
                  <label>
                    Druh zmluvy
                    <select
                      name="contractType"
                      defaultValue={
                        ["insurance", "loan", "rental", "service"].includes(
                          typeProposal,
                        )
                          ? typeProposal
                          : "other"
                      }
                    >
                      <option value="insurance">Poistenie</option>
                      <option value="loan">Úver</option>
                      <option value="rental">Nájom</option>
                      <option value="service">Služby</option>
                      <option value="other">Iná zmluva</option>
                    </select>
                  </label>
                  <label>
                    Poskytovateľ / poisťovňa
                    <input name="provider" />
                  </label>
                  <label>
                    Začiatok zmluvy
                    <input name="contractStart" type="date" />
                  </label>
                  <label>
                    Koniec obdobia
                    <input name="contractEnd" type="date" />
                  </label>
                  <label>
                    Výročie
                    <input name="anniversary" type="date" />
                  </label>
                  <label>
                    Výpovedná lehota (dni)
                    <input name="noticeDays" type="number" min="0" max="3650" />
                  </label>
                  <label>
                    Poistná suma EUR
                    <input name="insuredAmount" />
                  </label>
                  <label>
                    Poznámky
                    <input name="notes" />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={wantRule}
                      onChange={(e) => setWantRule(e.target.checked)}
                    />
                    Vytvoriť zároveň pravidelnú alebo jednorazovú povinnosť
                  </label>
                  {wantRule && (
                    <>
                      <label>
                        Interval (mesiace; 0 = jednorazovo)
                        <input
                          name="interval"
                          type="number"
                          min="0"
                          max="120"
                          defaultValue={proposed("interval") ?? ""}
                          required
                        />
                      </label>
                      <label>
                        Koniec povinnosti (voliteľný)
                        <input name="ruleEnd" type="date" />
                      </label>
                    </>
                  )}
                </>
              )}
              <label>
                Popis
                <input
                  name="name"
                  required
                  value={name}
                  onChange={(e) => {
                    setDirty(true);
                    setName(e.target.value);
                  }}
                />
              </label>
              <label>
                Overená suma EUR
                <input
                  name="amount"
                  required={kind !== "contract" || wantRule}
                  value={amount}
                  onChange={(e) => {
                    setDirty(true);
                    setAmount(e.target.value);
                  }}
                />
              </label>
              <label>
                Splatnosť / dátum úhrady
                <input
                  name="date"
                  type="date"
                  required={kind !== "contract" || wantRule}
                  value={date}
                  onChange={(e) => {
                    setDirty(true);
                    setDate(e.target.value);
                  }}
                />
              </label>
              <label hidden={kind !== "receipt"}>
                Účet pre bloček
                <select name="accountId" required={kind === "receipt"}>
                  <option value="">Vyberte účet</option>
                  {finance.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              {kind === "invoice" && (
                <label>
                  Priradiť k očakávanej platbe
                  <select name="payableId">
                    <option value="">Nová jednorazová povinnosť</option>
                    {finance.payables
                      .filter(
                        (p) =>
                          !p.cancelled &&
                          p.direction !== "income" &&
                          !p.document_id &&
                          p.paid < p.amount,
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.due} · {(p.amount / 100).toFixed(2)} EUR
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Majetok
                <select name="assetId">
                  <option value="">Bez majetku</option>
                  {domain.assets
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
                  {domain.contracts
                    .filter((c) => !c.archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <button>Potvrdiť finančný záznam</button>
            </form>
          )}
          {d.text && (
            <details>
              <summary>Voliteľné spracovanie AI</summary>
              <label>
                Úloha
                <select
                  value={task}
                  onChange={(e) => {
                    setTask(e.target.value as AITask);
                    setApproved(false);
                  }}
                >
                  {Object.entries(taskNames).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Príjemca rozpoznaného textu tohto dokumentu:{" "}
                {providerNames || "Najprv priraďte model v AI modely."}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                Povoľujem odoslať text tohto dokumentu uvedeným modelom vrátane
                zvoleného záložného modelu.
              </label>
              <button
                disabled={!route || !approved}
                onClick={() =>
                  void action(() =>
                    window.finance.runDocumentAI({
                      documentId: d.id,
                      task,
                      approvedProviders: providers,
                    }),
                  )
                }
              >
                Vytvoriť návrh pomocou AI
              </button>
              <p>
                Výstup AI upravte a potvrďte pred zápisom finančných údajov.
              </p>
            </details>
          )}
          {domain.contracts
            .filter((c) => c.documentId === d.id)
            .map((c) => (
              <p key={c.id}>Priradená zmluva: {c.name}</p>
            ))}
        </div>
      </div>
    </section>
  );
}
