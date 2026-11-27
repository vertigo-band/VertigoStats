/** Group rows by entity name and sort each group chronologically by snapshot date. */
export function groupByEntity<T extends { snapshotDate: string; periodEnd: string | null }>(rows: T[], name: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = name(r).trim();
    const key = [...m.keys()].find(x => x.toLowerCase() === k.toLowerCase()) ?? k;
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  for (const list of m.values()) list.sort((a, b) => (a.snapshotDate + (a.periodEnd ?? "")).localeCompare(b.snapshotDate + (b.periodEnd ?? "")));
  return m;
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
