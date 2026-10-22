/**
 * buying-pro-part-by-part.test.ts — 💎 PR 2 of "Event Hub Pro, part by part" (owner 2026-10-22; prototype
 * `prototypes/pro_part_by_part_2026-10-22.html` frames 1–5).
 *
 * Properties:
 *   (A) WHAT A PURCHASE COSTS — parts at their catalogue sum, everything at the rest, NEVER above the rest; a part held
 *       is never charged twice; an unread price is refused, never guessed (`hubPartsCharge`).
 *   (B) THE APPLY SHEET — the held effects grouped under their part in the parts' own order, each priced; the buttons by
 *       the prototype's own numbers; no figure invented when one is unread (`apply-sheet-parts.ts`).
 *   (C) THE DOORS — the sheet has no "Go to ↗" (owner: no go-edit-elsewhere links; the row is the press); the rename
 *       asks for the Custom address part before it writes; the Maker's Apply renames through the ONE rename; the charge
 *       authority prices every Event Hub Pro key; no price typed in the new surfaces.
 *
 * Sabotage (recorded in the PR): `sum > rest` → `sum >= rest + 1` in `hubPartsCharge` → (A) red; the sheet's lead rule
 * flipped → (B) red; a "Go to" put back → (C) red; the address gate removed from `updateEventSlug` → (C) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_PARTS, hubOwnershipFrom, hubPartsCharge, parseHubPartsField, type HubOwnership, type HubPartId } from './hub-parts';
import { applySheetButtons, applySheetParts, partsBuyHref, type ApplySheetPricing } from './apply-sheet-parts';
import type { HubProEffectView } from './hub-pro-effect-view';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* The owner's sample sheet, HANDED IN as the catalogue read would hand it. */
const PRICES = new Map<string, number>(HUB_PARTS.map((p) => [p.sku, p.size === 'big' ? 1000 : 500]));
const FULL = 5000;
const owning = (paid: HubPartId[]): HubOwnership =>
  hubOwnershipFrom({ fullHeld: false, partHeld: (id) => paid.includes(id), paidParts: paid, prices: PRICES, fullPrice: FULL });

/* ── (A) WHAT A PURCHASE COSTS ──────────────────────────────────────────── */

test('(A) parts cost their catalogue sum; everything costs the rest', () => {
  assert.deepEqual(hubPartsCharge({ parts: ['style', 'motion'], owned: owning([]), prices: PRICES, fullPrice: FULL }), { ok: true, php: 2000, capped: false });
  assert.deepEqual(hubPartsCharge({ parts: 'full', owned: owning([]), prices: PRICES, fullPrice: FULL }), { ok: true, php: 5000, capped: false });
  /* Frame 2: ₱3,500 paid → everything is ₱1,500. */
  assert.deepEqual(hubPartsCharge({ parts: 'full', owned: owning(['reveal', 'background', 'photos', 'music']), prices: PRICES, fullPrice: FULL }), { ok: true, php: 1500, capped: false });
});

test('(A) never charged above the rest — and a purchase that reaches it unlocks everything', () => {
  const paid = owning(['reveal', 'background', 'photos', 'music']); // ₱3,500
  const c = hubPartsCharge({ parts: ['style', 'motion'], owned: paid, prices: PRICES, fullPrice: FULL });
  assert.deepEqual(c, { ok: true, php: 1500, capped: true }, 'two parts charged above the ₱1,500 rest');
  const after = owning(['reveal', 'background', 'photos', 'music', 'style', 'motion']);
  assert.equal(after.full, true, 'paying the rest through parts did not unlock everything');
});

test('(A) nobody pays twice, and an unread price is refused', () => {
  assert.deepEqual(hubPartsCharge({ parts: ['style'], owned: owning(['style']), prices: PRICES, fullPrice: FULL }), { ok: false, why: 'already_owned' });
  assert.deepEqual(hubPartsCharge({ parts: 'full', owned: owning(['reveal', 'background', 'photos', 'style', 'motion']), prices: PRICES, fullPrice: FULL }), { ok: false, why: 'already_owned' });
  assert.deepEqual(hubPartsCharge({ parts: ['style'], owned: owning([]), prices: new Map(), fullPrice: FULL }), { ok: false, why: 'unpriced' });
  assert.deepEqual(hubPartsCharge({ parts: ['style'], owned: owning([]), prices: PRICES, fullPrice: null }), { ok: false, why: 'unpriced' });
  assert.deepEqual(hubPartsCharge({ parts: [], owned: owning([]), prices: PRICES, fullPrice: FULL }), { ok: false, why: 'nothing_to_buy' });
});

