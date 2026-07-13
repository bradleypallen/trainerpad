# TrainerPad

A local-first client-management app for personal trainers, designed for iPad. The whole app compiles to **one self-contained HTML file** — no backend, no accounts, no build served at runtime. All client data lives in IndexedDB on the device; a JSON export/import provides backup and restore.

**Features:** client profiles with injury flags · session logging with per-set weight/reps/RPE · rule-based next-session recommendations (double progression, RPE-triggered deloads, progression/regression chains, injury-aware exercise swaps) · InBody and fitness-assessment tracking with photo attachments · progress charts (body composition + estimated-1RM trends) · exercise library organized into progression chains by movement pattern · rule-based nutrition targets (calories + macros from InBody data, with plain-English reasoning) · lb/kg · light + dark mode.

## Repo layout

```
src/
  app.jsx       UI — all views and components (React)
  card.js       Shareable PNG workout/session cards (canvas render, Web Share + save fallback)
  chart.jsx     Single-series SVG line chart (crosshair tooltip, dark-mode aware)
  db.js         IndexedDB wrapper + JSON export/import + storage persistence
  logic.js      The recommendation rule engine (pure functions)
  seed.js       Exercise library, injury tags, movement patterns, goals, InBody fields
  sample.js     Optional demo data (two clients with history)
  md.js         Tiny GUIDE.md → HTML converter for the in-app Help view
template.html   HTML shell + all CSS; the JS bundle is inlined into it at build time
build.js        esbuild bundle → inline into template → docs/index.html (+ guide.html stub)
test.js         Playwright end-to-end test (persistence, recommendations, charts, backup)
docs/index.html The built app (committed, so GitHub Pages serves it directly)
docs/guide.html Build-emitted redirect stub → the app's #help view
GUIDE.md        End-user guide — embedded into the app at build time (Help tab)
```

## Development

```bash
npm install
npm run build        # → docs/index.html
npm test             # build + headless end-to-end test
# first time on a new machine, tests need a browser:
npx playwright install chromium
```

There is no dev server — the build is fast enough to just rebuild and reload `docs/index.html` in a browser.

**Important:** `docs/index.html` is a build artifact that is deliberately committed (it's what gets deployed). After changing anything in `src/` or `template.html`, run `npm run build` and commit the updated `docs/index.html` along with the source change.

## Deploying (GitHub Pages)

1. Push to GitHub.
2. Repo → Settings → Pages → "Deploy from a branch" → branch `main`, folder `/docs`.
3. The app is live at `https://<username>.github.io/<repo>/`.

On the iPad: open that URL in Safari → Share → **Add to Home Screen**. It launches full-screen like a native app, and iPadOS protects its storage. User-facing instructions are in `GUIDE.md`, which is also embedded in the app itself (Help tab) and reachable at the stable URL `https://<username>.github.io/<repo>/guide.html` (a stub that redirects into the app's Help view).

Note: the deployed page is public, but it contains no data — client data never leaves the device it's entered on.

## Architecture notes

- **Single-file constraint:** everything (React, CSS, icons) is inlined by `build.js`. Keep it that way — it's what makes deployment and hand-off trivial. External `<script src>`/CDN references would break offline use.
- **Recommendations** are computed on the fly at render time by `logic.js` — nothing is stored. Parameters that trainers can change live as data (exercise metadata, injury tags, goal rep ranges in `seed.js`); numeric thresholds (RPE 9.5 deload, +5%/+2.5% increments, two-sessions-at-ceiling progression) are constants in `logic.js`.
- **Charts** follow a fixed spec (see `chart.jsx`): 2px line, 10% area wash, hairline solid gridlines, crosshair tooltip, endpoint direct label, table-view twin for accessibility.
- **No `alert`/`confirm`** — destructive actions use a tap-twice-to-confirm button (`ConfirmBtn`).
- **Safari target:** the build targets `safari15`; test on iPad after significant changes.

## License & copyright

© 2026 Bradley Allen. All rights reserved. Application specification and
training methodology by **Latricia Haymon**.

This repository is public for evaluation and collaboration, but it is **not
yet open source**: no license is granted to use, copy, modify, or distribute
the software. Licensing is under consideration — see [LICENSE](LICENSE).
Outside contributions are not being accepted while licensing is unresolved.

## Roadmap ideas

- Service worker for guaranteed offline cold-launch (needs a second file; Pages serves it fine)
- User-tunable rule thresholds in Settings (store alongside `units` in the settings store)
- Assessment-driven prescriptions (e.g. starting weights from fitness-test results)
- Per-client program templates; multi-week periodization
- Sync/multi-device (requires a backend — significant architecture change)
