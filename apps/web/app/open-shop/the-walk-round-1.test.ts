/**
 * the-walk-round-1.test.ts — the supplier walkthrough of 13 Nov 2026 (390 px, live 0dc2f67), round 1: what each fix
 * holds, so it cannot quietly come back. One test per finding id; each names the file it reads.
 *
 * SABOTAGE (each run once and reverted before commit):
 *   F-W1-04 — Continue's onClick back to `next` → RED.
 *   F-W1-13 — `accountEmailAtSubmit` returning `posted` always → RED.
 *   F-W1-10 — the sheet's onClose back to `() => setOpen(false)` → RED.
 *   F-W1-09 — `maxSizeMB={2}` back on Today's logo row → RED.
 *   F-W1-11 — `papersAbove` dropped from Today's VerifySection → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { accountEmailAtSubmit } from '@/lib/open-shop-account';
import { SHOP_LOGO_UPLOAD, shopLogoLimitsWords } from '@/lib/open-shop-logo';

const WEB = join(import.meta.dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const WIZARD = code('app/open-shop/_components/open-shop-wizard.tsx');

test('F-W1-04 · Continue is drawn busy at once and takes one move per press', () => {
  for (const id of ['open-shop-continue', 'open-shop-quiet']) {
    const at = WIZARD.indexOf(`data-testid="${id}"`);
    const btn = WIZARD.slice(WIZARD.lastIndexOf('<ActionButton', at), at);
    assert.match(btn, /onClick=\{go\}/, `${id} must go through go() (busy first, one move per press)`);
    assert.match(btn, /data-busy=\{moving/, `${id} must say it is busy`);
    assert.match(btn, /icon=\{continueIcon\}/, `${id} must show the spinner while moving`);
  }
  assert.match(WIZARD, /const continueIcon = moving \? <Loader2/, 'the spinner is gone');
  const go = WIZARD.slice(WIZARD.indexOf('const go = () =>'), WIZARD.indexOf('const back = () =>'));
  assert.match(go, /if \(movingRef\.current\) return;/, 'a second press while moving must be ignored');
  assert.match(go, /blur/, 'the box being typed in must lose the focus, so letters do not land on the next step');
  assert.match(go, /requestAnimationFrame/, 'the busy button must be painted before the next step is drawn');
  assert.match(WIZARD, /if \(step < TOTAL_STEPS\) go\(\);/, 'Enter must take the same path as Continue');
});

test('F-W1-13 · an untouched prefilled email is re-read from the account that submits', () => {
  assert.equal(accountEmailAtSubmit({ posted: 'a@x.ph', prefilled: 'a@x.ph', sessionEmail: 'b@x.ph' }), 'b@x.ph');
  assert.equal(accountEmailAtSubmit({ posted: 'shop@x.ph', prefilled: 'a@x.ph', sessionEmail: 'b@x.ph' }), 'shop@x.ph', 'a typed address is kept');
  assert.equal(accountEmailAtSubmit({ posted: 'a@x.ph', prefilled: null, sessionEmail: 'b@x.ph' }), 'a@x.ph', 'no prefill → as posted');
  assert.equal(accountEmailAtSubmit({ posted: 'a@x.ph', prefilled: 'a@x.ph', sessionEmail: null }), 'a@x.ph');
  const actions = code('app/open-shop/actions.ts');
  assert.match(actions, /const contactEmail = accountEmailAtSubmit\(/, 'the server must re-read the prefill at submit');
  assert.match(WIZARD, /key=\{`email-\$\{accountKey\}`\}/, 'the email box must be redrawn when the account changes');
  assert.match(code('app/open-shop/page.tsx'), /accountKey=\{user\?\.id \?\? 'guest'\}/);
});

test('F-W1-10 · closing the Terms sheet holds for the browser session', () => {
  const sheet = code('app/_components/terms-reaccept/terms-reaccept-sheet.tsx');
  assert.match(sheet, /onClose=\{close\}/);
  assert.match(sheet, /sessionStorage\.setItem\(TERMS_SHEET_CLOSED_KEY, TERMS_VERSION\)/);
  assert.match(sheet, /useState\(false\)/, 'opened on mount, so a closed sheet never flashes');
});

test('F-W1-06 · "Celebration" is said as an event on Events you serve; the key is kept', () => {
  const tiles = code('app/open-shop/_components/event-tiles.tsx');
  assert.match(tiles, /e\.key === 'celebration' \? \{ \.\.\.e, label: 'Other events' \} : e/);
  assert.match(WIZARD, /supplierEventWords\(rosterIn\)/, 'the wizard must use the door words for its roster');
});

test('F-W1-09 · one logo rule, from one constant, in both places', () => {
  assert.equal(SHOP_LOGO_UPLOAD.maxSizeMB, 10, 'the server (`/api/upload`, media bucket) enforces 10 MB');
  assert.equal(shopLogoLimitsWords(), 'PNG, JPEG, WEBP, HEIC or HEIF up to 10 MB');
  for (const rel of ['app/open-shop/logo/_components/add-your-logo.tsx', 'app/vendor-dashboard/shop/_components/editable-row.tsx']) {
    const src = code(rel);
    assert.match(src, /maxSizeMB=\{SHOP_LOGO_UPLOAD\.maxSizeMB\}/, `${rel}: the size must be the shared one`);
    assert.match(src, /acceptedTypes=\{\[\.\.\.SHOP_LOGO_UPLOAD\.acceptedTypes\]\}/, `${rel}: the types must be the shared ones`);
  }
  assert.doesNotMatch(code('app/vendor-dashboard/shop/_components/editable-row.tsx'), /up to 2 MB/);
});

test('F-W1-11 · Today asks for the papers once — Get verified points to them', () => {
  const screen = code('app/vendor-dashboard/_components/supplier-setup-screen.tsx');
  assert.match(screen, /papersAbove=\{SETUP_PAPERS_ID\}/);
  assert.match(screen, /id=\{SETUP_PAPERS_ID\}/);
  const verify = code('app/vendor-dashboard/shop/_components/verify-section.tsx');
  assert.match(verify, /open && !papersAbove && !payload/, 'the step must not load the papers a second time');
});

test('F-W1-07 / F-W1-08 / F-W1-12 · the map hint clears the credit; the logo screen wears the wizard shell; step 5 has its line', () => {
  assert.match(code('app/open-shop/_components/city-pin.tsx'), /absolute inset-x-0 bottom-\[18px\]/);
  const logo = code('app/open-shop/logo/_components/add-your-logo.tsx');
  assert.match(logo, /data-open-shop-segments=""/, 'the logo screen lost its step bars');
  assert.match(logo, /data-open-shop-bar=""/, 'the logo screen lost the sticky bottom bar');
  assert.doesNotMatch(logo, /items-center justify-center px-4 py-10/, 'the centred, re-centring card is back');
  assert.match(WIZARD, /'Your shop’s email, then open your shop\.'/);
  assert.match(WIZARD, /books you through Setnayan\."/);
});
