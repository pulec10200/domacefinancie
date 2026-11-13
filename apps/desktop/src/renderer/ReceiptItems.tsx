import { useState, useEffect } from "react";
import type { ReceiptItemInput } from "../../../../packages/contracts/extraction";
import { parseMoney } from "../../../../packages/contracts";
export function ReceiptItems({
  documentId,
  totalCents,
  proposed,
  action,
}: {
  documentId: string;
  totalCents?: number;
  proposed: unknown;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [items, setItems] = useState<
    { name: string; quantity: string; amount: string }[]
  >([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (dirty) return;
    void window.finance
      .receiptItems(documentId)
      .then((saved) => {
        const values = saved.length
          ? saved
          : Array.isArray(proposed)
            ? (proposed as ReceiptItemInput[])
            : [];
        setItems(
          values.map((v) => ({
            name: v.name,
            quantity: v.quantity ?? "",
            amount:
              v.amountCents == null ? "" : (v.amountCents / 100).toFixed(2),
          })),
        );
      })
      .catch((e) => setError(String(e)));
  }, [documentId, proposed, dirty]);
  const update = (
    index: number,
    key: "name" | "quantity" | "amount",
    value: string,
  ) => {
    setDirty(true);
    setItems(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  };
  let sum: number | null = 0;
  try {
    for (const item of items) {
      if (!item.amount) {
        sum = null;
        break;
      }
      sum += parseMoney(item.amount);
    }
  } catch {
    sum = null;
  }
  const format = (v: number) =>
    new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
    }).format(v / 100);
  return (
    <details>
      <summary>Položky bločka a ich oprava</summary>
      {error && <p className="error">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            await window.finance.saveReceiptItems({
              documentId,
              items: items.map((v) => ({
                name: v.name,
                quantity: v.quantity || null,
                amountCents: v.amount ? parseMoney(v.amount) : null,
              })),
            });
            setDirty(false);
          });
        }}
      >
        {items.map((item, i) => (
          <div className="row" key={i}>
            <label>
              Položka
              <input
                value={item.name}
                required
                onChange={(e) => update(i, "name", e.target.value)}
              />
            </label>
            <label>
              Množstvo
              <input
                value={item.quantity}
                onChange={(e) => update(i, "quantity", e.target.value)}
              />
            </label>
            <label>
              Suma položky EUR
              <input
                value={item.amount}
                onChange={(e) => update(i, "amount", e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setDirty(true);
                setItems(items.filter((_, n) => n !== i));
              }}
            >
              Odstrániť riadok
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setDirty(true);
            setItems([...items, { name: "", quantity: "", amount: "" }]);
          }}
        >
          Pridať položku
        </button>
        <button>Uložiť položky</button>
      </form>
      {items.length > 0 && (
        <p role="status">
          {sum === null
            ? "Doplňte platné sumy položiek."
            : `Súčet položiek: ${format(sum)}${totalCents === undefined ? "" : sum === totalCents ? " · súhlasí s celkom" : ` · rozdiel oproti celkom: ${format(totalCents - sum)}`}`}
        </p>
      )}
      <p>
        Položky sú samostatná evidencia. Celkovú sumu výdavku potvrďte podľa
        originálu dokladu.
      </p>
    </details>
  );
}
