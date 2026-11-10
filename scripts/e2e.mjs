// End-to-end smoke test of the main user flows at iPhone 15 Pro size.
// Usage: node scripts/e2e.mjs [baseUrl] [screenshotDir]
// Uses the locally installed Microsoft Edge or Chrome via playwright-core (no browser download).
import { chromium, webkit } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// Always use a trailing-slash root: under a sub-path (/GymApp/) the slash-less URL is
// outside the service worker's scope.
const BASE = (args[0] ?? 'http://localhost:5173').replace(/\/+$/, '');
const ROOT = `${BASE}/`;
const SHOTS = args[1] ?? 'e2e-shots';
mkdirSync(SHOTS, { recursive: true });

const errors = [];
let step = 0;
const results = [];

// E2E_BROWSER=webkit runs against Playwright's WebKit (Safari's engine);
// install it once with `npx playwright-core install webkit`.
const IS_WEBKIT = process.env.E2E_BROWSER === 'webkit' || process.argv.includes('--webkit');

async function launch() {
  if (IS_WEBKIT) return webkit.launch();
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* try next */
    }
  }
  throw new Error('No Edge/Chrome found');
}

const browser = await launch();
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: join(SHOTS, `${String(++step).padStart(2, '0')}-${name}.png`) });
async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, e.message.split('\n')[0]]);
    await shot(`FAIL-${name.replace(/\W+/g, '_')}`);
  }
}
// Tabs remember their last screen (iOS behaviour); a second tap pops to the tab root.
const tab = async (label) => {
  const btn = page.locator('.tabbar').getByRole('button', { name: label });
  await btn.click();
  await page.waitForTimeout(120);
  await btn.click();
  await page.waitForTimeout(120);
};
const confirmAlert = (label) => page.locator('.alert-actions').getByRole('button', { name: label }).click();
const wait = (ms) => page.waitForTimeout(ms);

