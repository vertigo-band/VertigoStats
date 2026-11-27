import { useState } from "react";
import { SOURCE_LABEL, type Extraction, type Source } from "../extract/schemas";
import { parseNum } from "../lib/numbers";

type ArrKey = "meta_creatives" | "hypeddit_links" | "spotify_songs";
const ARR: Record<Exclude<Source, "unknown">, ArrKey> = { meta_ads: "meta_creatives", hypeddit: "hypeddit_links", spotify: "spotify_songs" };
interface Field { key: string; label: string; text?: boolean }
const FIELDS: Record<ArrKey, Field[]> = {
  spotify_songs: [
    { key: "title", label: "Song", text: true },
    { key: "streams", label: "Streams" }, { key: "listeners", label: "Listeners" },
    { key: "saves", label: "Saves" }, { key: "playlist_adds", label: "Playlist adds" },
  ],
  meta_creatives: [
    { key: "ad_name", label: "Ad name", text: true },
    { key: "spend", label: "Spend" }, { key: "impressions", label: "Impressions" }, { key: "reach", label: "Reach" },
    { key: "clicks", label: "Clicks" }, { key: "ctr_percent", label: "CTR %" }, { key: "cpc", label: "CPC" },
    { key: "cpm", label: "CPM" }, { key: "results", label: "Results" }, { key: "result_type", label: "Result type", text: true },
    { key: "cost_per_result", label: "Cost / result" },
  ],
  hypeddit_links: [
    { key: "link_name", label: "Link", text: true },
    { key: "visits", label: "Visits" }, { key: "clicks", label: "Clicks" },
    { key: "conversion_percent", label: "Conversion %" }, { key: "follows_or_presaves", label: "Follows / pre-saves" },
  ],
};
const EMPTY: Record<ArrKey, any> = {
  spotify_songs: { title: "", streams: null, listeners: null, saves: null, playlist_adds: null },
  meta_creatives: { ad_name: "", campaign_name: null, spend: null, impressions: null, reach: null, clicks: null, ctr_percent: null, cpc: null, cpm: null, results: null, result_type: null, cost_per_result: null },
  hypeddit_links: { link_name: "", visits: null, clicks: null, conversion_percent: null, service_clicks: [], follows_or_presaves: null },
};

export interface ReviewProps {
  previewUrl: string;
  initial: Extraction;
  snapshotDate: string;
  onSave: (e: Extraction, snapshotDate: string) => Promise<void>;
  onDiscard: () => void;
}

/** Editable check of what Claude read, shown next to the screenshot, before anything is saved. */
export default function Review({ previewUrl, initial, snapshotDate: initialDate, onSave, onDiscard }: ReviewProps) {
  const [e, setE] = useState<Extraction>(initial);
  const [date, setDate] = useState(initialDate);
  const [zoom, setZoom] = useState(false);
  const [saving, setSaving] = useState(false);
  const arrKey = e.source === "unknown" ? null : ARR[e.source];
  const rows: any[] = arrKey ? (e[arrKey] as any[]) : [];
  const nameKey = arrKey ? FIELDS[arrKey][0].key : "";
  const valid = !!arrKey && rows.length > 0 && rows.every(r => String(r[nameKey] ?? "").trim());

  const setRow = (i: number, key: string, raw: string, text?: boolean) =>
    setE(prev => {
      const list = [...(prev[arrKey!] as any[])];
      list[i] = { ...list[i], [key]: text ? (raw.trim() ? raw : key === nameKey ? "" : null) : parseNum(raw) };
      return { ...prev, [arrKey!]: list };
    });

  return (
    <div className="card space-y-3">
      <div className="flex gap-3">
        <button onClick={() => setZoom(z => !z)} className={`${zoom ? "w-full" : "w-20"} shrink-0 overflow-hidden rounded-lg border border-white/10 transition-all`} aria-label="Toggle screenshot size">
          <img src={previewUrl} alt="Screenshot" className="w-full" />
        </button>
        {!zoom && (
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block">
              <span className="label">Source</span>
              <select className="input mt-0.5" value={e.source}
                onChange={ev => setE({ ...e, source: ev.target.value as Source })}>
                {(Object.keys(SOURCE_LABEL) as Source[]).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Period</span>
                <input className="input mt-0.5" value={e.period_label ?? ""} placeholder="e.g. Last 28 days"
                  onChange={ev => setE({ ...e, period_label: ev.target.value || null })} />
              </label>
              <label className="block">
                <span className="label">Snapshot date</span>
                <input type="date" className="input mt-0.5" value={date} onChange={ev => setDate(ev.target.value)} />
              </label>
            </div>
          </div>
        )}
      </div>

      {e.notes && <p className="rounded-lg bg-[#d28e05]/10 px-3 py-2 text-xs text-[#efefef]">⚠ {e.notes}</p>}
      {!arrKey && <p className="text-sm text-[#9c9c9c]">This doesn't look like a Meta Ads, Hypeddit or Spotify for Artists screenshot. Pick the source above if it is.</p>}

      {arrKey && rows.map((r, i) => (
        <fieldset key={i} className="rounded-xl border border-white/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS[arrKey].map((f, fi) => (
              <label key={f.key} className={`block ${fi === 0 ? "col-span-2" : ""}`}>
                <span className="label">{f.label}</span>
                <input className="input mt-0.5 tabular-nums" inputMode={f.text ? "text" : "decimal"}
                  defaultValue={r[f.key] ?? ""} placeholder="—"
                  onChange={ev => setRow(i, f.key, ev.target.value, f.text)} />
              </label>
            ))}
          </div>
          {arrKey === "hypeddit_links" && r.service_clicks?.length > 0 && (
            <p className="mt-2 text-xs text-[#9c9c9c]">By service: {r.service_clicks.map((s: any) => `${s.service} ${s.clicks ?? "—"}`).join(" · ")}</p>
          )}
          <button className="mt-2 text-xs text-[#9c9c9c] underline" onClick={() => setE(prev => ({ ...prev, [arrKey]: (prev[arrKey] as any[]).filter((_, j) => j !== i) }))}>Remove row</button>
        </fieldset>
      ))}
      {arrKey && (
        <button className="text-sm text-[#338ced]" onClick={() => setE(prev => ({ ...prev, [arrKey]: [...(prev[arrKey] as any[]), { ...EMPTY[arrKey] }] }))}>+ Add row</button>
      )}

      <div className="flex gap-2 pt-1">
        <button className="btn-ghost flex-1" onClick={onDiscard} disabled={saving}>Discard</button>
        <button className="btn-primary flex-1" disabled={!valid || saving || !date}
          onClick={async () => { setSaving(true); try { await onSave(e, date); } finally { setSaving(false); } }}>
          {saving ? "Saving…" : `Save ${rows.length || ""} ${rows.length === 1 ? "row" : "rows"}`}
        </button>
      </div>
    </div>
  );
}
