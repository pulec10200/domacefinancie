import type { FinanceDatabase } from "../database";
import { preferences, type Preferences } from "../contracts/settings";
export class SettingsService {
  constructor(readonly db: FinanceDatabase) {}
  get(key: string) {
    return (
      (
        this.db.prepare("SELECT value FROM settings WHERE key=?").get(key) as
          { value: string } | undefined
      )?.value ?? null
    );
  }
  set(key: string, value: string) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, value);
  }
  preferences(): Preferences {
    const v = this.get("preferences");
    return v
      ? preferences.parse(JSON.parse(v))
      : {
          reminderDays: [14, 7, 3, 1, 0],
          background: false,
          startAtLogin: false,
        };
  }
  save(input: unknown) {
    const v = preferences.parse(input);
    this.set("preferences", JSON.stringify(v));
    return v;
  }
  shouldNotify(
    due: string,
    paid: number,
    amount: number,
    cancelled: boolean,
    today: string,
  ) {
    if (cancelled || paid >= amount) return false;
    const days = Math.round((+new Date(due) - +new Date(today)) / 86400000);
    return days < 0 || this.preferences().reminderDays.includes(days);
  }
  claimNotification(payableId: string, today: string, id: string) {
    return (
      this.db
        .prepare("INSERT OR IGNORE INTO notifications VALUES(?,?,?)")
        .run(id, payableId, today).changes > 0
    );
  }
}
