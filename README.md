# CineTracker

See `START_HERE.md` for installation and local database setup.

A private, responsive box-office web app built with React, Vinext, Cloudflare Workers and D1.

## Product behavior

- Discovers active daily reports and recent Indian releases from public Sacnilk pages.
- Separates India net, India gross, overseas gross and worldwide gross. Unknown amounts stay null.
- Stores collection snapshots with original source URLs, publisher timestamps and fetch timestamps.
- Refreshes every 20 minutes while open; resumes unfinished source checks after reopening.
- Search, language filters, India/worldwide sorting, per-film daily charts, browser-local watchlists and CSV export.
- Installable mobile web app with app icons, standalone display, safe-area spacing, bottom navigation and phone-sized collection cards.
- Light, Dark and System appearance, persisted locally and applied before first paint. A quick theme toggle is in the header; all options are in Settings.
- The main-page marquee ranks worldwide gross among tracked South Indian (Tamil/Telugu/Malayalam/Kannada) and North Indian (Hindi/Punjabi) film industries. It uses explicit industry metadata, not dubbed-language order, excludes unknown/conflicting/failed reports, and preserves ties. These are not geographic North/South theatre revenues. It refreshes with report data, has no visible pause button, pauses on hover or keyboard focus, and respects reduced-motion preferences.
- The refreshed interface uses clearer mobile cards, larger controls, loading placeholders and a separate countdown component to avoid redrawing the dashboard every second. Search updates are deferred and movie rows are memoized.
- Settings includes Instagram, Facebook and Telegram links supplied by Devanarayanan.
- Source navigation and publisher panels are hidden from the interface and CSV export. Settings ends with “Made by Devanarayanan”. Existing watchlists and appearance preferences survive the rename.
- Daily reports are provisional. This app does not claim audited real-time sales or exhaustive theatre coverage.
- Conflicting totals are withheld. Network/parser failures preserve the previous successful report and its timestamps.

## Architecture

`lib/boxoffice.ts` contains pure parsers and validation. `lib/collector.ts` runs a resumable collection job. The Worker handles `GET /api/report` and `POST /api/refresh` before the Vinext renderer. Each POST does one bounded source request, honoring robots directives and crawl delays. A D1 lease prevents concurrent source checks. Discovery refreshes with every run; films are not hard-coded into the collector. `lib/seed.json` is an attributed initial snapshot captured during setup, never labelled as a live fetch.

Access is owner-private at the Sites dispatch layer. The shared updater relies on that boundary. Do not change the Site to public without adding application-level authorization for refresh endpoints and reviewing privacy requirements. Same-origin checks protect browser writes. Source fetching accepts only the fixed publisher origin and known public paths; it does not accept user-supplied fetch targets or execute publisher JavaScript.

## Unattended scheduling

**Not connected.** This host's available cloud automations cannot run every 20 minutes. The app does not pretend that an open-page timer is a background schedule.

`scripts/refresh-remote.mjs` implements the complete resumable update and readback. To run while closed, an external cron service must execute it every 20 minutes (`*/20 * * * *`) with the private Site origin in `SITE_URL` and supported current service access in `SITE_SERVICE_TOKEN`. Tokens must be securely acquired and renewed outside source code. No token or external scheduler is included or provisioned.

## Mobile installation

Open the published URL on the device and sign in. Android Chrome offers **Install app** or **Add to Home screen** in its menu; when an install prompt is available, Settings also exposes an Install CineTracker button. On iPhone/iPad, use Safari's **Share → Add to Home Screen**, keep **Open as Web App** enabled if shown, then tap **Add**. Browser and OS capabilities vary; some offer a shortcut. This is a PWA, not an App Store package or Android APK.

The manifest is requested with credentials so the existing private audience is preserved. Installation does not change access or add a background scheduler. Installed windows may require signing in again. Appearance and watchlist preferences are stored per browser/device.

The service worker only handles a failed network navigation to the app root. It serves a generic reconnect screen; it never caches account pages, API replies, collection reports or authentication responses, and never substitutes offline content for an HTTP authentication error or redirect. The open app keeps the last in-memory report visible when offline, with an explicit offline notice, and checks the source again when the connection returns. A new offline launch does not display reports.

## Validation

Run `node --experimental-strip-types --test tests/parser.test.mjs tests/collector.test.mjs tests/mobile.test.mjs tests/leaders.test.mjs` and `node node_modules/typescript/bin/tsc --noEmit`. Tests cover the collector, leader classifications/rankings, saved/system appearance, blocked storage, service-worker authentication boundaries, offline fallback and icon dimensions. Generate schema changes with the starter's `db:generate` command, preserve existing migrations, and build/deploy with the Sites helpers.

Device installation and visual checks need an actual supported browser. They have not been performed in the managed Linux environment used for this update.

The live source layout is not a versioned API. Source changes can require adapter maintenance; the UI reports parse failures instead of substituting fabricated data. Additional licensed publishers can be added as separate adapters with independent metric definitions and reporting cutoffs.
