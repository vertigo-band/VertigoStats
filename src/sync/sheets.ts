import { db } from "../db";
import { deriveSong } from "../lib/metrics";
import { getSettings, setSettings } from "../settings";

/* Google Sheets sync.
 * Auth: Google Identity Services token client, scope drive.file (the app can only see the sheet it created).
 * Sync is a full, idempotent rewrite of each tab from the on-device database, so edits and re-imports
 * on the phone are always reflected exactly — no duplicate rows. */

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const TABS = ["Songs", "Ads", "Hypeddit", "Screenshots"] as const;

declare global {
  interface Window { google?: any }
}

let token: { value: string; expires: number } | null = null;
try {
  const t = JSON.parse(sessionStorage.getItem("gtoken") ?? "null");
  if (t && t.expires > Date.now()) token = t;
} catch { /* ignore */ }

export type SyncState = { status: "idle" | "syncing" | "needs-auth" | "error" | "done"; message?: string; at?: string };
let state: SyncState = { status: "idle" };
const listeners = new Set<(s: SyncState) => void>();
function setState(s: SyncState) { state = s; listeners.forEach(l => l(s)); }
export function onSyncState(l: (s: SyncState) => void) { listeners.add(l); l(state); return () => { listeners.delete(l); }; }

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Couldn't load Google sign-in"));
    document.head.appendChild(s);
  });
}

export const isConnected = () => !!getSettings().spreadsheetId;
export const hasValidToken = () => !!token && token.expires > Date.now() + 60_000;

/** Must be called from a tap (it may open Google's consent popup). */
export async function connectGoogle(): Promise<void> {
  const { googleClientId } = getSettings();
  if (!googleClientId) throw new Error("Add your Google OAuth client ID in Settings first.");
  await loadGis();
  await new Promise<void>((res, rej) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: SCOPE,
      callback: (r: any) => {
        if (r.error) return rej(new Error(r.error_description || r.error));
        token = { value: r.access_token, expires: Date.now() + Number(r.expires_in ?? 3600) * 1000 };
        try { sessionStorage.setItem("gtoken", JSON.stringify(token)); } catch { /* ignore */ }
        res();
      },
      error_callback: (e: any) => rej(new Error(e?.message || "Google sign-in was cancelled")),
    });
    client.requestAccessToken({ prompt: isConnected() ? "" : "consent" });
  });
  await syncNow();
}

export function disconnectGoogle() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
  try { sessionStorage.removeItem("gtoken"); } catch { /* ignore */ }
  setSettings({ spreadsheetId: "" });
  setState({ status: "idle" });
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token!.value}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const err: any = new Error(`Google Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function ensureSpreadsheet(): Promise<string> {
  const { spreadsheetId } = getSettings();
  if (spreadsheetId) {
    try {
      const meta = await api(`/${spreadsheetId}?fields=sheets.properties.title`);
      const have = new Set<string>(meta.sheets.map((s: any) => s.properties.title));
      const missing = TABS.filter(t => !have.has(t));
      if (missing.length)
        await api(`/${spreadsheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) }) });
      return spreadsheetId;
    } catch (e: any) {
      if (e.status !== 404 && e.status !== 403) throw e; // sheet deleted → recreate below
    }
  }
  const created = await api("", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: "Music Promo Tracker" },
      sheets: TABS.map(title => ({ properties: { title, gridProperties: { frozenRowCount: 1 } } })),
    }),
  });
  setSettings({ spreadsheetId: created.spreadsheetId });
  return created.spreadsheetId;
}

export async function buildTables(): Promise<Record<(typeof TABS)[number], (string | number | null)[][]>> {
  const [songs, ads, links, shots] = await Promise.all([
    db.songMetrics.orderBy("snapshotDate").toArray(),
    db.adMetrics.orderBy("snapshotDate").toArray(),
    db.linkMetrics.orderBy("snapshotDate").toArray(),
    db.screenshots.orderBy("importedAt").toArray(),
  ]);
  const P = ["Snapshot date", "Period", "Period start", "Period end"];
  const p = (r: { snapshotDate: string; periodLabel: string | null; periodStart: string | null; periodEnd: string | null }) =>
    [r.snapshotDate, r.periodLabel, r.periodStart, r.periodEnd];
  return {
    Songs: [
      [...P, "Song", "Streams", "Listeners", "Streams / listener", "Saves", "Save rate %", "Playlist adds"],
      ...songs.map(r => { const d = deriveSong(r); return [...p(r), r.title, r.streams, r.listeners, d.streamsPerListener, r.saves, d.saveRatePercent, r.playlistAdds]; }),
    ],
    Ads: [
      [...P, "Ad", "Campaign", "Currency", "Spend", "Impressions", "Reach", "Clicks", "CTR %", "CPC", "CPM", "Results", "Result type", "Cost / result"],
      ...ads.map(r => [...p(r), r.adName, r.campaignName, r.currency, r.spend, r.impressions, r.reach, r.clicks, r.ctrPercent, r.cpc, r.cpm, r.results, r.resultType, r.costPerResult]),
    ],
    Hypeddit: [
      [...P, "Link", "Visits", "Clicks", "Conversion %", "Follows / pre-saves", "Clicks by service"],
      ...links.map(r => [...p(r), r.linkName, r.visits, r.clicks, r.conversionPercent, r.followsOrPresaves, r.serviceClicks.map(s => `${s.service}: ${s.clicks ?? "—"}`).join("; ")]),
    ],
    Screenshots: [
      ["Imported at", "Snapshot date", "Source", "Period", "Notes"],
      ...shots.map(s => [s.importedAt, s.snapshotDate, s.source, s.periodLabel, s.notes]),
    ],
  };
}

let running: Promise<void> | null = null;

/** Push everything to the sheet. Safe to call any time; if offline or signed-out it just marks itself pending. */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    if (!getSettings().googleClientId) return;
    if (!hasValidToken()) {
      if (isConnected()) setState({ status: "needs-auth", message: "Tap to sync to Google Sheets" });
      return;
    }
    if (!navigator.onLine) { setState({ status: "error", message: "Offline — will sync when back online" }); return; }
    setState({ status: "syncing" });
    try {
      const id = await ensureSpreadsheet();
      const tables = await buildTables();
      await api(`/${id}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: TABS.map(t => `'${t}'`) }) });
      await api(`/${id}/values:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ valueInputOption: "RAW", data: TABS.map(t => ({ range: `'${t}'!A1`, values: tables[t].map(r => r.map(v => v ?? "")) })) }),
      });
      try { localStorage.removeItem("promo-sync-pending"); } catch { /* ignore */ }
      setState({ status: "done", at: new Date().toISOString() });
    } catch (e: any) {
      if (e.status === 401) { token = null; setState({ status: "needs-auth", message: "Google sign-in expired — tap to sync" }); }
      else setState({ status: "error", message: e.message });
    }
  })().finally(() => { running = null; });
  return running;
}

export function sheetUrl() {
  const { spreadsheetId } = getSettings();
  return spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null;
}

// Auto-sync whenever local data changes and when connectivity returns.
if (typeof window !== "undefined") {
  window.addEventListener("promo-data-changed", () => {
    try { localStorage.setItem("promo-sync-pending", "1"); } catch { /* ignore */ }
    void syncNow();
  });
  window.addEventListener("online", () => void syncNow());
}
