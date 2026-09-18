/*
 * Browser regression tests for the parts of the UI that unit-level checks miss.
 *
 * Requires Playwright, which is deliberately NOT a dependency of this project —
 * a family hosting the app should not have to download a browser to install it.
 * Install it only when you want to run these tests (--no-save keeps it out of
 * package.json; a global install will not resolve from an ES module):
 *
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *
 * Then, against a server with an EMPTY database (it runs first-run setup):
 *
 *   npm run build
 *   PUNKTI_DB=/tmp/uitest.sqlite PORT=4230 node server/dist/index.js &
 *   BASE=http://localhost:4230 node web/test/ui.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4230';

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed = 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} ${ok ? actual : `got=${actual} want=${expected}`}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

await page.goto(BASE);
await page.waitForTimeout(700);

/*
 * Typing is done with pressSequentially, not fill(). fill() sets the value in a
 * single operation and so cannot catch focus being stolen between keystrokes —
 * which is exactly how the v0.03 modal bug slipped through.
 */
console.log('== first-run setup (plain form) ==');
await page.locator('.card input').nth(0).pressSequentially('Mamma', { delay: 30 });
await page.locator('.card input').nth(1).pressSequentially('mamma', { delay: 30 });
await page.locator('.card input').nth(2).pressSequentially('1234', { delay: 30 });
check('name survives per-key typing', await page.locator('.card input').nth(0).inputValue(), 'Mamma');
check('username survives per-key typing', await page.locator('.card input').nth(1).inputValue(), 'mamma');
await page.getByRole('button', { name: /Izveidot/ }).click();
await page.waitForTimeout(1200);

console.log('== modal keeps focus while typing (regression: v0.04) ==');
await page.locator('.tab', { hasText: 'Ģimene' }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Pievienot bērnu/ }).click();
await page.waitForTimeout(500);

const name = page.locator('.modal input').nth(0);
await name.click();
await name.pressSequentially('Anna', { delay: 40 });
check('modal name field keeps focus', await name.inputValue(), 'Anna');
check(
  'focus still inside the field',
  await name.evaluate((el) => el === document.activeElement),
  true,
);

const username = page.locator('.modal input').nth(1);
await username.click();
await username.pressSequentially('anna', { delay: 40 });
check('modal username field keeps focus', await username.inputValue(), 'anna');

const pin = page.locator('.modal input').nth(2);
await pin.click();
await pin.pressSequentially('1111', { delay: 40 });
check('modal pin field keeps focus', await pin.inputValue(), '1111');

console.log('== modal still closes on Escape ==');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('escape closed the dialog', await page.locator('.modal').count(), 0);

console.log('== page scroll is restored after a modal closes ==');
check(
  'body overflow released',
  await page.evaluate(() => document.body.style.overflow),
  '',
);

console.log('== the member actually saves ==');
await page.getByRole('button', { name: /Pievienot bērnu/ }).click();
await page.waitForTimeout(400);
await page.locator('.modal input').nth(0).pressSequentially('Anna', { delay: 30 });
await page.locator('.modal input').nth(1).pressSequentially('anna', { delay: 30 });
await page.locator('.modal input').nth(2).pressSequentially('1111', { delay: 30 });
await page.getByRole('button', { name: 'Saglabāt' }).click();
await page.waitForTimeout(1000);
check('kid appears in the family list', await page.locator('.item', { hasText: 'Anna' }).count(), 1);

console.log('== autoFocus inside a modal is respected ==');
// The reject-reason dialog autoFocuses its textarea; nothing should steal it.
await page.locator('.tab', { hasText: 'Pārskats' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Piešķirt punktus/ }).first().click();
await page.waitForTimeout(500);
check(
  'autoFocused reason field has focus',
  await page.evaluate(() => document.activeElement?.tagName),
  'INPUT',
);

console.log('== the admin is marked in the family list ==');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.locator('.tab', { hasText: 'Ģimene' }).click();
await page.waitForTimeout(700);
// Mamma ran setup, so she is the admin; Anna is a kid and must not be marked.
check('setup parent carries the admin badge', await page.locator('.badge-admin').count(), 1);

console.log('== a kid asks for a PIN reset from the login screen ==');
await page.locator('.tab', { hasText: 'Iestatījumi' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Iziet/ }).click();
await page.waitForTimeout(900);
check('back at the login screen', await page.locator('.face').count(), 2);

await page.locator('.face', { hasText: 'Anna' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Aizmirsi PIN/ }).click();
await page.waitForTimeout(400);
check('the forgot-PIN dialog opened', await page.locator('.modal').count(), 1);
await page.getByRole('button', { name: 'Nosūtīt' }).click();
await page.waitForTimeout(800);
check('the dialog closed after sending', await page.locator('.modal').count(), 0);

