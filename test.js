// End-to-end test of the built app (docs/index.html) in headless Chromium.
// Run: npm test   (first time on a new machine: npx playwright install chromium)
const path = require('path');
const fs = require('fs');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  // Fallback for environments with a global playwright install.
  ({ chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright'));
}

const FILE = 'file://' + path.resolve(__dirname, 'docs/index.html');
const shots = path.resolve(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });

// Seed integrity: every OHS_COMPENSATIONS flexIds/strengthIds id must exist
// as an exercise id (static scan — seed.js is ESM, test.js is CJS).
const seedSrc = fs.readFileSync(path.resolve(__dirname, 'src/seed.js'), 'utf8');
const exIds = new Set([...seedSrc.matchAll(/^\s*[ES]\('([^']+)'/gm)].map((m) => m[1]));
const refIds = [...seedSrc.matchAll(/(?:flexIds|strengthIds):\s*\[([^\]]*)\]/g)]
  .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
const missingIds = refIds.filter((id) => !exIds.has(id));
if (missingIds.length) throw new Error('OHS_COMPENSATIONS references unknown exercise ids: ' + missingIds.join(', '));
if (!refIds.length) throw new Error('No flexIds/strengthIds found in seed.js — integrity check is broken');
console.log('0. Seed id integrity —', refIds.length, 'corrective references resolve.');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1180, height: 820 }, // iPad Air landscape
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(FILE);
  await page.waitForSelector('.topbar', { timeout: 5000 });
  console.log('1. App loaded. Title:', await page.title());

  // Help view renders the guide embedded from GUIDE.md
  await page.click('.topnav >> text=Help');
  await page.waitForSelector('.help h2:has-text("Backups")', { timeout: 5000 });
  await page.screenshot({ path: shots + '/0-help.png', fullPage: true });
  console.log('1b. Help view renders guide content.');

  // Load sample data from Settings
  await page.click('text=Settings');
  await page.click('text=Load sample data');
  await page.waitForSelector('text=Sample clients added', { timeout: 5000 });
  console.log('2. Sample data loaded.');

  // Trainer name (card branding) — still on Settings
  await page.fill('.card:has-text("Card branding") input', 'Coach Dana');
  console.log('2b. Trainer name set for card branding.');

  // Clients list
  await page.click('.topnav >> text=Clients');
  await page.waitForSelector('text=Maria Santos');
  await page.waitForSelector('text=James Okafor');
  await page.screenshot({ path: shots + '/1-clients.png' });
  console.log('3. Both sample clients visible.');

  // Open James (knee injury) → plan tab recommendations
  await page.click('text=James Okafor');
  await page.waitForSelector('text=Left knee meniscus repair');
  await page.screenshot({ path: shots + '/2-client-plan.png', fullPage: true });
  const planText = await page.textContent('main');
  console.log('4. Client detail. Has stat tiles:', planText.includes('Body fat'), '| Has suggestions:', planText.includes('Suggested') || planText.includes('sets'));

  // Progress tab charts
  await page.click('.tabs >> text=Progress');
  await page.waitForSelector('svg .series-line');
  await page.screenshot({ path: shots + '/3-progress.png', fullPage: true });
  const nCharts = await page.locator('svg .series-line').count();
  console.log('5. Progress charts rendered:', nCharts);

  // Log a session; flagged exercise should warn
  await page.click('.tabs >> text=Sessions');
  await page.click('text=Log session');
  await page.waitForSelector('text=Add exercise');
  await page.click('text=+ Add exercise');
  await page.waitForSelector('.picker-row');
  await page.screenshot({ path: shots + '/4-picker.png' });
  const flaggedText = await page.locator('.picker-row', { hasText: 'Barbell back squat' }).first().textContent();
  console.log('6. Picker row for Barbell back squat:', flaggedText.trim());
  await page.locator('.picker-row', { hasText: 'Barbell back squat' }).first().click();
  await page.waitForSelector('.set-row input');

  // Low-readiness toggle adjusts suggestions (needs an unflagged exercise —
  // cautions deliberately ignore readiness)
  await page.click('text=+ Add exercise');
  await page.locator('.picker-row', { hasText: 'Hip thrust (barbell)' }).first().click();
  await page.click('.modal .chip-toggle >> text=Low energy');
  await page.waitForSelector('.rec-line:has-text("Low-readiness day")');
  console.log('6b. Low-readiness toggle adjusts the suggestion.');

  await page.screenshot({ path: shots + '/5-session-editor.png', fullPage: true });
  await page.click('text=Save session');
  await page.waitForSelector('.list-row');
  console.log('7. Session saved.');

  // Plan tab renders with caution flag for the just-logged squat
  await page.click('.tabs >> text=Plan');
  await page.waitForSelector('.rec-card');
  const cautionCount = await page.locator('.rec-card.warn, .rec-line.warn').count();
  console.log('8. Plan tab rendered. Caution-flagged cards:', cautionCount);

  // Warm-up/cooldown stretch suggestions on the Plan tab
  await page.waitForSelector('.rec-card:has-text("Warm-up / Cooldown")');
  console.log('8b. Warm-up/cooldown suggestions render on Plan.');

  // InBody paste-parse fills the assessment form
  await page.click('.tabs >> text=Assessments');
  await page.click('text=+ InBody');
  await page.fill('.modal textarea >> nth=0',
    'InBody Results\nWeight 216.5 lb (118.4~143.2)\nSkeletal Muscle Mass 83.4\nBody Fat Mass 60.2\nPBF 27.8 %\nBMI 29.4\nVisceral Fat Level 12\nBMR 2070 kcal\nWeight Control -10.0');
  await page.click('text=Fill fields from pasted text');
  await page.waitForSelector('text=Filled 7 fields');
  const wVal = await page.inputValue('.modal input[type=number] >> nth=0');
  if (wVal !== '216.5') throw new Error('Weight not filled from paste: ' + wVal);
  await page.click('.modal-actions >> text=Save');
  console.log('8c. InBody paste-fill parsed 7 fields.');

  // OHS assessment → Corrective tab
  await page.click('text=+ Overhead squat');
  await page.click('.modal .chip-toggle >> text=Knees move inward');
  await page.click('.modal .chip-toggle >> text=Excessive forward lean');
  await page.screenshot({ path: shots + '/8-ohs-form.png' });
  await page.click('.modal-actions >> text=Save');
  await page.waitForSelector('.chip:has-text("Overhead squat")');
  console.log('8d. OHS assessment saved.');

  await page.click('.tabs >> text=Corrective');
  await page.waitForSelector('.rec-card:has-text("Knees move inward")');
  await page.waitForSelector('.rec-card:has-text("Lateral tube walking")');
  await page.waitForSelector('.rec-card:has-text("Excessive forward lean")');
  await page.screenshot({ path: shots + '/9-corrective.png', fullPage: true });
  console.log('8e. Corrective tab shows stretch + strengthen recs with whys.');

  await page.click('.tabs >> text=Plan');
  await page.waitForSelector('.rec-card:has-text("Corrective focus")');
  console.log('8f. Plan tab shows the corrective-focus line.');

  // Workout card: preview renders, PNG saves (file:// has no Web Share →
  // the button is deterministically "Save image")
  await page.click('text=Share card');
  await page.waitForSelector('img.card-preview[src^="data:image/png"]');
  await page.screenshot({ path: shots + '/10-card-preview.png' });
  const [cardDl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.modal-actions >> text=Save image'),
  ]);
  if (!cardDl.suggestedFilename().endsWith('.png')) throw new Error('Card download not a .png: ' + cardDl.suggestedFilename());
  console.log('8g. Homework card renders and saves as PNG:', cardDl.suggestedFilename());
  await page.click('.modal-actions >> text=Close');

  // Add a brand-new client through the form
  await page.click('text=‹ All clients');
  await page.click('text=+ New client');
  await page.fill('.modal input >> nth=0', 'Test Person');
  await page.selectOption('.modal select >> nth=2', 'hypertrophy'); // OPT phase (selects: sex 0, goal 1, phase 2)
  await page.click('.chip-toggle >> text=Shoulder');
  await page.click('text=Save client');
  await page.waitForSelector('.client-row >> text=Test Person');
  console.log('9. New client added via form.');

  // Phase shows on the client header and feeds recommendations
  await page.click('text=Test Person');
  await page.waitForSelector('text=Hypertrophy phase');
  console.log('9b. OPT phase saved and displayed.');
  await page.click('.btn-ghost.back');

  // RELOAD — the persistence test
  await page.reload();
  await page.waitForSelector('.topbar');
  await page.waitForSelector('text=Test Person', { timeout: 5000 });
  await page.waitForSelector('text=Maria Santos');
  console.log('10. PERSISTENCE OK — data survives reload.');

  // Check the logged session survived too
  await page.click('text=James Okafor');
  await page.click('.tabs >> text=Sessions');
  const sessionCount = await page.locator('.list-row').count();
  console.log('11. James sessions after reload:', sessionCount, '(expected 7: 6 sample + 1 logged)');

  // Export backup works
  await page.click('.btn-ghost.back');
  await page.click('.topnav >> text=Settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text=Export backup'),
  ]);
  const bkPath = shots + '/backup.json';
  await download.saveAs(bkPath);
  const bk = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
  console.log('12. Backup export OK — clients in backup:', bk.data.clients.length, '| sessions:', bk.data.sessions.length);

  // Trainer-name setting survived the reload too
  const tn = await page.inputValue('.card:has-text("Card branding") input');
  if (tn !== 'Coach Dana') throw new Error('Trainer name did not persist: ' + tn);
  console.log('12b. Trainer name persisted across reload.');

  // Exercise library view
  await page.click('.topnav >> text=Exercises');
  await page.waitForSelector('text=Squat');
  await page.screenshot({ path: shots + '/6-library.png', fullPage: true });
  console.log('13. Library renders.');

  // Dark mode
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.click('.topnav >> text=Clients');
  await page.click('text=James Okafor');
  await page.click('.tabs >> text=Progress');
  await page.waitForSelector('svg .series-line');
  await page.screenshot({ path: shots + '/7-dark-progress.png', fullPage: true });
  console.log('14. Dark mode renders.');

  // Deep link: docs/guide.html redirects here — #help must boot straight into
  // the Help view. Fresh page so the main page's state stays untouched.
  const page2 = await ctx.newPage();
  await page2.goto(FILE + '#help');
  await page2.waitForSelector('.help h2:has-text("Backups")', { timeout: 5000 });
  console.log('15. #help deep link boots into Help view.');
  const guideStub = fs.readFileSync(path.resolve(__dirname, 'docs/guide.html'), 'utf8');
  if (!guideStub.includes('url=./#help')) throw new Error('docs/guide.html redirect stub missing #help target');
  console.log('16. guide.html redirect stub present.');
  await page2.close();

  console.log('\nConsole errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
