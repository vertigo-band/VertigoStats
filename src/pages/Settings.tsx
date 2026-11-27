import { useEffect, useState } from "react";
import { db } from "../db";
import { getSettings, setSettings } from "../settings";
import { buildTables, connectGoogle, disconnectGoogle, isConnected, onSyncState, sheetUrl, syncNow, type SyncState } from "../sync/sheets";

function toCsv(rows: (string | number | null)[][]) {
  return rows.map(r => r.map(v => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}

export default function Settings() {
  const [s, setS] = useState(getSettings);
  const [showKey, setShowKey] = useState(false);
  const [sync, setSync] = useState<SyncState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  useEffect(() => onSyncState(setSync), []);
  useEffect(() => {
    const h = () => setS(getSettings());
    window.addEventListener("promo-settings-changed", h);
    return () => window.removeEventListener("promo-settings-changed", h);
  }, []);
  const save = (patch: Partial<typeof s>) => setS(setSettings(patch));

  const exportCsv = async (tab: "Songs" | "Ads" | "Hypeddit") => {
    const t = await buildTables();
    const url = URL.createObjectURL(new Blob([toCsv(t[tab])], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `promo-tracker-${tab.toLowerCase()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h2 className="font-semibold">Screenshot reading</h2>
        <p className="text-xs text-[#9c9c9c]">
          Uses your own Anthropic API key (console.anthropic.com → API keys). It's stored only on this phone, and screenshots are sent only to Anthropic's API. Costs about a cent or two per screenshot.
        </p>
        <div className="flex gap-2">
          <input className="input" type={showKey ? "text" : "password"} autoComplete="off" placeholder="sk-ant-…" value={s.anthropicKey}
            onChange={e => save({ anthropicKey: e.target.value.trim() })} aria-label="Anthropic API key" />
          <button className="btn-ghost px-3" onClick={() => setShowKey(v => !v)}>{showKey ? "Hide" : "Show"}</button>
        </div>
        {s.anthropicKey && <p className="text-xs text-[#53c556]">✓ Key saved</p>}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Google Sheets sync</h2>
        <p className="text-xs text-[#9c9c9c]">
          Creates a "Music Promo Tracker" spreadsheet in your Google Drive and keeps it updated. The app can only access the sheet it created. Setup steps are in the README.
        </p>
        <label className="block">
          <span className="label">OAuth client ID</span>
          <input className="input mt-0.5" placeholder="…apps.googleusercontent.com" value={s.googleClientId}
            onChange={e => save({ googleClientId: e.target.value.trim() })} />
        </label>
        {isConnected() ? (
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={sheetUrl()!} target="_blank" rel="noreferrer">Open sheet</a>
            <button className="btn-ghost" disabled={busy} onClick={async () => { setBusy(true); try { await connectGoogle(); } catch (e: any) { alert(e.message); } finally { setBusy(false); } }}>Sync now</button>
            <button className="btn-ghost" onClick={() => { if (confirm("Disconnect Google? Your sheet stays in Drive.")) disconnectGoogle(); }}>Disconnect</button>
          </div>
        ) : (
          <button className="btn-primary w-full" disabled={!s.googleClientId || busy}
            onClick={async () => { setBusy(true); try { await connectGoogle(); } catch (e: any) { alert(e.message); } finally { setBusy(false); } }}>
            Connect Google account
          </button>
        )}
        {sync.status === "done" && sync.at && <p className="text-xs text-[#9c9c9c]">Last synced {new Date(sync.at).toLocaleString()}</p>}
        {sync.status === "error" && <p className="text-xs text-[#eb6263]">⚠ {sync.message}</p>}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Your data</h2>
        <label className="block">
          <span className="label">Default currency</span>
          <input className="input mt-0.5 w-28 uppercase" maxLength={3} value={s.currency} onChange={e => save({ currency: e.target.value.toUpperCase() })} />
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          {(["Songs", "Ads", "Hypeddit"] as const).map(t => <button key={t} className="btn-ghost" onClick={() => exportCsv(t)}>Export {t} CSV</button>)}
        </div>
        <button className="pt-2 text-xs text-[#eb6263] underline"
          onClick={async () => {
            if (!confirm("Delete all tracked data on this phone? (Your Google Sheet is not touched until the next sync.)")) return;
            await Promise.all([db.screenshots.clear(), db.adMetrics.clear(), db.linkMetrics.clear(), db.songMetrics.clear()]);
            void syncNow();
          }}>
          Delete all data on this phone
        </button>
      </section>
    </div>
  );
}
