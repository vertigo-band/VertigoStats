import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ApiExtraction, normalizeExtraction, type Extraction } from "./schemas";

const SYSTEM = `You read analytics screenshots for a music artist and return the numbers as structured data.
The screenshot is from one of: Meta Ads Manager (ad creatives table or ad detail), Hypeddit (smart link / fan gate stats), or Spotify for Artists (song list or a single song's stats). Set "source" accordingly, or "unknown" if it is none of these.
Rules:
- Only report values that are visible. Use "" for anything not shown; never guess or calculate missing values.
- Copy numbers exactly as displayed (e.g. "1.2K", "$12.50", "1.85%", "3,456"); the app converts them.
- Fill only the array for the detected source; leave the other two arrays empty.
- One array entry per ad / link / song row visible. Skip totals/summary rows unless they are the only row.
- Copy names (ad names, song titles, link names) exactly as shown.
- Report the date range shown on screen in period_label, and as YYYY-MM-DD in period_start/period_end if they can be determined (assume the current year is ${new Date().getFullYear()} if no year is shown; today is ${new Date().toISOString().slice(0, 10)}).`;

export class ExtractionError extends Error {}

export async function extractFromScreenshot(apiKey: string, imageBase64: string, mediaType: "image/jpeg" | "image/png"): Promise<Extraction> {
  if (!apiKey) throw new ExtractionError("Add your Anthropic API key in Settings first.");
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

  let res;
  try {
    res = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ApiExtraction) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: "Extract the stats from this screenshot." },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ExtractionError("Your Anthropic API key was rejected. Check it in Settings.");
    if (e instanceof Anthropic.RateLimitError) throw new ExtractionError("Rate limited by the API. Wait a minute and try again.");
    if (e instanceof Anthropic.APIConnectionError) throw new ExtractionError("Couldn't reach the Anthropic API. Are you online?");
    if (e instanceof Anthropic.APIError) {
      const msg = (e.error as any)?.error?.message ?? e.message;
      throw new ExtractionError(`API error ${e.status ?? ""}: ${String(msg).slice(0, 240)}`);
    }
    throw e;
  }

  if (res.stop_reason === "refusal") throw new ExtractionError("The model declined to read this image.");
  if (res.stop_reason === "max_tokens") throw new ExtractionError("The screenshot had more data than expected; try cropping it.");
  if (!res.parsed_output) throw new ExtractionError("Couldn't read structured data from the response.");
  return normalizeExtraction(res.parsed_output);
}