test('(A) the parts field is read strictly — known parts, each once, in the table’s order', () => {
  assert.deepEqual(parseHubPartsField('motion,style,motion,nope,'), ['style', 'motion']);
  assert.deepEqual(parseHubPartsField(42), []);
});

/* ── (B) THE APPLY SHEET ────────────────────────────────────────────────── */

const effect = (id: string, part: HubPartId, what: string, where: string): HubProEffectView =>
  ({ id, part, what, where, jump: null, removable: true }) as HubProEffectView;
const pricing = (paid: HubPartId[] = []): ApplySheetPricing => ({
  partPricePhp: Object.fromEntries(HUB_PARTS.map((p) => [p.id, p.size === 'big' ? 1000 : 500])),
  fullPricePhp: FULL,
  ownership: { full: false, parts: paid, paidPhp: owning(paid).paidPhp, fullPricePhp: FULL },
});

test('(B) the held effects are grouped under their part, in the parts’ order, each priced', () => {
  const g = applySheetParts(
    [effect('a', 'motion', 'Animation', 'Schedule'), effect('b', 'style', 'Font', 'Names on the Hero'), effect('c', 'style', 'Colour · Size', 'Schedule'), effect('d', 'motion', 'Transition', 'Scrub')],
    pricing(),
  )!;
  assert.deepEqual(g.parts.map((p) => [p.name, p.pricePhp, p.effects.map((e) => e.id)]), [
    ['Style', 1000, ['b', 'c']],
    ['Motion', 1000, ['a', 'd']],
  ]);
  assert.equal(g.collapsed, false);
  /* Four parts or more: one line a part (the sheet never scrolls past eight lines). */
  const four = applySheetParts(['reveal', 'background', 'style', 'music'].map((p, i) => effect(String(i), p as HubPartId, 'x', 'y')), pricing())!;
  assert.equal(four.collapsed, true);
});

test('(B) frame 1 — ₱2,000 of parts, nothing paid: parts lead, ₱3,000 more for everything', () => {
  const g = applySheetParts([effect('a', 'style', 'Font', 'Hero'), effect('b', 'motion', 'Animation', 'Schedule')], pricing());
  const b = applySheetButtons(g, pricing())!;
  assert.equal(b.lead, 'parts');
  assert.equal(b.showParts, true);
  assert.equal(b.subtotalPhp, 2000);
  assert.equal(b.morePhp, 3000);
  assert.equal(b.restPhp, 5000);
  assert.equal(b.partsLabel, 'Style + Motion');
  assert.equal(b.otherParts, 9);
});

test('(B) frame 1-closer — ₱3,500 of parts: everything leads, only ₱1,500 more', () => {
  const g = applySheetParts(['reveal', 'background', 'style', 'music'].map((p, i) => effect(String(i), p as HubPartId, 'x', 'y')), pricing());
  const b = applySheetButtons(g, pricing())!;
  assert.equal(b.lead, 'everything');
  assert.equal(b.showParts, true);
  assert.equal(b.morePhp, 1500);
});

test('(B) frame 2 — ₱3,500 paid, two parts above the ₱1,500 rest: one button, the rest', () => {
  const paid: HubPartId[] = ['reveal', 'background', 'photos', 'music'];
  const g = applySheetParts([effect('a', 'style', 'Font', 'Hero'), effect('b', 'motion', 'Animation', 'Schedule')], pricing(paid));
  const b = applySheetButtons(g, pricing(paid))!;
  assert.equal(b.showParts, false, 'the parts were offered for more than everything costs');
  assert.equal(b.restPhp, 1500);
  assert.equal(b.paidPhp, 3500);
  assert.deepEqual(b.ownedNames, ['Reveal', 'Background', 'Photos', 'Music']);
  assert.equal(b.otherParts, 5, '"the other 5 parts" (frame 2)');
});

