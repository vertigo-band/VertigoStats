import { z } from "zod/v4";
import { parseNum } from "../lib/numbers";

/* ---------- Shape the rest of the app works with ---------- */

export type Source = "meta_ads" | "hypeddit" | "spotify" | "unknown";

export interface MetaCreative {
  ad_name: string;
  campaign_name: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  ctr_percent: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  result_type: string | null;
  cost_per_result: number | null;
}

export interface HypedditLink {
  link_name: string;
  visits: number | null;
  clicks: number | null;
  conversion_percent: number | null;
  service_clicks: { service: string; clicks: number | null }[];
  follows_or_presaves: number | null;
}

export interface SpotifySong {
  title: string;
  streams: number | null;
  listeners: number | null;
  saves: number | null;
  playlist_adds: number | null;
}

export interface Extraction {
  source: Source;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  currency: string | null;
  meta_creatives: MetaCreative[];
  hypeddit_links: HypedditLink[];
  spotify_songs: SpotifySong[];
  notes: string | null;
}

/* ---------- Schema sent to the API ----------
 * Structured outputs allow at most 16 nullable/union fields per schema, so this schema has none:
 * every value is a plain string and "" means "not shown". normalizeExtraction() converts it. */

const num = (what: string) => z.string().describe(`${what}, copied as shown (e.g. "1.2K", "$12.50", "1.85%"), or "" if not visible`);
const text = (what: string) => z.string().describe(`${what}, or "" if not shown`);

export const ApiExtraction = z.object({
  source: z.enum(["meta_ads", "hypeddit", "spotify", "unknown"]),
  period_label: text('Date range as shown, e.g. "Last 28 days" or "Nov 1 – Nov 26, 2026"'),
  period_start: text("Start date as YYYY-MM-DD if determinable"),
  period_end: text("End date as YYYY-MM-DD if determinable"),
  currency: text("ISO currency code for money values, e.g. USD"),
  meta_creatives: z.array(
    z.object({
      ad_name: z.string().describe("Ad / creative name exactly as shown"),
      campaign_name: text("Campaign name"),
      spend: num("Amount spent"),
      impressions: num("Impressions"),
      reach: num("Reach"),
      clicks: num("Link clicks if shown, otherwise clicks (all)"),
      ctr_percent: num("CTR"),
      cpc: num("Cost per click"),
      cpm: num("CPM"),
      results: num("Results"),
      result_type: text("Result type, e.g. Link clicks, Landing page views"),
      cost_per_result: num("Cost per result"),
    }),
  ),
  hypeddit_links: z.array(
    z.object({
      link_name: z.string(),
      visits: num("Page visits / views"),
      clicks: num("Total clicks out to music services"),
      conversion_percent: num("Click-through / conversion rate"),
      service_clicks: z.array(z.object({ service: z.string(), clicks: num("Clicks for this service") })).describe("Per-service clicks, e.g. Spotify, Apple Music"),
      follows_or_presaves: num("Follows or pre-saves"),
    }),
  ),
  spotify_songs: z.array(
    z.object({
      title: z.string(),
      streams: num("Streams"),
      listeners: num("Listeners"),
      saves: num("Saves"),
      playlist_adds: num("Playlist adds"),
    }),
  ),
  notes: text("Anything ambiguous or partially cut off"),
});

export type ApiExtraction = z.infer<typeof ApiExtraction>;

const t = (s: string): string | null => (s.trim() ? s.trim() : null);
const iso = (s: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null);

export function normalizeExtraction(r: ApiExtraction): Extraction {
  return {
    source: r.source,
    period_label: t(r.period_label),
    period_start: iso(r.period_start),
    period_end: iso(r.period_end),
    currency: t(r.currency)?.toUpperCase() ?? null,
    notes: t(r.notes),
    meta_creatives: r.meta_creatives.map(c => ({
      ad_name: c.ad_name.trim(),
      campaign_name: t(c.campaign_name),
      spend: parseNum(c.spend),
      impressions: parseNum(c.impressions),
      reach: parseNum(c.reach),
      clicks: parseNum(c.clicks),
      ctr_percent: parseNum(c.ctr_percent),
      cpc: parseNum(c.cpc),
      cpm: parseNum(c.cpm),
      results: parseNum(c.results),
      result_type: t(c.result_type),
      cost_per_result: parseNum(c.cost_per_result),
    })),
    hypeddit_links: r.hypeddit_links.map(l => ({
      link_name: l.link_name.trim(),
      visits: parseNum(l.visits),
      clicks: parseNum(l.clicks),
      conversion_percent: parseNum(l.conversion_percent),
      service_clicks: l.service_clicks.map(s => ({ service: s.service.trim(), clicks: parseNum(s.clicks) })),
      follows_or_presaves: parseNum(l.follows_or_presaves),
    })),
    spotify_songs: r.spotify_songs.map(s => ({
      title: s.title.trim(),
      streams: parseNum(s.streams),
      listeners: parseNum(s.listeners),
      saves: parseNum(s.saves),
      playlist_adds: parseNum(s.playlist_adds),
    })),
  };
}

export const SOURCE_LABEL: Record<Source, string> = {
  meta_ads: "Meta Ads Manager",
  hypeddit: "Hypeddit",
  spotify: "Spotify for Artists",
  unknown: "Unknown",
};
