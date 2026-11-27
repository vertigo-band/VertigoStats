import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { db, type AdRow, type LinkRow, type SongRow } from "../db";
import { deriveSong } from "../lib/metrics";
import { compact, fmt } from "../lib/numbers";
import { INK, SERIES } from "../lib/palette";
import { groupByEntity, shortDate } from "../lib/series";
import { useLive } from "../lib/useLive";
import { getSettings } from "../settings";

type Kind = "songs" | "ads" | "links";
interface Metric { key: string; label: string; kind?: "money" | "pct" | "ratio"; lowerIsBetter?: boolean }

const METRICS: Record<Kind, Metric[]> = {
  songs: [
    { key: "streams", label: "Streams" },
    { key: "listeners", label: "Listeners" },
    { key: "streamsPerListener", label: "Streams / listener", kind: "ratio" },
    { key: "saves", label: "Saves" },
    { key: "playlistAdds", label: "Playlist adds" },
    { key: "saveRatePercent", label: "Save rate", kind: "pct" },
  ],
  ads: [
    { key: "costPerResult", label: "Cost / result", kind: "money", lowerIsBetter: true },
    { key: "ctrPercent", label: "CTR", kind: "pct" },
    { key: "cpc", label: "CPC", kind: "money", lowerIsBetter: true },
    { key: "cpm", label: "CPM", kind: "money", lowerIsBetter: true },
    { key: "spend", label: "Spend", kind: "money" },
    { key: "results", label: "Results" },
    { key: "clicks", label: "Clicks" },
    { key: "impressions", label: "Impressions" },
  ],
  links: [
    { key: "visits", label: "Visits" },
    { key: "clicks", label: "Clicks" },
    { key: "conversionPercent", label: "Conversion", kind: "pct" },
    { key: "followsOrPresaves", label: "Follows / pre-saves" },
  ],
};
const KIND_LABEL: Record<Kind, string> = { songs: "Songs", ads: "Ad creatives", links: "Hypeddit" };
const MAX_SERIES = SERIES.length;

type AnyRow = (SongRow & ReturnType<typeof deriveSong>) | AdRow | LinkRow;

