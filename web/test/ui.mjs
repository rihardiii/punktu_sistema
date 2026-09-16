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

console.log('\nconsole errors:', consoleErrors.length ? consoleErrors.join('; ') : 'none');
if (consoleErrors.length) failed = 1;

await browser.close();
console.log(failed ? '\nSOME TESTS FAILED' : '\nALL PASSED');
process.exit(failed);
