import type { SettingsState } from "../../../../packages/contracts/settings";
export function PreferencesPanel({
  settings,
  action,
}: {
  settings: SettingsState;
  action: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <section>
      <h3>Upozornenia a režim aplikácie</h3>
      <p>Dátový priečinok: {settings.dataDirectory}</p>
      <button
        onClick={() => void action(() => window.finance.chooseDataDirectory())}
      >
        Zmeniť dátový priečinok…
      </button>
      <form
        key={JSON.stringify(settings.preferences)}
        onSubmit={(event) => {
          event.preventDefault();
          const v = new FormData(event.currentTarget);
          void action(() =>
            window.finance.savePreferences({
              reminderDays: String(v.get("days"))
                .split(",")
                .map((n) => Number(n.trim())),
              background: v.has("background"),
              startAtLogin: v.has("startup"),
            }),
          );
        }}
      >
        <label>
          Dni pred splatnosťou (oddelené čiarkou)
          <input
            name="days"
            required
            defaultValue={settings.preferences.reminderDays.join(", ")}
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="background"
            defaultChecked={settings.preferences.background}
          />
          Po zatvorení okna ponechať aplikáciu na pozadí
        </label>
        <label>
          <input
            type="checkbox"
            name="startup"
            disabled={!settings.startupSupported}
            defaultChecked={settings.preferences.startAtLogin}
          />
          Spustiť po prihlásení do systému
        </label>
        <button>Uložiť upozornenia</button>
      </form>
      {!settings.startupSupported && (
        <p>
          Automatický štart nastavíte po nainštalovaní balíka pre Windows alebo
          Linux.
        </p>
      )}
      <p>
        Upozornenia sa doručujú, keď aplikácia beží. Počas vypnutia počítača ich
        nemožno zaručiť; po štarte zostávajú zmeškané povinnosti viditeľné.
      </p>
      <p>Sledovaný priečinok: {settings.watchFolder ?? "Nenastavený"}</p>
      <p>
        Posledná kompletná záloha:{" "}
        {settings.lastBackup
          ? new Date(settings.lastBackup).toLocaleString("sk-SK")
          : "Zatiaľ nevytvorená"}
      </p>
    </section>
  );
}