export default function Trends() {
  const [kind, setKind] = useState<Kind>("songs");
  const [metricKey, setMetricKey] = useState("streams");
  const songs = useLive(() => db.songMetrics.toArray(), [], [] as SongRow[]);
  const ads = useLive(() => db.adMetrics.toArray(), [], [] as AdRow[]);
  const links = useLive(() => db.linkMetrics.toArray(), [], [] as LinkRow[]);
  const currency = ads.find(a => a.currency)?.currency ?? getSettings().currency;

  const metric = METRICS[kind].find(m => m.key === metricKey) ?? METRICS[kind][0];
  const groups = useMemo(() => {
    const rows: AnyRow[] = kind === "songs" ? songs.map(deriveSong) : kind === "ads" ? ads : links;
    const name = (r: any) => (kind === "songs" ? r.title : kind === "ads" ? r.adName : r.linkName) as string;
    return groupByEntity(rows as any[], name) as Map<string, any[]>;
  }, [kind, songs, ads, links]);
  const entities = useMemo(
    () => [...groups.keys()].sort((a, b) => (groups.get(b)!.at(-1)[metric.key] ?? -Infinity) - (groups.get(a)!.at(-1)[metric.key] ?? -Infinity)),
    [groups, metric.key],
  );

  // Color follows the entity: a slot is assigned on selection and kept until deselected.
  const [slots, setSlots] = useState<Record<string, number>>({});
  useEffect(() => {
    setSlots(prev => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([e]) => groups.has(e)));
      if (Object.keys(kept).length) return kept;
      return Object.fromEntries(entities.slice(0, 5).map((e, i) => [e, i]));
    });
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (e: string) =>
    setSlots(prev => {
      if (e in prev) { const { [e]: _, ...rest } = prev; return rest; }
      const used = new Set(Object.values(prev));
      const free = [...Array(MAX_SERIES).keys()].find(i => !used.has(i));
      return free === undefined ? prev : { ...prev, [e]: free };
    });
  const selected = entities.filter(e => e in slots);

  const data = useMemo(() => {
    const dates = [...new Set([...groups.values()].flat().map(r => r.snapshotDate))].sort();
    return dates.map(d => {
      const point: Record<string, any> = { date: d };
      selected.forEach((e, i) => {
        const hit = groups.get(e)!.filter(r => r.snapshotDate === d).at(-1);
        point[`s${i}`] = hit?.[metric.key] ?? null;
      });
      return point;
    });
  }, [groups, selected, metric.key]);

  const fmtV = (v: number | null) =>
    fmt(v, metric.kind === "money" ? { currency: currency ?? undefined } : metric.kind === "pct" ? { pct: true, digits: 2 } : metric.kind === "ratio" ? { digits: 2 } : {});

  const switchKind = (k: Kind) => { setKind(k); setMetricKey(METRICS[k][0].key); setSlots({}); };

  return (
    <div className="space-y-3">
      <div className="flex rounded-full bg-white/5 p-1" role="tablist">
        {(Object.keys(KIND_LABEL) as Kind[]).map(k => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => switchKind(k)}
            className={`flex-1 rounded-full py-2 text-sm ${kind === k ? "bg-[#191919] font-medium text-[#efefef]" : "text-[#9c9c9c]"}`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Metric">
        {METRICS[kind].map(m => (
          <button key={m.key} onClick={() => setMetricKey(m.key)}
            className={`chip ${m.key === metric.key ? "border-[#338ced] bg-[#338ced]/15 text-[#efefef]" : "border-white/15 text-[#9c9c9c]"}`}>
            {m.label}
          </button>
        ))}
      </div>

      {!entities.length ? (
        <div className="card text-sm text-[#9c9c9c]">No {KIND_LABEL[kind].toLowerCase()} data yet. Add a screenshot from {kind === "songs" ? "Spotify for Artists" : kind === "ads" ? "Meta Ads Manager" : "Hypeddit"}.</div>
      ) : (
        <section className="card">
          <h2 className="text-sm font-semibold">{metric.label}{metric.lowerIsBetter && <span className="font-normal text-[#9c9c9c]"> · lower is better</span>}</h2>
          <p className="text-xs text-[#9c9c9c]">by snapshot date · tap names to show/hide (max {MAX_SERIES})</p>
          {/* Legend + filter in one: swatch carries identity, name in text ink */}
          <div className="mt-3 flex flex-wrap gap-2">
            {entities.map(e => {
              const on = e in slots;
              return (
                <button key={e} onClick={() => toggle(e)} aria-pressed={on}
                  className={`chip flex items-center gap-1.5 ${on ? "border-white/20 text-[#efefef]" : "border-white/10 text-[#9c9c9c]/70"}`}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: on ? SERIES[slots[e]] : "transparent", border: on ? "none" : "1px solid #474747" }} />
                  <span className="max-w-[10rem] truncate">{e}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 h-64">
            {data.length < 2 && <p className="mb-2 text-xs text-[#9c9c9c]">Only one snapshot so far. Add newer screenshots over time to see a trend line.</p>}
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={INK.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} stroke={INK.axis} tick={{ fill: INK.secondary, fontSize: 11 }} tickLine={false} />
                <YAxis stroke={INK.axis} tick={{ fill: INK.secondary, fontSize: 11 }} tickLine={false} axisLine={false} width={48}
                  tickFormatter={v => (metric.kind === "pct" ? `${v}%` : metric.kind === "ratio" ? Number(v).toFixed(1) : compact(v))} />
                <Tooltip
                  cursor={{ stroke: INK.axis }}
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: INK.primary, marginBottom: 4 }}
                  itemStyle={{ color: INK.primary, padding: 0 }}
                  labelFormatter={l => shortDate(String(l))}
                  formatter={(v: any, key: any) => [fmtV(v), selected[Number(String(key).slice(1))]]}
                />
                {selected.map((e, i) => (
                  <Line key={e} dataKey={`s${i}`} name={e} stroke={SERIES[slots[e]]} strokeWidth={2} connectNulls isAnimationActive={false}
                    dot={{ r: 4, strokeWidth: 2, stroke: INK.surface, fill: SERIES[slots[e]] }} activeDot={{ r: 5, stroke: INK.surface, strokeWidth: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {!!entities.length && (
        <section className="card overflow-x-auto">
          <h2 className="mb-2 text-sm font-semibold">Latest values</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#9c9c9c]">
                <th className="py-1 pr-2 font-normal">{kind === "songs" ? "Song" : kind === "ads" ? "Ad" : "Link"}</th>
                <th className="py-1 pr-2 text-right font-normal">{metric.label}</th>
                <th className="py-1 text-right font-normal">As of</th>
              </tr>
            </thead>
            <tbody>
              {entities.map(e => {
                const last = groups.get(e)!.at(-1);
                return (
                  <tr key={e} className="border-t border-white/5">
                    <td className="max-w-[12rem] truncate py-1.5 pr-2">{e}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmtV(last[metric.key])}</td>
                    <td className="py-1.5 text-right text-xs text-[#9c9c9c]">{shortDate(last.snapshotDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