test('(B) an unread figure invents nothing — the buttons fall back to the one unlock', () => {
  const g = applySheetParts([effect('a', 'style', 'Font', 'Hero')], { ...pricing(), fullPricePhp: null });
  assert.equal(applySheetButtons(g, { ...pricing(), fullPricePhp: null }), null);
  const noStyle = { ...pricing(), partPricePhp: { motion: 1000 } };
  assert.equal(applySheetButtons(applySheetParts([effect('a', 'style', 'Font', 'Hero')], noStyle), noStyle), null);
  assert.equal(partsBuyHref('/x?from=maker', ['style', 'motion']), '/x?from=maker&buy=style,motion');
  assert.equal(partsBuyHref('/x', 'full'), '/x?buy=full');
});

/* ── (C) THE DOORS ──────────────────────────────────────────────────────── */

test('(C) the Apply sheet carries no "Go to ↗" — the row itself is the press', () => {
  const sheet = code('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.doesNotMatch(sheet, /ArrowUpRight|>\s*Go to\s*</, 'a go-edit-elsewhere link came back (owner 2026-10-22)');
  assert.match(sheet, /onClick=\{\(\) => onGo\(e\)\}/, 'the effect row no longer takes the couple to it');
  assert.doesNotMatch(sheet, /₱\s?\d/, 'a price is typed into the sheet');
});

test('(C) renaming asks for the Custom address part before anything is written', () => {
  const action = code('app/dashboard/[eventId]/invitation/actions.ts');
  const body = action.slice(action.indexOf('export async function updateEventSlug'), action.indexOf('\nexport async function', action.indexOf('export async function updateEventSlug') + 10));
  const gate = body.indexOf("eventHubPartActive(admin, eventId, 'address')");
  const write = body.indexOf('renameEventSlug(');
  assert.ok(gate > 0, 'updateEventSlug no longer asks for the Custom address part');
  assert.ok(write > gate, 'the rename is written before the part is asked');
  const rename = code('lib/event-slug-rename.server.ts');
  assert.match(rename, /findSlugConflict\(admin, requested, \{ eventId \}\)/, 'the one rename stopped checking the shared namespace');
  assert.match(rename, /from\('slug_change_log'\)\.insert\(/, 'the old link stopped forwarding');
});

test('(C) the Maker’s Apply puts a drafted address live through the ONE rename — never the events update', () => {
  const action = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /if \(item\.kind === 'address'\) \{\s*const renamed = await renameEventSlug\(/);
  assert.doesNotMatch(action, /eventsPatch\.slug|eventsPatch\['slug'\]/, 'the address reached the plain events update');
});

test('(C) the charge authority prices every Event Hub Pro key — parts, several parts, the rest', () => {
  const auth = code('lib/order-charge-authority.ts');
  assert.match(auth, /serviceKey === FULL_PRO_SKU \|\| serviceKey === HUB_PARTS_ORDER_KEY \|\| hubPartOfSku\(serviceKey\)/);
  assert.match(auth, /eventHubOwnership\(admin, eventId, 'owned'\)/, 'the charge must count an order under review — nobody pays twice');
  const checkout = code('app/dashboard/[eventId]/checkout/actions.ts');
  assert.match(checkout, /parseHubPartsField\(formData\.get\('hub_parts'\)\)/);
  assert.match(checkout, /from\('onboarding_order_items'\)\s*\.insert\(/, 'a parts order would provision nothing');
});

test('(C) no price is typed in the new surfaces', () => {
  for (const rel of [
    'app/dashboard/[eventId]/studio/website-pro/page.tsx',
    'app/dashboard/[eventId]/launch/_components/pro-quiet-line.tsx',
    'app/dashboard/[eventId]/invitation/_components/slug-field.tsx',
    'lib/apply-sheet-parts.ts',
  ]) {
    const src = code(rel).replace(/'[^'\n]*'|"[^"\n]*"/g, "''");
    assert.doesNotMatch(src, /₱\s?\d/, `${rel} types a peso figure`);
  }
});