console.log('== the request reaches the parent ==');
await page.getByRole('button', { name: 'Atpakaļ' }).click();
await page.waitForTimeout(400);
await page.locator('.face', { hasText: 'Mamma' }).click();
await page.waitForTimeout(400);
for (const digit of '1234') {
  await page.locator('.pin-key', { hasText: digit }).first().click();
  await page.waitForTimeout(80);
}
// The keypad has no ✓ key — it submits on Enter or the button below it.
await page.getByRole('button', { name: 'Ieiet' }).click();
await page.waitForTimeout(1400);
await page.locator('.tab', { hasText: 'Ģimene' }).click();
await page.waitForTimeout(800);
check(
  'the PIN request card is waiting',
  await page.locator('.card', { hasText: 'PIN atiestatīšanas' }).count(),
  1,
);

console.log('== the app and the server agree on the version ==');
/*
 * The version is written in one place, the root package.json, but it reaches
 * the screen and the API by different routes: Vite inlines it at build time,
 * the server reads the manifest at startup. Each applies its own copy of the
 * 0.12.0 -> 0.12 conversion, so this is the check that stops those two copies
 * from drifting apart unnoticed.
 */
await page.locator('.tab', { hasText: 'Iestatījumi' }).click();
await page.waitForTimeout(700);
const shownVersion = await page
  .locator('.row-between', { hasText: 'Versija' })
  .locator('.tnum')
  .innerText();
const healthVersion = await page.evaluate(() =>
  fetch('/api/health')
    .then((r) => r.json())
    .then((d) => d.version),
);
check('the screen shows a version at all', /^\d+\.\d+/.test(shownVersion.trim()), true);
check('and it is the one the server reports', shownVersion.trim(), healthVersion);

console.log('== an open request badges its tab ==');
// Anna's forgotten PIN is still waiting, and badges are the only notification
// this app has — over plain HTTP on a LAN the browser's push APIs do nothing.
check(
  'the family tab carries the count',
  await page.locator('.tab', { hasText: 'Ģimene' }).locator('.tab-dot').innerText(),
  '1',
);

console.log('== the deeds/rewards toggle is not crowded off the line ==');
await page.locator('.tab', { hasText: 'Darbi' }).click();
await page.waitForTimeout(800);
const headBox = await page.locator('.page-head').boundingBox();
const titleBox = await page.locator('.page-head h1').boundingBox();
const toggleBox = await page.locator('.page-head .segmented').boundingBox();
// In Latvian "Labo darbu saraksts" leaves no room beside it, so on a phone the
// toggle takes a full row of its own rather than half-wrapping under the title.
check('the toggle fills its own row', Math.abs(toggleBox.width - headBox.width) < 2, true);
check('and sits below the heading', toggleBox.y >= titleBox.y + titleBox.height - 1, true);

console.log('== a deed remembers both of its time windows ==');
await page.locator('.item', { hasText: 'Iztīrīt zobus' }).getByRole('button', { name: /Labot/ }).click();
await page.waitForTimeout(500);
// Morning and evening: two windows, so four time boxes.
check('four time boxes for two windows', await page.locator('.modal input[type=time]').count(), 4);
check(
  'the times are the ones stored',
  (await page.locator('.modal input[type=time]').evaluateAll((els) => els.map((e) => e.value))).join(),
  '06:00,10:00,19:00,22:30',
);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('== out of hours a deed is locked on the kid screen ==');
/*
 * The seeded deeds are open at real times of day, so a test run at 08:00 would
 * see something different from one at 23:00. This deed is given a window that
 * certainly is not now, built from the current clock and kept inside the day so
 * it never wraps past midnight.
 */
const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
const shutWindow =
  nowMinutes >= 720 ? [{ start_min: 0, end_min: 60 }] : [{ start_min: 1380, end_min: 1439 }];
await page.evaluate(
  (windows) =>
    fetch('/api/catalog/deeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title_lv: 'Slēgts darbs', points: 5, windows, max_per_day: 1 }),
    }),
  shutWindow,
);

await page.locator('.tab', { hasText: 'Iestatījumi' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Iziet/ }).click();
await page.waitForTimeout(900);
await page.locator('.face', { hasText: 'Anna' }).click();
await page.waitForTimeout(400);
for (const digit of '1111') {
  await page.locator('.pin-key', { hasText: digit }).first().click();
  await page.waitForTimeout(80);
}
await page.getByRole('button', { name: 'Ieiet' }).click();
await page.waitForTimeout(1500);
// Logging out from Settings leaves the app on that route, so go home first.
await page.locator('.tab', { hasText: 'Sākums' }).click();
await page.waitForTimeout(1000);

const shutTile = page.locator('.tile', { hasText: 'Slēgts darbs' });
check('the out-of-hours tile is disabled', await shutTile.isDisabled(), true);
check('and says when it opens', (await shutTile.innerText()).includes('🕒'), true);
// Tapping it must do nothing at all — no dialog to submit from.
await shutTile.click({ force: true }).catch(() => {});
await page.waitForTimeout(400);
check('tapping a locked tile opens nothing', await page.locator('.modal').count(), 0);

console.log('\nconsole errors:', consoleErrors.length ? consoleErrors.join('; ') : 'none');
if (consoleErrors.length) failed = 1;

await browser.close();
console.log(failed ? '\nSOME TESTS FAILED' : '\nALL PASSED');
process.exit(failed);
