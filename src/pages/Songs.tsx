import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { db, type SongRow } from "../db";
import Delta from "../components/Delta";
import { deriveSong, pctChange } from "../lib/metrics";
import { fmt } from "../lib/numbers";
import { SERIES } from "../lib/palette";
import { groupByEntity, shortDate } from "../lib/series";
import { useLive } from "../lib/useLive";

const METRICS: { key: "streams" | "listeners" | "streamsPerListener" | "saves" | "playlistAdds"; label: string }[] = [
  { key: "streams", label: "Streams" },
  { key: "listeners", label: "Listeners" },
  { key: "streamsPerListener", label: "Streams / listener" },
  { key: "saves", label: "Saves" },
  { key: "playlistAdds", label: "Playlist adds" },
];

export default function Songs({ onAdd }: { onAdd: () => void }) {
  const rows = useLive(() => db.songMetrics.toArray(), [], [] as SongRow[]);
  const groups = [...groupByEntity(rows, r => r.title)]
    .map(([title, list]) => ({ title, list: list.map(deriveSong) }))
    .sort((a, b) => (b.list.at(-1)!.streams ?? 0) - (a.list.at(-1)!.streams ?? 0));

  if (!groups.length)
    return (
      <div className="card mt-4 text-center">
        <p className="text-sm text-[#9c9c9c]">No songs yet. Add a Spotify for Artists screenshot to start tracking streams, listeners, saves and playlist adds.</p>
        <button className="btn-primary mt-4" onClick={onAdd}>+ Add screenshots</button>
      </div>
    );

  return (
    <div className="space-y-3">
      {groups.map(({ title, list }) => {
        const curr = list.at(-1)!, prev = list.at(-2);
        return (
          <article key={title} className="card" aria-label={title}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{title}</h2>
                <p className="text-xs text-[#9c9c9c]">
                  {curr.periodLabel ?? "Period not shown"} · as of {shortDate(curr.snapshotDate)}
                  {prev && ` · vs ${shortDate(prev.snapshotDate)}`}
                </p>
              </div>
              {list.length > 1 && (
                <div className="h-10 w-24 shrink-0" aria-hidden>
                  <ResponsiveContainer>
                    <LineChart data={list} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Line dataKey="streams" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3">
              {METRICS.map(m => (
                <div key={m.key}>
                  <dt className="label">{m.label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{fmt(curr[m.key], { digits: m.key === "streamsPerListener" ? 2 : 0 })}</dd>
                  <dd>{prev ? <Delta pct={pctChange(curr[m.key], prev[m.key])} /> : <span className="text-xs text-[#9c9c9c]">first snapshot</span>}</dd>
                </div>
              ))}
              <div>
                <dt className="label">Save rate</dt>
                <dd className="text-lg font-semibold tabular-nums">{fmt(curr.saveRatePercent, { pct: true, digits: 1 })}</dd>
                <dd className="text-xs text-[#9c9c9c]">saves ÷ listeners</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}
