import { GOOD, BAD } from "../lib/palette";

/** ▲/▼ change badge. Icon + sign carry the meaning; color only reinforces it. */
export default function Delta({ pct, lowerIsBetter = false }: { pct: number | null; lowerIsBetter?: boolean }) {
  if (pct == null || !Number.isFinite(pct)) return <span className="text-xs text-[#9c9c9c]">new</span>;
  if (Math.abs(pct) < 0.05) return <span className="text-xs text-[#9c9c9c]">– 0%</span>;
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <span className="text-xs font-medium" style={{ color: good ? GOOD : BAD }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
    </span>
  );
}
