# CineTracker — full source code

ഇതിൽ ഏറ്റവും പുതിയ UI redesign, dark mode, social media links, movie collection backend, database schema, PWA files, icons, tests എന്നിവ ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.

ZIP extract ചെയ്ത ശേഷം `CineTracker` folder-ൽ terminal തുറക്കുക. താഴെയുള്ള steps ഉപയോഗിച്ച് run ചെയ്യാം.

## Included version

This export contains the application code from the published 20 October 2026 update, commit `f4b5b296ab37fd15147ba6679803624bd84fc7fb`.

- No pause button beside Box Office Leaders.
- Redesigned light and dark interfaces with responsive movie cards.
- Isolated countdown, memoized movie rows, deferred search and shared number/date formatters.
- Instagram, Facebook and Telegram links in Settings.
- “Made by Devanarayanan” at the bottom of Settings.
- Frontend, Worker backend, parsers, collector, database migration, seed snapshot, PWA assets, lockfile, scripts and tests.

All application files match that Git commit. README corrections and this setup guide were added for the export. Installed packages, generated builds, runtime databases and credentials are not part of the source archive.

## Requirements

Use Node.js 24 and the pinned pnpm version, 11.25.0. The source specifies Node.js >=22.13.0; Node.js 24 was used for the published build. Install dependencies from the included lockfile. The terminal commands below are run inside this extracted folder.

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
```

The portable execution profile is selected automatically in a clean extraction. You do not need the original development container. On Windows, use a terminal with Node.js and pnpm available; the optional Linux install scripts are intended for Linux and WSL.

## Build and run locally

Build the application first:

```sh
pnpm build
```

Initialize the local D1 database before the first start. The generated Wrangler configuration is used by the included start script. The migration below creates the `app_state` and `leases` tables:

```sh
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_complete_sersi.sql
```

Run that initial SQL only for a new local database. An “already exists” error means the initial schema was previously applied; do not delete a database that contains data you need.

Start the built application:

```sh
pnpm start
```

Open the local URL printed in the terminal. This local process uses your local D1 state. It does not copy the live Site's database or change the published app.

For development with hot reload:

```sh
pnpm dev
```

The portable development script requests port 5173. The production start command is the explicit local Wrangler configuration and persistence path shown above. If a different local development persistence directory is configured, initialize the same migration in that directory too.

If the UI says the collection service is unavailable, check that the local `DB` binding exists and the migration ran against the same persistence directory as the server. Internet access is needed to refresh reports. The included seed snapshot is historical and is clearly labelled by the app until a successful update.

## Tests and type checking

```sh
node --experimental-strip-types --test tests/parser.test.mjs tests/collector.test.mjs tests/mobile.test.mjs tests/leaders.test.mjs
pnpm exec tsc --noEmit
```

For this application revision, the production build, TypeScript check and all 23 existing tests passed before publication. Render checks also confirmed the missing pause button and the three exact social links. Browser/device visual testing was not available in that session. This export is a checked source snapshot; dependency installation on your computer is a separate step.

## Where to edit

| Area | Files |
| --- | --- |
| Main screen, filtering, watchlist and movie detail | `app/page.tsx` |
| Latest UI redesign | `app/redesign.css` |
| Base and mobile styles | `app/globals.css`, `app/mobile.css` |
| Appearance and installation settings | `app/app-experience.tsx` |
| Your social page links | `app/social-links.tsx` |
| Leaders marquee | `app/leaders-marquee.tsx` |
| Countdown display | `app/refresh-countdown.tsx` |
| Film industry ranking | `lib/leaders.ts` |
| Report parsing and normalization | `lib/boxoffice.ts` |
| Report API and refresh collector | `lib/collector.ts`, `build/sites-worker.ts` |
| Database schema and initial migration | `db/schema.ts`, `drizzle/0000_complete_sersi.sql` |
| App icons, manifest and offline fallback | `public/icons/`, `public/manifest.webmanifest`, `public/sw.js` |
| Optional external scheduler runner | `scripts/refresh-remote.mjs` |

## Data and update behavior

The app checks for new collection reports every 20 minutes while it is open, discovers new available daily reports and recent releases during refresh, and resumes checks when you return. It does not guarantee that every film currently showing in every theatre is covered. Figures are published reports or estimates, and publisher updates may arrive less often than the app checks.

An unattended 20-minute background scheduler is not connected. The optional remote-refresh script needs an external scheduler and supported, renewable service access supplied outside source code. No live credentials are included.

The top marquee compares worldwide gross for tracked South Indian and North Indian film industries. It does not measure box-office revenue earned geographically inside South India or North India. Source and publisher details are hidden in the public-facing UI but retained internally for traceability.

## Mobile app

This project is an installable PWA. It contains the complete mobile web app source, not a Kotlin/Flutter project or an APK. Open the hosted app on your phone and use Install app / Add to Home Screen. Dark mode and watchlists are saved on that browser/device.

## Hosting

The existing Site remains at:
https://cinepulse-collections.earlylily16.chatgpt.site

Its hosted access is owner-private at the Sites layer. The included hosting identity belongs to that existing project and is not a credential. Use the Sites workflow when updating that same Site. An independent deployment needs your own hosting configuration, a D1 database bound as `DB`, the included schema and equivalent access protection. The refresh endpoint relies on the private hosting boundary; do not expose a copied deployment publicly without adding appropriate authorization and rate limiting.

The source pages can change their markup or restrict access. Maintain the parser when that happens; missing or failed data must remain visibly unavailable rather than being invented.

Vendored dependencies and assets retain their supplied licence notices. See `README.md` for further architecture and data behavior notes.
