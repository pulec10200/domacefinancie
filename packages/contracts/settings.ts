import { z } from "zod";
export const preferences = z.object({
  reminderDays: z
    .array(z.number().int().min(0).max(365))
    .min(1)
    .max(20)
    .refine((v) => new Set(v).size === v.length, "Dni sa nesmú opakovať."),
  background: z.boolean(),
  startAtLogin: z.boolean(),
});
export type Preferences = z.infer<typeof preferences>;
export type SettingsState = {
  preferences: Preferences;
  startupSupported: boolean;
  watchFolder: string | null;
  lastBackup: string | null;
  dataDirectory: string;
};
export interface SettingsApi {
  settings(): Promise<SettingsState>;
  chooseDataDirectory(): Promise<void>;
  savePreferences(v: Preferences): Promise<void>;
}
