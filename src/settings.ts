// Per-device settings. Wrapped in try/catch: storage can be unavailable (private mode, cleared data).
export interface Settings {
  anthropicKey: string;
  googleClientId: string;
  spreadsheetId: string;
  currency: string;
}

const KEY = "promo-tracker-settings";
const defaults: Settings = {
  anthropicKey: "",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  spreadsheetId: "",
  currency: "USD",
};

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    if (!s.googleClientId) s.googleClientId = defaults.googleClientId;
    return s;
  } catch {
    return { ...defaults };
  }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  window.dispatchEvent(new Event("promo-settings-changed"));
  return next;
}
