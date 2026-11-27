# Music Promo Tracker

An installable web app (PWA) for Android that turns screenshots from **Meta Ads Manager**, **Hypeddit** and **Spotify for Artists** into tracked stats:

- **Songs:** streams, listeners, streams per listener, saves, save rate and playlist adds. One card per song, with the ▲/▼ change since the last snapshot.
- **Ad creatives:** spend, impressions, reach, clicks, CTR, CPC, CPM, results and cost per result.
- **Hypeddit smart links:** visits, clicks, conversion %, clicks by service and follows/pre-saves.
- **Trends:** line charts over time for any of the metrics above.

Claude reads each screenshot. You check the numbers and fix anything wrong before they're saved. Data lives on your phone and syncs to a Google Sheet.

## Using it

1. Take screenshots of the dashboards as usual.
2. In the screenshot preview, tap **Share → Promo Tracker**. You can also open the app → **Add** and pick several at once.
3. Check the numbers, adjust the **snapshot date** if needed (it's read from the Pixel screenshot filename), and tap **Save**.
4. Take a fresh screenshot every week or so. Each snapshot date becomes a point on the trend lines. Re-importing the same screenshot on the same day updates the existing numbers instead of adding duplicates.

> Spotify for Artists shows rolling windows such as "Last 28 days". Compare like with like: use the same period setting each time you screenshot.

## One-time setup

### 1. Anthropic API key (reads the screenshots)
1. Create a key at console.anthropic.com → API keys.
2. Paste it in the app under **Settings**.

The key is stored only on your phone. It costs roughly a cent or two per screenshot.

### 2. Google Sheets sync (optional but recommended)
1. Go to console.cloud.google.com and create a project.
2. **APIs & Services → Library**: enable the **Google Sheets API**.
3. **OAuth consent screen**:
   - User type *External*.
   - Add yourself as a **test user**.
   - Scope: `.../auth/drive.file`.
4. **Credentials → Create credentials → OAuth client ID**:
   - Type *Web application*.
   - **Authorized JavaScript origins**: the URL where the app is hosted, e.g. `https://<you>.github.io`.
5. Copy the client ID into **Settings → OAuth client ID** and tap **Connect Google account**.

The app creates a spreadsheet called *Music Promo Tracker* with the tabs **Songs**, **Ads**, **Hypeddit** and **Screenshots**. Each sync rewrites those tabs from the data on your phone, so the sheet always matches the app. The `drive.file` permission means the app can only see the file it created.

### 3. Host it (HTTPS is required to install it and for Google sign-in)
- **GitHub Pages:**
  1. Push this folder to a GitHub repo.
  2. **Settings → Pages → Source: GitHub Actions**.
  3. Optionally add a repo variable `GOOGLE_CLIENT_ID`.

  The included workflow tests, builds and deploys on each push to `main`.
- **Netlify:** connect the repo; `netlify.toml` is already set up.

### 4. Install on the Pixel
1. Open the hosted URL in Chrome.
2. Tap **⋮ → Install app** (or *Add to Home screen*).

After that, Promo Tracker appears in the Android share sheet.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (number parsing, derived metrics, de-duplication)
npm run build      # type-check + production build
npm run e2e        # phone-size UI test with a stubbed Claude API (run after build)
```

How it's built:
- Vite + React + TypeScript, with Tailwind and Recharts.
- Dexie (IndexedDB) for on-device storage.
- `vite-plugin-pwa` with a custom service worker (`src/sw.ts`) that handles the share target.
- Extraction is in `src/extract/claude.ts`:
  - `claude-opus-5-5` with structured outputs, using the Zod schema in `src/extract/schemas.ts`.
  - Low effort, with server-side refusal fallback turned on.
