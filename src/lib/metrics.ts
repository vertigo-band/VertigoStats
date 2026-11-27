import type { AdRow, LinkRow, SongRow } from "../db";

const div = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a == null || b == null || b === 0 ? null : a / b;
const round = (n: number | null, d = 4) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Fill CTR / CPC / CPM / cost-per-result from raw numbers when the screenshot didn't show them. */
export function deriveAd<T extends Partial<AdRow>>(r: T): T {
  return {
    ...r,
    ctrPercent: r.ctrPercent ?? round(mul100(div(r.clicks, r.impressions)), 2),
    cpc: r.cpc ?? round(div(r.spend, r.clicks), 2),
    cpm: r.cpm ?? round(mul1000(div(r.spend, r.impressions)), 2),
    costPerResult: r.costPerResult ?? round(div(r.spend, r.results), 2),
  };
}

export function deriveLink<T extends Partial<LinkRow>>(r: T): T {
  return { ...r, conversionPercent: r.conversionPercent ?? round(mul100(div(r.clicks, r.visits)), 2) };
}

export function deriveSong<T extends Partial<SongRow>>(r: T): T & { streamsPerListener: number | null; saveRatePercent: number | null } {
  return {
    ...r,
    streamsPerListener: round(div(r.streams, r.listeners), 2),
    saveRatePercent: round(mul100(div(r.saves, r.listeners)), 2),
  };
}

function mul100(n: number | null) { return n == null ? null : n * 100; }
function mul1000(n: number | null) { return n == null ? null : n * 1000; }

/** Percent change from previous to current; null when not computable. */
export function pctChange(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
