import Dexie, { type Table } from "dexie";
import type { Extraction, Source } from "./extract/schemas";
import { deriveAd, deriveLink } from "./lib/metrics";

interface Period {
  id: string;
  snapshotDate: string; // YYYY-MM-DD — the day the screenshot's numbers were captured
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  screenshotId: string;
}

export interface AdRow extends Period {
  currency: string | null;
  adName: string;
  campaignName: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  ctrPercent: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  resultType: string | null;
  costPerResult: number | null;
}

export interface LinkRow extends Period {
  linkName: string;
  visits: number | null;
  clicks: number | null;
  conversionPercent: number | null;
  serviceClicks: { service: string; clicks: number | null }[];
  followsOrPresaves: number | null;
}

export interface SongRow extends Period {
  title: string;
  streams: number | null;
  listeners: number | null;
  saves: number | null;
  playlistAdds: number | null;
}

export interface Screenshot {
  id: string;
  importedAt: string;
  snapshotDate: string;
  source: Source;
  periodLabel: string | null;
  notes: string | null;
  blob: Blob;
}

class PromoDB extends Dexie {
  screenshots!: Table<Screenshot, string>;
  adMetrics!: Table<AdRow, string>;
  linkMetrics!: Table<LinkRow, string>;
  songMetrics!: Table<SongRow, string>;
  constructor() {
    super("promo-tracker");
    this.version(1).stores({
      screenshots: "id, importedAt, source",
      adMetrics: "id, snapshotDate, adName",
      linkMetrics: "id, snapshotDate, linkName",
      songMetrics: "id, snapshotDate, title",
    });
  }
}

export const db = new PromoDB();

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Stable key: the same entity + reporting period + snapshot day always maps to the same row (re-imports update, not duplicate). */
export function rowKey(name: string, e: Pick<Extraction, "period_label" | "period_start" | "period_end">, snapshotDate: string): string {
  const period = e.period_start || e.period_end ? `${e.period_start ?? ""}..${e.period_end ?? ""}` : norm(e.period_label ?? "");
  return `${norm(name)}|${period}|${snapshotDate}`;
}

export function toRows(e: Extraction, snapshotDate: string, screenshotId: string) {
  const base = { snapshotDate, periodLabel: e.period_label, periodStart: e.period_start, periodEnd: e.period_end, screenshotId };
  const ads: AdRow[] = e.meta_creatives.map(c =>
    deriveAd({
      ...base,
      id: rowKey(c.ad_name, e, snapshotDate),
      currency: e.currency,
      adName: c.ad_name.trim(),
      campaignName: c.campaign_name,
      spend: c.spend, impressions: c.impressions, reach: c.reach, clicks: c.clicks,
      ctrPercent: c.ctr_percent, cpc: c.cpc, cpm: c.cpm,
      results: c.results, resultType: c.result_type, costPerResult: c.cost_per_result,
    }),
  );
  const links: LinkRow[] = e.hypeddit_links.map(l =>
    deriveLink({
      ...base,
      id: rowKey(l.link_name, e, snapshotDate),
      linkName: l.link_name.trim(),
      visits: l.visits, clicks: l.clicks, conversionPercent: l.conversion_percent,
      serviceClicks: l.service_clicks, followsOrPresaves: l.follows_or_presaves,
    }),
  );
  const songs: SongRow[] = e.spotify_songs.map(s => ({
    ...base,
    id: rowKey(s.title, e, snapshotDate),
    title: s.title.trim(),
    streams: s.streams, listeners: s.listeners, saves: s.saves, playlistAdds: s.playlist_adds,
  }));
  return { ads, links, songs };
}

export async function saveExtraction(e: Extraction, snapshotDate: string, blob: Blob): Promise<{ ads: number; links: number; songs: number }> {
  const screenshotId = crypto.randomUUID();
  const { ads, links, songs } = toRows(e, snapshotDate, screenshotId);
  await db.transaction("rw", [db.screenshots, db.adMetrics, db.linkMetrics, db.songMetrics], async () => {
    await db.screenshots.put({
      id: screenshotId, importedAt: new Date().toISOString(), snapshotDate,
      source: e.source, periodLabel: e.period_label, notes: e.notes, blob,
    });
    await db.adMetrics.bulkPut(ads);
    await db.linkMetrics.bulkPut(links);
    await db.songMetrics.bulkPut(songs);
  });
  window.dispatchEvent(new Event("promo-data-changed"));
  return { ads: ads.length, links: links.length, songs: songs.length };
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
