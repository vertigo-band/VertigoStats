import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Extraction } from "../src/extract/schemas";

beforeAll(() => { (globalThis as any).window = new EventTarget(); });

const spotify = (streams: number): Extraction => ({
  source: "spotify", period_label: "Last 28 days", period_start: null, period_end: null, currency: null,
  meta_creatives: [], hypeddit_links: [], notes: null,
  spotify_songs: [
    { title: "Midnight Drive", streams, listeners: 1000, saves: 120, playlist_adds: 40 },
    { title: "Neon Rain", streams: 800, listeners: 500, saves: 60, playlist_adds: 12 },
  ],
});

describe("saving extractions", () => {
  it("re-importing the same screenshot updates instead of duplicating", async () => {
    const { db, saveExtraction } = await import("../src/db");
    await saveExtraction(spotify(2500), "2026-11-20", new Blob(["a"]));
    await saveExtraction(spotify(2600), "2026-11-20", new Blob(["a"])); // corrected re-import, same day
    expect(await db.songMetrics.count()).toBe(2);
    const md = await db.songMetrics.where("title").equals("Midnight Drive").toArray();
    expect(md).toHaveLength(1);
    expect(md[0].streams).toBe(2600);
  });

  it("a new snapshot date adds a new data point", async () => {
    const { db, saveExtraction } = await import("../src/db");
    await saveExtraction(spotify(3100), "2026-11-27", new Blob(["b"]));
    expect(await db.songMetrics.where("title").equals("Midnight Drive").count()).toBe(2);
  });

  it("row keys ignore case/spacing in names", async () => {
    const { rowKey } = await import("../src/db");
    const p = { period_label: "Last 7 days", period_start: null, period_end: null };
    expect(rowKey("  Midnight  Drive", p, "2026-11-01")).toBe(rowKey("midnight drive", p, "2026-11-01"));
  });

  it("derives ad metrics on save", async () => {
    const { toRows } = await import("../src/db");
    const { ads } = toRows({
      source: "meta_ads", period_label: "Nov 1 – Nov 26", period_start: "2026-11-01", period_end: "2026-11-26", currency: "USD",
      hypeddit_links: [], spotify_songs: [], notes: null,
      meta_creatives: [{ ad_name: "Reel A", campaign_name: null, spend: 40, impressions: 8000, reach: 5000, clicks: 160, ctr_percent: null, cpc: null, cpm: null, results: 20, result_type: "Link clicks", cost_per_result: null }],
    }, "2026-11-26", "x");
    expect(ads[0]).toMatchObject({ ctrPercent: 2, cpc: 0.25, cpm: 5, costPerResult: 2 });
  });
});