// Warm-up load (the dev server may optimise deps and reload once), then start clean.
await page.goto(ROOT);
await wait(2500);
await page.goto(ROOT);
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/?fresh=1`);

await check('nutrition onboarding calculates personal targets', async () => {
  await page.getByText(/your main goal/).waitFor();
  await shot('onboarding-goal');
  await page.getByRole('radio', { name: /Lose Weight/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Male', exact: true }).click();
  await page.getByLabel('Age (years)').fill('30');
  await shot('onboarding-about');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Height (cm)').fill('180');
  await page.getByLabel('Current weight (kg)').fill('80');
  await shot('onboarding-body');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Moderately active/ }).click();
  await shot('onboarding-activity');
  await page.getByRole('button', { name: 'Continue' }).click();
  // Mifflin-St Jeor: 1780 kcal x 1.55 activity x 0.8 (lose) = 2,210 kcal; protein 2 g/kg = 160 g.
  await page.locator('.targets-kcal').getByText('2,210').waitFor();
  await page.locator('.targets-macros').getByText('160').waitFor();
  await shot('onboarding-result');
  await page.getByRole('button', { name: 'Start Tracking' }).click();
  await page.locator('.kcal-big').getByText('2,210').waitFor();
  await shot('nutrition-empty');
});

await check('log food and see consumed and remaining', async () => {
  await page.getByRole('button', { name: 'Add Food' }).first().click();
  await page.getByPlaceholder('e.g. Chicken and rice').fill('Chicken and rice');
  await page.getByLabel('Protein (g)').fill('40');
  await page.getByLabel('Carbs (g)').fill('60');
  await page.getByLabel('Fat (g)').fill('10');
  await shot('food-sheet');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Food added').waitFor();
  // 40x4 + 60x4 + 10x9 = 490 kcal eaten, 1,720 left.
  await page.locator('.kcal-big').getByText('1,720').waitFor();
  await page.getByText('120 g left').waitFor();
  await shot('nutrition-logged');
});

await check('changing the goal recalculates targets', async () => {
  await page.getByRole('button', { name: /Edit Plan/ }).click();
  await page.locator('.sheet').getByRole('radio', { name: /Build Muscle/ }).click();
  await wait(200);
  await shot('plan-sheet');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Targets updated').waitFor();
  // 2,759 x 1.1 = 3,030 target, minus 490 eaten.
  await page.locator('.kcal-big').getByText('2,540').waitFor();
  await page.getByRole('button', { name: /Back to Home/ }).click();
  await page.locator('.nut-home').getByText('2,540').waitFor();
});

await check('empty home renders welcome', async () => {
  await page.getByText('Welcome to Forge').waitFor();
  await shot('home-empty');
});

await check('library lists gym exercises and opens detail', async () => {
  await tab('Library');
  await page.getByRole('button', { name: /Barbell Bench Press/ }).first().click();
  await page.getByText('How to perform').waitFor();
  await page.getByText('Common mistakes').waitFor();
  await shot('exercise-detail');
  await page.getByRole('button', { name: /Back to Library/ }).click();
});

await check('library home section shows routines', async () => {
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByText('Full-Body Routines').first().waitFor();
  await shot('library-home');
  await page.getByRole('button', { name: /HIIT Express/ }).click();
  await page.getByRole('button', { name: /Save/ }).click();
  await page.getByText('Saved to My Routines').waitFor();
  await page.getByRole('button', { name: /Back to Library/ }).click();
});

await check('apply PPL split preset', async () => {
  await tab('Workouts');
  await page.getByRole('tab', { name: 'Splits' }).click();
  await page.getByRole('button', { name: /Push \/ Pull \/ Legs/ }).click();
  await confirmAlert('Add Program');
  await page.getByText('Active', { exact: true }).waitFor();
  await shot('splits');
});

await check('create a routine with the editor', async () => {
  await page.getByRole('tab', { name: 'Routines' }).click();
  await page.getByRole('button', { name: 'New routine' }).click();
  await page.getByLabel('Routine name').fill('Arms Day');
  await page.getByRole('button', { name: /Add Exercises/ }).click();
  await page.getByPlaceholder('Search exercises').fill('curl');
  await page.locator('.picker-item').first().click();
  await page.locator('.picker-item').nth(1).click();
  await page.getByRole('button', { name: /Add 2 exercises/ }).click();
  await wait(350);
  await shot('routine-editor');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Arms Day').waitFor();
  await shot('routines');
});

await check('log a full live workout', async () => {
  await tab('Home');
  await shot('home-today');
  await page.getByRole('button', { name: /Quick Start|Start Workout|Start an Extra Workout/ }).first().click();
  await page.locator('.session').waitFor();
  if ((await page.locator('.ex-block').count()) === 0) {
    await page.getByRole('button', { name: /Add Exercise/ }).click();
    await page.getByPlaceholder('Search exercises').fill('bench press');
    await page.locator('.picker-item').first().click();
    await page.getByRole('button', { name: /Add 1 exercise/ }).click();
    await wait(350);
  }
  const block = page.locator('.ex-block').first();
  const kindIsWeight = (await block.locator('input[aria-label$="weight"]').count()) > 0;
  if (kindIsWeight) await block.locator('input[aria-label$="weight"]').first().fill('60');
  await block.locator('input[aria-label$="reps"], input[aria-label$="seconds"]').first().fill('8');
  await block.getByRole('button', { name: 'Complete set' }).first().click();
  await page.locator('.rest-panel').waitFor();
  await shot('session-rest');
  // validation: completing an empty set without hints should be rejected
  await block.getByRole('button', { name: 'Add Set' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await shot('session-sets');
  await page.getByRole('button', { name: 'Minimise workout' }).click();
  await page.locator('.mini-bar').waitFor();
  await shot('mini-bar');
  await page.locator('.mini-bar').click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await confirmAlert('Finish');
  await page.getByText('Workout complete').waitFor();
  await shot('summary');
  await page.locator('.sheet').getByRole('button', { name: 'Done' }).click();
});

await check('history shows the workout and detail opens', async () => {
  await tab('Workouts');
  await page.getByRole('tab', { name: 'History' }).click();
  await page.locator('.history-card').first().click();
  await page.getByText('Duration').first().waitFor();
  await shot('workout-detail');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByText('Edit Workout').first().waitFor();
  await shot('workout-edit');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Workout updated').waitFor();
});

await check('log body weight', async () => {
  await tab('Progress');
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('button', { name: 'Log body weight' }).click();
  await page.getByLabel(/Weight in/).fill('82.4');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Weight logged').waitFor();
});

await check('data persists across reload', async () => {
  await page.goto(`${BASE}/?reload=1`);
  await tab('Workouts');
  await page.getByRole('tab', { name: 'History' }).click();
  await page.locator('.history-card').first().waitFor();
});

await check('load sample data from profile', async () => {
  await tab('Profile');
  await page.getByRole('button', { name: /Load sample data/ }).click();
  await confirmAlert('Load Sample');
  await page.getByText('Sample data loaded').waitFor();
  await wait(400);
  await shot('home-sample');
  await page.evaluate(() => document.querySelector('.screen')?.scrollTo(0, 99999));
  await wait(300);
  await shot('home-sample-bottom');
});

await check('progress overview / body / strength render charts', async () => {
  await tab('Progress');
  await page.getByRole('tab', { name: 'Overview' }).click();
  await page.locator('.chart svg').first().waitFor();
  await shot('progress-overview');
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.locator('.chart svg path').first().waitFor();
  await shot('progress-body');
  await page.getByRole('tab', { name: 'Strength' }).click();
  await page.locator('.strength-item').first().click();
  await page.locator('.chart svg path').first().waitFor();
  await shot('exercise-progress');
});

await check('live session shows previous hints and a PR badge', async () => {
  // Start from a routine (works on any weekday; Home may show a rest day).
  await tab('Workouts');
  await page.getByRole('tab', { name: 'Routines' }).click();
  await page.locator('.routine-card').first().getByRole('button', { name: /Start/ }).click();
  await page.locator('.session').waitFor();
  const block = page.locator('.ex-block').first();
  const prev = await block.locator('.set-prev').first().innerText();
  if (!/×/.test(prev)) throw new Error(`no previous hint, got "${prev}"`);
  // Complete set 1 from hints alone (placeholder values), then beat the PR on set 2.
  await block.getByRole('button', { name: 'Complete set' }).first().click();
  await block.locator('input[aria-label$="weight"]').nth(1).fill('250');
  await block.locator('input[aria-label$="reps"]').nth(1).fill('5');
  await block.getByRole('button', { name: 'Complete set' }).first().click();
  await block.getByText('PR', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Skip' }).click();
  await shot('session-pr');
  // The guide opens as a sheet without leaving the session.
  await block.locator('.ex-head-main').click();
  await page.locator('.sheet').getByText('How to perform').waitFor();
  await page.locator('.sheet').getByRole('button', { name: 'Done' }).click();
  await wait(350);
  await page.getByRole('button', { name: 'Discard Workout' }).click();
  await confirmAlert('Discard');
  await page.locator('.session').waitFor({ state: 'detached' });
});

await check('progress photo upload, view and compare', async () => {
  await tab('Progress');
  await page.getByRole('tab', { name: 'Photos' }).click();
  for (let i = 0; i < 2; i++) {
    await page.locator('input[type=file]').setInputFiles('public/icons/icon-512.png');
    await page.getByText('New Photo').waitFor();
    await page.locator('.sheet').getByRole('button', { name: 'Save' }).click();
    await page.getByText('Photo saved').waitFor();
    await wait(400);
  }
  await page.locator('.photo-cell img').first().waitFor();
  await shot('photos');
  await page.getByRole('button', { name: /Compare/ }).click();
  await page.locator('.photo-cell').nth(0).click();
  await page.locator('.photo-cell').nth(1).click();
  await page.getByRole('button', { name: 'Compare Photos' }).click();
  await page.getByText(/days? apart/).waitFor();
  await shot('photo-compare');
  await page.locator('.sheet').getByRole('button', { name: 'Done' }).click();
  await wait(350);
  await page.locator('.photo-cell').first().click();
  await page.getByRole('button', { name: 'Delete photo' }).click();
  await confirmAlert('Delete');
  await wait(400);
  if ((await page.locator('.photo-cell').count()) !== 1) throw new Error('photo not deleted');
});

await check('swipe to delete a body-weight entry', async () => {
  await page.getByRole('tab', { name: 'Body' }).click();
  const rows = page.locator('.swipe');
  const before = await rows.first().innerText();
  const box = await rows.first().boundingBox();
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width - 30;
  if (IS_WEBKIT) {
    // Playwright can't inject native touches into WebKit; dispatch touch-type PointerEvents instead.
    await page.evaluate(
      async ({ x0, y }) => {
        const el = document.elementFromPoint(x0, y);
        const fire = (type, x) =>
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
        fire('pointerdown', x0);
        for (let dx = 10; dx <= 140; dx += 10) {
          fire('pointermove', x0 - dx);
          await new Promise((r) => setTimeout(r, 16));
        }
        fire('pointerup', x0 - 140);
      },
      { x0, y },
    );
  } else {
    // Real touch events via CDP, like a finger on iPhone.
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let dx = 10; dx <= 140; dx += 10) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - dx, y: y + 1 }] });
      await wait(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await wait(400);
  await shot('swiped');
  await rows.first().getByRole('button', { name: 'Delete' }).click();
  await wait(200);
  const after = await rows.first().innerText();
  if (after === before) throw new Error('entry was not deleted');
});

await check('exercise picker search has an empty state', async () => {
  await tab('Workouts');
  await page.getByRole('tab', { name: 'Routines' }).click();
  await page.getByRole('button', { name: 'New routine' }).click();
  await page.getByRole('button', { name: /Add Exercises/ }).click();
  await page.getByPlaceholder('Search exercises').fill('zzzz');
  await page.getByText(/No exercises match/).waitFor();
  await page.locator('.sheet').getByRole('button', { name: 'Cancel' }).click();
  await wait(300);
  await page.getByRole('button', { name: 'Cancel' }).click();
});

await check('switch to Arabic (RTL) and back', async () => {
  await tab('Profile');
  await page.getByRole('tab', { name: 'العربية' }).click();
  await page.getByText('التفضيلات').waitFor();
  const dir = await page.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
  if (dir !== 'ar/rtl') throw new Error(`expected ar/rtl, got ${dir}`);
  // Navigation labels and library content are translated.
  await page.locator('.tabbar').getByRole('button', { name: 'المكتبة' }).click();
  await page.getByText('ضغط البنش بالبار').first().waitFor();
  // Survives a reload (applied before first paint).
  await page.goto(`${BASE}/?ar=1`);
  const dir2 = await page.evaluate(() => document.documentElement.dir);
  if (dir2 !== 'rtl') throw new Error('direction not restored after reload');
  await shot('arabic');
  const profile = page.locator('.tabbar').getByRole('button', { name: 'حسابي' });
  await profile.click();
  await page.waitForTimeout(120);
  await profile.click();
  await page.getByRole('tab', { name: 'English' }).click();
  await page.getByText('Preferences').waitFor();
});

await check('switch to imperial units', async () => {
  await tab('Profile');
  await page.getByRole('tab', { name: 'lb · in' }).click();
  await shot('profile');
  await tab('Home');
  await page.getByText(/lb/).first().waitFor();
  await tab('Profile');
  await page.getByRole('tab', { name: 'kg · cm' }).click();
});

await check('library animation is drawn', async () => {
  await tab('Library');
  await page.getByRole('tab', { name: 'Gym' }).click();
  await page.locator('.lib-card').nth(3).click();
  const lines = await page.locator('.guide-anim svg line').count();
  if (lines < 8) throw new Error(`figure has ${lines} lines`);
  await shot('exercise-anim');
});

// Only meaningful against a production build (service worker is disabled in dev).
if (process.env.E2E_OFFLINE || process.argv.includes('--offline')) {
  await check('works offline after first load (service worker)', async () => {
    await page.goto(ROOT);
    const ready = await page.evaluate(() =>
      Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 10_000))]),
    );
    if (!ready) throw new Error('service worker never became ready');
    await page.goto(ROOT); // now controlled by the SW, assets cached
    await wait(800);
    await ctx.setOffline(true);
    await page.goto(`${BASE}/#/library`);
    await page.getByText('Library').first().waitFor();
    await page.locator('.lib-card').first().waitFor();
    await shot('offline');
    await ctx.setOffline(false);
  });
}

await browser.close();

for (const r of results) console.log(r.join('  '));
if (errors.length) {
  console.log('\nConsole errors:');
  for (const e of [...new Set(errors)]) console.log(' -', e);
}
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} flows passed, ${errors.length} console errors`);
process.exit(failed || errors.length ? 1 : 0);
