// End-to-end check at phone size: import mock screenshots → review → save → song cards + trends.
// The Anthropic API is stubbed (no key or cost needed). Run: npm run build && npm run e2e
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)("playwright"); // preinstalled globally
import { spawn } from "node:child_process";
import fs from "node:fs";

const OUT = process.env.OUT ?? "scripts/e2e-out";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync("scripts/mocks", { recursive: true });

const base = { period_start: null, period_end: null, currency: null, meta_creatives: [], hypeddit_links: [], spotify_songs: [], notes: null };
const RESPONSES = [
  { ...base, source: "spotify", period_label: "Last 28 days", spotify_songs: [
    { title: "Midnight Drive", streams: 4210, listeners: 1820, saves: 312, playlist_adds: 96 },
    { title: "Neon Rain", streams: 1890, listeners: 1015, saves: 120, playlist_adds: 31 },
    { title: "Glass Hearts", streams: 760, listeners: 455, saves: 48, playlist_adds: 9 } ] },
  { ...base, source: "spotify", period_label: "Last 28 days", spotify_songs: [
    { title: "Midnight Drive", streams: 6120, listeners: 2410, saves: 501, playlist_adds: 140 },
    { title: "Neon Rain", streams: 2050, listeners: 1102, saves: 131, playlist_adds: 30 },
    { title: "Glass Hearts", streams: 1210, listeners: 640, saves: 77, playlist_adds: 15 } ] },
  { ...base, source: "meta_ads", period_label: "Nov 1 – Nov 26, 2026", period_start: "2026-11-01", period_end: "2026-11-26", currency: "USD", meta_creatives: [
    { ad_name: "Reel – studio clip", campaign_name: "Midnight Drive", spend: 84.2, impressions: 21450, reach: 15200, clicks: 512, ctr_percent: 2.39, cpc: 0.16, cpm: 3.93, results: 512, result_type: "Link clicks", cost_per_result: 0.16 },
    { ad_name: "Static – cover art", campaign_name: "Midnight Drive", spend: 41.1, impressions: 15800, reach: 11900, clicks: 158, ctr_percent: null, cpc: null, cpm: null, results: 158, result_type: "Link clicks", cost_per_result: null } ] },
  { ...base, source: "hypeddit", period_label: "Last 30 days", hypeddit_links: [
    { link_name: "Midnight Drive – smart link", visits: 640, clicks: 402, conversion_percent: 62.8, service_clicks: [{ service: "Spotify", clicks: 331 }, { service: "Apple Music", clicks: 52 }, { service: "YouTube", clicks: 19 }], follows_or_presaves: 37 } ] },
];

// Simple mock dashboard images so the import flow has real files to process.
const MOCKS = [
  ["Screenshot_20261120-101500_Spotify.png", "Spotify for Artists", "Last 28 days", RESPONSES[0].spotify_songs.map(s => [s.title, s.streams, s.listeners])],
  ["Screenshot_20261127-093000_Spotify.png", "Spotify for Artists", "Last 28 days", RESPONSES[1].spotify_songs.map(s => [s.title, s.streams, s.listeners])],
  ["Screenshot_20261126-201000_Ads.png", "Ads Manager", "Nov 1 – Nov 26", RESPONSES[2].meta_creatives.map(c => [c.ad_name, "$" + c.spend, c.clicks])],
  ["Screenshot_20261126-202000_Hypeddit.png", "Hypeddit", "Last 30 days", [["Visits", 640, ""], ["Clicks", 402, ""], ["Spotify", 331, ""]]],
];

const server = spawn("node_modules/.bin/vite", ["preview", "--port", "4179", "--strictPort"], { stdio: "pipe" });
await new Promise((resolve, reject) => {
  let log = "";
  const onData = d => { log += d; if (log.includes("localhost:4179")) resolve(); };
  server.stdout.on("data", onData);
  server.stderr.on("data", onData);
  server.on("exit", code => reject(new Error(`vite preview exited (${code}):\n${log}`)));
});

const browser = await chromium.launch();
try {
  const mk = await browser.newPage({ viewport: { width: 412, height: 915 } });
  for (const [file, title, period, rows] of MOCKS) {
    await mk.setContent(`<body style="margin:0;background:#121212;color:#fff;font:16px Roboto,sans-serif;padding:24px">
      <h2>${title}</h2><p style="color:#aaa">${period}</p>
      <table style="width:100%;font-size:15px">${rows.map(r => `<tr>${r.map(c => `<td style="padding:10px 0">${c}</td>`).join("")}</tr>`).join("")}</table></body>`);
    await mk.screenshot({ path: `scripts/mocks/${file}` });
  }

  const ctx = await browser.newContext({ ...devices["Pixel 7"], deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const step = s => console.log("•", s);
  page.on("pageerror", e => console.error("PAGE ERROR", e));
  let n = 0;
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
  await page.route("https://api.anthropic.com/**", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = route.request().postDataJSON();
    if (body.model !== "claude-opus-5-5" || body.messages[0].content[0].type !== "image") throw new Error("unexpected request shape");
    const text = JSON.stringify(RESPONSES[n++]);
    await route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({
      id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1500, output_tokens: 300 } }) });
  });

  step("open app"); await page.goto("http://localhost:4179/");
  await page.getByLabel("Anthropic API key").fill("sk-ant-test");
  await page.screenshot({ path: `${OUT}/1-settings.png` });

  step("import screenshots"); await page.getByRole("button", { name: "Add" }).click();
  await page.getByTestId("file-input").setInputFiles(MOCKS.map(m => `scripts/mocks/${m[0]}`));
  await page.getByRole("button", { name: /^Save \d/ }).first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll("button").length && [...document.querySelectorAll("button")].filter(b => /^Save \d/.test(b.textContent)).length === 4);
  await page.screenshot({ path: `${OUT}/2-review.png` });
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^Save \d/ }).first().click();
  await page.getByText(/✓ Saved/).nth(3).waitFor();

  step("song cards"); await page.getByRole("button", { name: "Songs" }).click();
  await page.getByRole("article", { name: "Midnight Drive" }).waitFor();
  const card = await page.getByRole("article", { name: "Midnight Drive" }).innerText();
  if (!card.includes("6,120") || !card.includes("2.54") || !card.includes("▲")) throw new Error("song card wrong:\n" + card);
  await page.screenshot({ path: `${OUT}/3-songs.png`, fullPage: true });

  step("trends"); await page.getByRole("button", { name: "Trends" }).click();
  await page.locator(".recharts-line").first().waitFor();
  await page.screenshot({ path: `${OUT}/4-trends-songs.png`, fullPage: true });
  await page.getByRole("tab", { name: "Ad creatives" }).click();
  await page.getByRole("cell", { name: "$0.26" }).waitFor(); // derived cost/result for the static ad (41.1 / 158)
  await page.screenshot({ path: `${OUT}/5-trends-ads.png`, fullPage: true });
  await page.getByRole("tab", { name: "Hypeddit" }).click();
  await page.getByRole("cell", { name: "640" }).waitFor();

  if (n !== 4) throw new Error(`expected 4 API calls, got ${n}`);
  console.log("E2E OK — screenshots in", OUT);
} catch (e) {
  console.error("E2E FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  setTimeout(() => process.exit(), 200);
}
