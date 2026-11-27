import { describe, expect, it } from "vitest";
import { normalizeExtraction, type ApiExtraction } from "../src/extract/schemas";

const base: ApiExtraction = {
  source: "spotify", period_label: "", period_start: "", period_end: "", currency: "", notes: "",
  meta_creatives: [], hypeddit_links: [], spotify_songs: [],
};

describe("normalizeExtraction", () => {
  it("turns displayed text into numbers and blanks into null", () => {
    const e = normalizeExtraction({
      ...base, period_label: "Last 28 days", period_start: "Nov 1", period_end: "2026-11-26",
      spotify_songs: [{ title: " Midnight Drive ", streams: "6.1K", listeners: "2,410", saves: "", playlist_adds: "140" }],
    });
    expect(e.period_label).toBe("Last 28 days");
    expect(e.period_start).toBeNull(); // not ISO → dropped
    expect(e.period_end).toBe("2026-11-26");
    expect(e.notes).toBeNull();
    expect(e.spotify_songs[0]).toEqual({ title: "Midnight Drive", streams: 6100, listeners: 2410, saves: null, playlist_adds: 140 });
  });

  it("handles ad money/percent formats", () => {
    const e = normalizeExtraction({
      ...base, source: "meta_ads", currency: "usd",
      meta_creatives: [{ ad_name: "Reel A", campaign_name: "", spend: "US$84.20", impressions: "21,450", reach: "15.2K", clicks: "512",
        ctr_percent: "2.39%", cpc: "$0.16", cpm: "$3.93", results: "512", result_type: "Link clicks", cost_per_result: "—" }],
    });
    expect(e.currency).toBe("USD");
    expect(e.meta_creatives[0]).toMatchObject({ campaign_name: null, spend: 84.2, impressions: 21450, reach: 15200, ctr_percent: 2.39, cpc: 0.16, cost_per_result: null });
  });

  it("hypeddit service clicks", () => {
    const e = normalizeExtraction({
      ...base, source: "hypeddit",
      hypeddit_links: [{ link_name: "Smart link", visits: "640", clicks: "402", conversion_percent: "62.8%", follows_or_presaves: "",
        service_clicks: [{ service: "Spotify", clicks: "331" }, { service: "Apple Music", clicks: "" }] }],
    });
    expect(e.hypeddit_links[0].service_clicks).toEqual([{ service: "Spotify", clicks: 331 }, { service: "Apple Music", clicks: null }]);
    expect(e.hypeddit_links[0].follows_or_presaves).toBeNull();
  });
});
