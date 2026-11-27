/** Parse numbers as they appear on dashboards: "1.2K", "$3,456.70", "4.5%", "2.1M", "—". */
export function parseNum(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  if (!s || /^[-–—]+$/.test(s)) return null;
  s = s.replace(/[\s ]/g, "").replace(/[$€£¥₹%]/g, "").replace(/^[A-Za-z]{1,3}(?=[-\d.,])/, ""); // "USD 10", "US$5" → number
  const m = s.match(/^(-?[\d,]*\.?\d+)([kKmMbB])?$/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(n * mult * 1e6) / 1e6;
}

export function fmt(n: number | null | undefined, opts: { digits?: number; currency?: string; pct?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (opts.pct) return `${n.toFixed(opts.digits ?? 2)}%`;
  if (opts.currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: opts.currency, maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${opts.currency} ${n.toFixed(2)}`;
    }
  }
  const digits = opts.digits ?? (Math.abs(n) < 10 && !Number.isInteger(n) ? 2 : 0);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

/** Compact, e.g. 12.3K, for chart axes. */
export function compact(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
