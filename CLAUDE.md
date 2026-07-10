# CLAUDE.md — TrainerPad

Local-first client-management PWA for a personal trainer's iPad. React,
compiled by esbuild into ONE self-contained HTML file. No backend, no
accounts; all data in IndexedDB on the device. Read README.md for layout.

## Commands

```bash
npm install
npm run build     # esbuild bundle → inlined into template.html → docs/index.html
npm test          # build + Playwright e2e (test.js); screenshots → shots/ (gitignored)
npx playwright install chromium   # once per machine, before first npm test
```

No dev server, no lint, no unit-test runner — the build is fast; rebuild and
reload `docs/index.html` in a browser. `test.js` is one sequential e2e script
(steps depend on earlier state), so there is no "run a single test".

## Invariants — do not break these

1. **Single-file build.** Everything (JS, CSS, icon) is inlined into
   `docs/index.html` by `build.js`. Never add CDN links, external scripts,
   fonts, or a second runtime file — it would break offline use and hand-off.
2. **`docs/index.html` is a committed build artifact.** After ANY change to
   `src/` or `template.html`: `npm run build`, then commit source + artifact
   together. GitHub Pages serves `/docs` from `main` — push = deploy.
   CI (`.github/workflows/ci.yml`) fails the build if the committed
   artifact doesn't match a fresh rebuild, and runs the e2e. It does
   not deploy — Pages serves the committed file directly.
3. **Real users have data in IndexedDB v1.** If you change store names,
   keyPaths, or record shapes: bump DB_VERSION in `src/db.js`, write a
   migration in `onupgradeneeded`, and keep `exportAll`/`importAll`
   backward-compatible (old JSON backups must still restore).
4. **No `alert`/`confirm`/`prompt` and no localStorage.** Destructive actions
   use the tap-twice `ConfirmBtn` pattern in `app.jsx`.
5. **Safari on iPad is the target** (build target `safari15`). Touch targets
   ≥ 44px; verify light AND dark mode (CSS vars in `template.html`).

## Architecture

- `src/app.jsx` — the build entry point and ALL UI (views, modals, forms,
  `ConfirmBtn`) in one file. All CSS lives in `template.html`, not in JSX.
- `src/logic.js` — recommendation rule engine. Pure functions, computed at
  render time, never persisted. Every recommendation returns a plain-English
  `why`; keep that property when extending rules.
- `src/seed.js` — exercise library / injury tags / goals. Trainer-editable
  behavior belongs here as data; numeric thresholds live in logic.js.
- `src/chart.jsx` — chart spec: 2px line, 10% area wash, hairline solid
  gridlines, crosshair tooltip, endpoint label, table-view twin. Single
  series per chart, one y-axis, no legends. Keep it that way.
- `src/db.js` — promise wrapper over IndexedDB (stores: clients, sessions,
  assessments, exercises, settings) + JSON backup export/import.
- `src/sample.js` — demo data loaded on demand from Settings; `test.js`
  depends on its two clients (Maria Santos, James Okafor) and their history.

## Verify before calling work done

- `npm test` — builds, then runs the Playwright e2e (`test.js`): sample data,
  recommendations, session logging, charts, backup export, and the critical
  persistence-across-reload check. One-time on a new machine:
  `npx playwright install chromium`.
- Extend `test.js` when adding features; keep the reload-persistence test last.