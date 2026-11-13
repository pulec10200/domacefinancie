import { useState } from "react";
import {
  aiConfiguration,
  type AIState,
  type AIConfiguration,
  type AITask,
} from "../../../../packages/contracts/ai";

export const taskNames: Record<AITask, string> = {
  classification: "Klasifikácia dokumentov",
  contract_extraction: "Extrakcia zmluvy",
  receipt_items: "Položky bločka",
  financial_analysis: "Finančná analýza dokumentu",
  summary: "Zhrnutie dokumentu",
};
const value = (v: FormData, k: string) => String(v.get(k) ?? "");
export function AIModels({
  state,
  action,
}: {
  state: AIState;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState<AIConfiguration | null>(null);
  const [kind, setKind] = useState<AIConfiguration["kind"]>("ollama");
  const [test, setTest] = useState("");
  const submit =
    (fn: (v: FormData) => Promise<unknown>) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const v = new FormData(form);
      void action(async () => {
        await fn(v);
        form.reset();
      });
    };
  const price = (v: FormData, k: string) =>
    value(v, k)
      ? (() => {
          const raw = value(v, k).trim().replace(",", ".");
          if (!/^\d+(\.\d{1,6})?$/.test(raw))
            throw Error("Cena môže mať najviac šesť desatinných miest.");
          const [a, b = ""] = raw.split(".");
          const units = BigInt(a) * 1000000n + BigInt(b.padEnd(6, "0"));
          if (units > BigInt(Number.MAX_SAFE_INTEGER))
            throw Error("Príliš vysoká cena.");
          return Number(units);
        })()
      : null;
  return (
    <>
      <section>
        <h3>{editing ? "Upraviť AI model" : "Pridať AI model"}</h3>
        <p>
          Lokálne spracovanie je predvolené. Cloudové modely dostanú iba vybraný
          text dokumentu po povolení.
        </p>
        {!state.secureStorage && (
          <p className="error">
            Systémová kľúčenka nie je dostupná. API kľúče sa neuložia. Lokálny
            model možno používať bez kľúča.
          </p>
        )}
        <form
          key={editing?.id ?? "new"}
          onSubmit={submit(async (v) => {
            const config = aiConfiguration.parse({
              id: editing?.id,
              name: value(v, "name"),
              kind: value(v, "kind"),
              model: value(v, "model"),
              baseUrl: value(v, "baseUrl"),
              cloudConsent: v.has("consent"),
              structuredOutput: v.has("structured"),
              timeoutMs: Number(value(v, "timeout")) * 1000,
              maxAttempts: Number(value(v, "attempts")),
              maxOutputTokens: Number(value(v, "output")),
              tokenBudget: Number(value(v, "budget")),
              inputPriceMicros: price(v, "inputPrice"),
              outputPriceMicros: price(v, "outputPrice"),
              costBudgetMicros: price(v, "costBudget"),
            });
            await window.finance.saveAI({
              configuration: config,
              apiKey: value(v, "key") || undefined,
            });
            setEditing(null);
          })}
        >
          <label>
            Názov konfigurácie
            <input name="name" defaultValue={editing?.name} required />
          </label>
          <label>
            Poskytovateľ
            <select
              name="kind"
              defaultValue={editing?.kind ?? kind}
              onChange={(e) =>
                setKind(e.target.value as AIConfiguration["kind"])
              }
            >
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
              <option value="compatible">OpenAI-compatible</option>
            </select>
          </label>
          <label>
            Identifikátor modelu
            <input
              name="model"
              defaultValue={editing?.model}
              required
              placeholder="Presný názov vášho modelu"
            />
          </label>
          <label>
            Adresa servera (Ollama / compatible)
            <input
              name="baseUrl"
              defaultValue={editing?.baseUrl ?? "http://localhost:11434"}
              placeholder="http://localhost:11434 alebo https://server/v1"
            />
          </label>
          <label>
            API kľúč (prázdne zachová existujúci)
            <input
              type="password"
              name="key"
              autoComplete="off"
              disabled={!state.secureStorage}
            />
          </label>
          <label>
            Časový limit (sekundy)
            <input
              name="timeout"
              type="number"
              min="1"
              max="180"
              defaultValue={(editing?.timeoutMs ?? 30000) / 1000}
            />
          </label>
          <label>
            Počet pokusov
            <input
              name="attempts"
              type="number"
              min="1"
              max="3"
              defaultValue={editing?.maxAttempts ?? 1}
            />
          </label>
          <label>
            Maximálny výstup (tokeny)
            <input
              name="output"
              type="number"
              min="256"
              max="16384"
              defaultValue={editing?.maxOutputTokens ?? 2048}
            />
          </label>
          <label>
            Celkový tokenový limit
            <input
              name="budget"
              type="number"
              min="1"
              max="1000000000"
              defaultValue={editing?.tokenBudget ?? 1000000}
            />
          </label>
          <label>
            Cena vstupu EUR / milión tokenov
            <input
              name="inputPrice"
              defaultValue={
                editing?.inputPriceMicros == null
                  ? ""
                  : editing.inputPriceMicros / 1000000
              }
            />
          </label>
          <label>
            Cena výstupu EUR / milión tokenov
            <input
              name="outputPrice"
              defaultValue={
                editing?.outputPriceMicros == null
                  ? ""
                  : editing.outputPriceMicros / 1000000
              }
            />
          </label>
          <label>
            Cenový limit EUR
            <input
              name="costBudget"
              defaultValue={
                editing?.costBudgetMicros == null
                  ? ""
                  : editing.costBudgetMicros / 1000000
              }
            />
          </label>
          <label>
            <input
              name="structured"
              type="checkbox"
              defaultChecked={editing?.structuredOutput ?? true}
            />
            Model podporuje štruktúrovaný JSON
          </label>
          <label>
            <input
              name="consent"
              type="checkbox"
              defaultChecked={editing?.cloudConsent ?? false}
            />
            Povoľujem odosielať vybraný text tomuto poskytovateľovi
          </label>
          <button>Uložiť konfiguráciu</button>
          {editing && (
            <button type="button" onClick={() => setEditing(null)}>
              Zrušiť úpravu
            </button>
          )}
        </form>
        <p>
          Ceny zadáva používateľ; odhad vychádza z týchto cien. Pri neznámej
          spotrebe sa konzervatívne rezervuje tokenový a prípadný cenový limit.
        </p>
      </section>
      <section>
        <h3>Modely a test spojenia</h3>
        {state.configurations.map((c) => (
          <div className="row" key={c.id}>
            <span>
              {c.name} · {c.kind} · {c.model}
              <small>
                {c.hasKey
                  ? "Kľúč uložený v systémovej kľúčenke"
                  : "Bez uloženého kľúča"}{" "}
                · Zúčtované / rezervované tokeny: {c.spentTokens} /{" "}
                {c.tokenBudget}
              </small>
            </span>
            <button
              onClick={() => {
                setEditing(c);
                setKind(c.kind);
              }}
            >
              Upraviť
            </button>
            <button
              onClick={() =>
                void action(async () => {
                  const result = await window.finance.testAI(c.id);
                  setTest(`${c.name}: spojenie funguje. ${result.summary}`);
                })
              }
            >
              Test na neosobnom doklade
            </button>
          </div>
        ))}
        {!state.configurations.length && (
          <p>Žiadny AI model nie je nastavený.</p>
        )}
        {test && <p role="status">{test}</p>}
      </section>
      <section>
        <h3>Priradenie modelov úlohám</h3>
        <form
          onSubmit={submit((v) =>
            window.finance.saveAIRoute({
              task: value(v, "task") as AITask,
              primaryId: value(v, "primary"),
              fallbackId: value(v, "fallback") || null,
              allowFallback: v.has("allow"),
            }),
          )}
        >
          <label>
            Úloha
            <select name="task">
              {Object.entries(taskNames).map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Primárny model
            <select name="primary" required>
              <option value="">Vyberte model</option>
              {state.configurations.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Záložný model
            <select name="fallback">
              <option value="">Bez zálohy</option>
              {state.configurations.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input name="allow" type="checkbox" />
            Povoliť náhradný model pri chybe
          </label>
          <button>Uložiť priradenie</button>
        </form>
        {state.routes.map((r) => (
          <p key={r.task}>
            {taskNames[r.task]}:{" "}
            {state.configurations.find((c) => c.id === r.primaryId)?.name}{" "}
            {r.allowFallback && r.fallbackId
              ? " → " +
                state.configurations.find((c) => c.id === r.fallbackId)?.name
              : ""}
          </p>
        ))}
      </section>
      <section>
        <h3>Spotreba</h3>
        {state.usage.map((u, i) => (
          <p key={i}>
            {u.createdAt} ·{" "}
            {state.configurations.find((c) => c.id === u.providerId)?.name} ·{" "}
            {u.inputTokens === null
              ? "Neznáma spotreba — rezervovaný limit"
              : `${u.inputTokens} + ${u.outputTokens} tokenov`}{" "}
            ·{" "}
            {u.costMicros === null
              ? "Cena nenastavená"
              : (u.costMicros / 1000000).toFixed(6) + " EUR (odhad)"}
          </p>
        ))}
      </section>
    </>
  );
}
