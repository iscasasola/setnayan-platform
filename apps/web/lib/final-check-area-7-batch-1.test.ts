/**
 * 🔒 Final check 25 Nov · area 7 · lane A batch 1 — one test per claim (PLAN-area-7.md, batch A1/A2 rows).
 * Most of these screens need a signed-in shop, WebGL or the sample event to render, so each claim is read off the
 * shipped source with comments stripped (`lib/strip-comments.ts`); pure pieces are called directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { routes } from './routes';

const WEB = process.cwd();
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('A7-02 · the venue walk\'s Try again keeps the guest\'s personal token (one template)', () => {
  const page = src('app/[slug]/venue/page.tsx');
  const failed = page.slice(page.indexOf('if (error || !scene) {'), page.indexOf('if (!scene.published) {'));
  assert.match(failed, /<Link href=\{`\/\$\{slug\}\/venue\?t=\$\{encodeURIComponent\(token \?\? ''\)\}`\}/, 'Try again drops ?t=');
  assert.doesNotMatch(failed, /href=\{`\/\$\{slug\}\/venue`\}/, 'a tokenless Try again is back');
  // An empty `t` is read as no token, so the anonymous walk is unchanged.
  assert.match(page, /const token = \(t \?\? ''\)\.trim\(\) \|\| null;/);
});

test('A7-03 · an expired demo code points to /pa3d/try with one button; a failed read is not "expired"', () => {
  assert.equal(routes.pa3d.try(), '/pa3d/try');
  const page = src('app/3d_plan/demo/[token]/page.tsx');
  assert.doesNotMatch(page, /homepage/i, 'the dead end still points at the gone homepage tile');
  assert.match(page, /<Link href=\{routes\.pa3d\.try\(\)\} className=\{actionButtonClass\('brand', \{ main: true \}\)\}>/);
  assert.match(page, /We couldn’t open this demo\./);
  const actions = src('app/_actions/plan3d-demo-actions.ts');
  assert.match(actions, /if \(guestResult\.error\) throw new Error\(/, 'a refused guests read is drawn as nobody seated');
  assert.match(actions, /catch \{\s*return \{ ok: false, reason: 'read_failed' \};/);
  assert.match(actions, /return \{ ok: false, reason: 'expired' \};/);
});

test('A7-04 · the demo guest line makes no promise to "every real Setnayan guest"', () => {
  const view = src('app/3d_plan/demo/[token]/_components/plan3d-guest-view.tsx');
  assert.doesNotMatch(view, /every real Setnayan guest/);
  assert.match(view, /Guests get this on the day when their hosts share the seat plan\./);
});

test('A7-06 · a failed or empty guest code says so with Try again for the same guest', () => {
  const room = src('app/(shell)/pa3d/_pa3d-room.tsx');
  assert.match(room, /\.then\(\(r\) => \{\s*setQr\(r\);\s*if \(!r\) setQrFailedFor\(guestId\);/, 'an empty answer vanishes');
  assert.match(room, /\.catch\(\(\) => \{\s*setQr\(null\);\s*setQrFailedFor\(guestId\);/, 'a refused mint vanishes');
  assert.match(room, /Couldn’t make their code\./);
  assert.match(room, /onClick=\{\(\) => handleGuestClick\(qrFailedFor\)\}/, 'Try again does not re-run the same guest');
});

test('A7-28 · /pa3d calls the sample a sample, once', () => {
  const room = src('app/(shell)/pa3d/_pa3d-room.tsx');
  const tryPage = src('app/(shell)/pa3d/try/page.tsx');
  for (const s of [room, tryPage]) assert.doesNotMatch(s, /not a mock-up|real reception/i);
  assert.match(room, /A sample reception/);
  assert.match(tryPage, /<Pa3dRoom introduced \/>/, '/pa3d/try says it a second time in the card');
  assert.match(tryPage, /Stand in a sample reception\./);
});

test('A7-13 · a refused date read keeps the old day and never says "Saved"', () => {
  const actions = src('app/vendor-dashboard/spaces/actions.ts');
  const read = actions.slice(actions.indexOf("case 'read': {"), actions.indexOf('default:', actions.indexOf("case 'read': {")));
  assert.doesNotMatch(read, /fresh\(/, 'the date read goes through the save path again');
  assert.doesNotMatch(read, /Saved/);
  assert.match(read, /Couldn’t read that day just now\./);
  const screen = src('app/vendor-dashboard/spaces/_components/spaces-screen.tsx');
  assert.match(screen, /void run\(\{ op: 'read' \}, undefined, k\)\.then\(\(ok\) => \{\s*if \(ok\) setDate\(k\);/, 'the heading moves before the day is read');
});

test('A7-14 · both Spaces locks carry the Plus price from the catalogue — never typed, never null by constant', () => {
  const sheet = src('app/vendor-dashboard/spaces/_components/space-sheet.tsx');
  assert.doesNotMatch(sheet, /price: null/, 'a lock with no price is back');
  assert.match(sheet, /export function paidNeed\(planPrice: string \| null\): LockNeed \{\s*return \{ kind: 'plan', plan: 'solo', price: planPrice,/);
  assert.equal((sheet.match(/need=\{paidNeed\(planPrice\)\}/g) ?? []).length, 1, 'the names lock does not read the price');
  const screen = src('app/vendor-dashboard/spaces/_components/spaces-screen.tsx');
  assert.match(screen, /need=\{paidNeed\(planPrice\)\}/, 'the floor-plan lock does not read the price');
  const page = src('app/vendor-dashboard/spaces/page.tsx');
  assert.match(page, /getVendorPrices\(\)/);
  assert.match(page, /monthlyPlanPrice\(prices, 'solo'\)/);
  assert.match(page, /planPrice=\{planPrice\}/);
  for (const f of ['app/vendor-dashboard/spaces/page.tsx', 'app/vendor-dashboard/spaces/_components/space-sheet.tsx']) {
    assert.doesNotMatch(src(f), /₱\s?\d/, `${f} types a price`);
  }
});

test('A7-29 · the "not confirmed on Setnayan yet" lock has ONE button, to the client\'s chat', () => {
  const lock = src('app/vendor-dashboard/_components/event-locked-by-fee.tsx');
  assert.match(
    lock,
    /!cta && stage === 'booked_fee_due' && access\.reason === 'no_charge' && eventId \? \(\s*<ActionButton\s+tone="brand"\s+main\s+href=\{`\/vendor-dashboard\/clients\/\$\{eventId\}\?tab=chat`\}/,
  );
  assert.match(lock, /label="Open the booking to accept it"/);
});

test('A7-30 · a refused Spaces save shows its reason INSIDE the sheet', () => {
  const sheet = src('app/vendor-dashboard/spaces/_components/space-sheet.tsx');
  assert.match(sheet, /\{refusal \? \(\s*<p className="mt-3 text-sn-md font-medium text-ink" role="alert" data-space-refusal="">\s*\{refusal\}/);
  const screen = src('app/vendor-dashboard/spaces/_components/spaces-screen.tsx');
  assert.match(screen, /refusal=\{msg\?\.tone === 'warn' \? msg\.text : null\}/, 'the sheet is not handed the refusal');
});

test('A7-31 · the empty Spaces page offers one "Add a space" button, never "the box below"', () => {
  const screen = raw('app/vendor-dashboard/spaces/_components/spaces-screen.tsx');
  assert.doesNotMatch(screen, /the box below/);
  const empty = stripComments(screen).slice(stripComments(screen).indexOf('data-spaces-empty=""'));
  assert.match(empty.slice(0, 600), /<ActionButton\s+tone="brand"\s+main\s+icon=\{Plus\}\s+label="Add a space"[\s\S]*?onClick=\{\(\) => openNew\(''\)\}/);
});
