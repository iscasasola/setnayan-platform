/**
 * supplier-cuts-first-steps.test.ts — 🧰 THE SUPPLIER'S FIRST STEPS, CUTS 1 AND 4 (owner-approved 2026-11-14 —
 * DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html`).
 *
 *   (1) /for-suppliers: the stage is short and still — no scroll-driven track — so the first "Create your shop free" is
 *       on the first screen; the five people play on a timer.
 *   (2) the supplier's tour shows ONCE: no tick box, no "plays again each time you sign in".
 *   (3) "In business since" never holds the inspiration pages; every other missing step still holds them, and it still
 *       holds the rest of the supplier tree.
 *   (4) the inspiration form starts on the shop's own kind of work, its Label is optional, and an empty label is named
 *       after the linked card (else the part) on the server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { TOURS } from './tours';
import { pageIsHeld, NOT_A_HOLD_ON } from './basic-setup-gate';
import { slotForShopKind } from './moodboard-library-access';
import { uploadableSlotsForShop } from './moodboard-gallery-upload';
import { fallbackInspirationParts } from './inspiration-parts';
import { canonicalServicesForTile } from './vendor-counts';

const WEB = join(__dirname, '..');
const tileServices = (t: string) => canonicalServicesForTile(t as Parameters<typeof canonicalServicesForTile>[0]);
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) the /for-suppliers stage is short and still — no scroll track; the people play on a timer', () => {
  const css = readFileSync(join(WEB, 'app/for-suppliers/_components/supplier-front.module.css'), 'utf8');
  assert.doesNotMatch(css, /\.heroTrack\s*\{\s*height:\s*calc\(100svh \+ 250svh\)/, 'the 3.5-screen scroll track is back');
  assert.doesNotMatch(css, /\.heroSticky\s*\{[^}]*position:\s*sticky/, 'the stage sticks and scrolls again');
  const sticky = css.match(/\.heroSticky\s*\{[^}]*height:\s*min\((\d+)svh/);
  assert.ok(sticky && Number(sticky[1]) <= 40, `the phone stage is taller than a first screen allows (${sticky?.[1]}svh)`);
  const stage = read('app/for-suppliers/_components/supplier-front-client.tsx');
  const hero = stage.slice(stage.indexOf('export function HeroStage'), stage.indexOf('export function CheckADateDemo'));
  assert.ok(hero.length > 200 && stage.indexOf('export function CheckADateDemo') > stage.indexOf('export function HeroStage'), 'anti-vacuity: HeroStage not found');
  assert.doesNotMatch(hero, /addEventListener\('scroll'/, 'the people change on scroll again');
  assert.match(hero, /window\.setInterval\(/, 'the people no longer play by themselves');
  /* The heading and the first button are in the hero section, straight after the stage. */
  const page = read('app/for-suppliers/_components/supplier-front-page.tsx');
  const heroSection = page.slice(page.indexOf('<HeroStage'), page.indexOf('2 · WHY') > 0 ? page.indexOf('<section className={s.beat}>') : undefined);
  assert.match(heroSection, /<h1>Not just a place to sell\. A place to stay\.<\/h1>/);
  assert.match(heroSection, /data-sf-cta=""/, 'the first button left the hero');
});

test('(2) the supplier tour shows once — no tick box, no replay at every sign-in', () => {
  const finale = TOURS.supplier_spotlight_v1.spotlight?.finale;
  assert.ok(finale, 'anti-vacuity: the supplier tour has no finale');
  assert.equal((finale as { tick?: string }).tick, undefined, 'the tick box is back');
  assert.doesNotMatch(finale.body, /tick|each time you sign in/i);
  assert.match(finale.body, /Show me around/, 'the way to see it again is no longer said');
});

test('(3) "In business since" never holds the inspiration pages — and only those', () => {
  const est = { missing: ['in_business_since_year'], missingLabels: ['In business since'] };
  for (const page of NOT_A_HOLD_ON.in_business_since_year ?? []) {
    assert.equal(pageIsHeld(page, est), false, `${page} is still locked by "In business since"`);
  }
  assert.ok((NOT_A_HOLD_ON.in_business_since_year ?? []).includes('/vendor-dashboard/moodboard-library'));
  assert.ok((NOT_A_HOLD_ON.in_business_since_year ?? []).includes('/vendor-dashboard/collections'));
  /* Another step still missing → still held there; and EST still holds the rest of the tree. */
  const estAndPhone = { missing: ['in_business_since_year', 'contact_phone'], missingLabels: ['In business since', 'Contact number'] };
  assert.equal(pageIsHeld('/vendor-dashboard/moodboard-library', estAndPhone), true, 'a missing contact no longer holds inspiration');
  assert.equal(pageIsHeld('/vendor-dashboard/shop', { ...est }), true, 'EST stopped holding the rest of the supplier tree');
});

test('(4) the form starts on the shop’s own kind; Label is optional and filled from the card', () => {
  const parts = fallbackInspirationParts();
  const florist = canonicalServicesForTile('florist');
  const stylist = canonicalServicesForTile('stylist_decorator');
  /* A florist that also styles: every part lists the florist's services, so only the lead trade picks — never Table linens. */
  const slots = uploadableSlotsForShop([...florist, ...stylist], parts);
  assert.ok(slots.length > 3, 'anti-vacuity: no slots');
  assert.notEqual(slots[0]!.key, slotForShopKind(slots, [...florist, ...stylist], parts, tileServices), 'anti-vacuity: the first slot already is the own kind');
  assert.equal(slotForShopKind(slots, [...florist, ...stylist], parts, tileServices), 'bridal_bouquet');
  assert.equal(slotForShopKind(slots, [], parts, tileServices), null);
  const editor = read('app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx');
  const label = editor.slice(editor.indexOf('name="label"'), editor.indexOf('/>', editor.indexOf('name="label"')));
  assert.ok(label.length > 20, 'anti-vacuity: the label input was not found');
  assert.doesNotMatch(label, /\brequired\b/, 'the label is required again');
  assert.match(editor, /startSlot && gallerySlots\.some\(\(s\) => s\.key === startSlot\) \? startSlot/, 'the form no longer starts on the shop’s own kind');
  const page = read('app/vendor-dashboard/moodboard-library/page.tsx');
  assert.match(page, /startSlot=\{ownSlot\}/, 'the page no longer hands the own-kind part to the form');
  const action = read('app/vendor-dashboard/moodboard-library/actions.ts');
  assert.match(action, /if \(!label && assetType !== SUPPLIER_GALLERY_ASSET_TYPE\) throw new Error\('label required'\);/);
  assert.match(action, /if \(!label\) label = await inspirationLabelFallback\(/, 'an empty label is no longer filled from the card');
  assert.match(action, /if \(card\) return cardLabel\(card\);/);
});
