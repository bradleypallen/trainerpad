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

  // Load sample data from Settings
  await page.click('text=Settings');
  await page.click('text=Load sample data');
  await page.waitForSelector('text=Sample clients added', { timeout: 5000 });
  console.log('2. Sample data loaded.');

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
  await page.screenshot({ path: shots + '/5-session-editor.png', fullPage: true });
  await page.click('text=Save session');
  await page.waitForSelector('.list-row');
  console.log('7. Session saved.');

  // Plan tab renders with caution flag for the just-logged squat
  await page.click('.tabs >> text=Plan');
  await page.waitForSelector('.rec-card');
  const cautionCount = await page.locator('.rec-card.warn, .rec-line.warn').count();
  console.log('8. Plan tab rendered. Caution-flagged cards:', cautionCount);

  // Add a brand-new client through the form
  await page.click('text=‹ All clients');
  await page.click('text=+ New client');
  await page.fill('.modal input >> nth=0', 'Test Person');
  await page.click('.chip-toggle >> text=Shoulder');
  await page.click('text=Save client');
  await page.waitForSelector('.client-row >> text=Test Person');
  console.log('9. New client added via form.');

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

  console.log('\nConsole errors:', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
