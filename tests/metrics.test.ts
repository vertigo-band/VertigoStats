import { describe, expect, it } from "vitest";
import { deriveAd, deriveLink, deriveSong, pctChange } from "../src/lib/metrics";

describe("derived metrics", () => {
  it("streams per listener and save rate", () => {
    const s = deriveSong({ streams: 3000, listeners: 1200, saves: 300 });
    expect(s.streamsPerListener).toBe(2.5);
    expect(s.saveRatePercent).toBe(25);
  });
  it("handles missing / zero listeners", () => {
    expect(deriveSong({ streams: 10, listeners: 0, saves: 1 }).streamsPerListener).toBeNull();
    expect(deriveSong({ streams: 10, listeners: null, saves: null }).saveRatePercent).toBeNull();
  });
  it("fills ad metrics only when missing", () => {
    const a = deriveAd({ spend: 50, impressions: 10000, clicks: 200, results: 25, ctrPercent: null, cpc: null, cpm: null, costPerResult: null });
    expect(a).toMatchObject({ ctrPercent: 2, cpc: 0.25, cpm: 5, costPerResult: 2 });
    expect(deriveAd({ spend: 50, clicks: 200, cpc: 0.3 }).cpc).toBe(0.3); // shown value wins
  });
  it("hypeddit conversion", () => {
    expect(deriveLink({ visits: 400, clicks: 100, conversionPercent: null }).conversionPercent).toBe(25);
  });
  it("pctChange", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(5, 0)).toBeNull();
  });
});
