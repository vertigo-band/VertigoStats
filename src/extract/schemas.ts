import { z } from "zod/v4";

const num = () => z.number().nullable();

export const MetaCreative = z.object({
  ad_name: z.string().describe("Ad / creative name exactly as shown"),
  campaign_name: z.string().nullable(),
  spend: num().describe("Amount spent, number only"),
  impressions: num(),
  reach: num(),
  clicks: num().describe("Link clicks if shown, otherwise clicks (all)"),
  ctr_percent: num().describe("CTR as a percent number, e.g. 1.85 for 1.85%"),
  cpc: num(),
  cpm: num(),
  results: num(),
  result_type: z.string().nullable().describe("e.g. Link clicks, Landing page views"),
  cost_per_result: num(),
});

export const HypedditLink = z.object({
  link_name: z.string(),
  visits: num().describe("Page visits / views"),
  clicks: num().describe("Total clicks out to music services"),
  conversion_percent: num().describe("Click-through / conversion as a percent number"),
  service_clicks: z.array(z.object({ service: z.string(), clicks: num() })).describe("Per-service clicks, e.g. Spotify, Apple Music"),
  follows_or_presaves: num(),
});

export const SpotifySong = z.object({
  title: z.string(),
  streams: num(),
  listeners: num(),
  saves: num(),
  playlist_adds: num(),
});

export const Extraction = z.object({
  source: z.enum(["meta_ads", "hypeddit", "spotify", "unknown"]),
  period_label: z.string().nullable().describe('Date range as shown, e.g. "Last 28 days" or "Nov 1 – Nov 26, 2026"'),
  period_start: z.string().nullable().describe("YYYY-MM-DD if determinable"),
  period_end: z.string().nullable().describe("YYYY-MM-DD if determinable"),
  currency: z.string().nullable().describe("ISO currency code for money values, e.g. USD"),
  meta_creatives: z.array(MetaCreative),
  hypeddit_links: z.array(HypedditLink),
  spotify_songs: z.array(SpotifySong),
  notes: z.string().nullable().describe("Anything ambiguous or partially cut off"),
});

export type Extraction = z.infer<typeof Extraction>;
export type Source = Extraction["source"];

export const SOURCE_LABEL: Record<Source, string> = {
  meta_ads: "Meta Ads Manager",
  hypeddit: "Hypeddit",
  spotify: "Spotify for Artists",
  unknown: "Unknown",
};
