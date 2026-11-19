/**
 * 🔒 TODAY IS FOCUS-SHAPED (Today v3 part 1 — owner 19 Nov, looking at live Today: *"then why do i have a header when
 * this was not part of the design"* · *"remove the photo of that header"* · *"we do not want unwanted space on top"* ·
 * *"it was suppose to look like a search with ust a list of notifications"* · *"it was suppose to look like foucs"*;
 * DECISION_LOG 2026-11-19 "TODAY HAS NO HERO PHOTO" · "TODAY v3 — THREE MORE CALLS" · "TODAY v3 RULED AS A WHOLE").
 *
 *   1 · NO PHOTO, NO BAND: Today mounts no hero, reads no picture and draws no Upload pill; its top is the short mast.
 *   2 · THE LIST COMES FIRST: the mast, then Needs you today; the Next badge card, Next events and the numbers sit
 *       under the list, each still its own block.
 *   3 · ONE LIST: no Quick / "Opens a screen" groups — every task is one row template, drawn red, then amber, then the
 *       rest, with the fee bills beside their own level.
 *   4 · A TAP OPENS THE ROW IN PLACE AS A CARD: no row rises as a second screen; the open row wears the shared frame
 *       and ends with "Open in page ›".
 *   5 · ⏭ NOT IN THIS PART (each its own PR): drag right / drag left, "Do it tomorrow", the wrap-up card, admin Focus
 *       in place, and the three unset urgency windows. Nothing here may pretend to do them.
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-19): `<SupplierHero` put back in the cover (red: 1) · the
 *   top-only block moved back above the list (red: 2) · a "Quick ·" heading added (red: 3) · `<SupplierOpenRow rise`
 *   used for a task (red: 4) · a "Do it tomorrow" button added (red: 5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const COVER = read('today-cover.tsx');
const SCREEN = read('supplier-today-screen.tsx');
const FIRST = read('supplier-today-first-screen.tsx');
const V2 = read('today-v2.tsx');
const ROW = read('today-v2-client.tsx');
const PAGE = read('../page.tsx');

test('1 · no photo and no band: the top is the short mast', () => {
  for (const [name, src] of [['today-cover.tsx', COVER], ['supplier-today-screen.tsx', SCREEN], ['page.tsx', PAGE]] as const) {
    assert.doesNotMatch(src, /<SupplierHero\b|supplier-hero'|HERO_UPLOAD_PILL/, `${name} mounts or feeds a hero again`);
  }
  assert.doesNotMatch(PAGE, /heroPicture\(|mostViewedPhotoKey\(|\bheroP\b/, 'the page reads a picture for Today again');
  assert.doesNotMatch(COVER, /<img\b|Sample photo|Upload|min-h-\[208px\]|hc-ecard-plain/, 'the mast draws a photo, an Upload door, a fixed height or a band');
  assert.match(COVER, /data-today-mast=""/);
  assert.match(COVER, /data-today-greeting=""[\s\S]*data-today-greeted=""[\s\S]*data-today-date-chip=""/, 'the mast lost its greeting, shop or date');
  assert.match(SCREEN, /gear=\{setup \? null : <TodaySettings \/>\}/, 'the ⚙ is not the one mount on the mast (or still wears the cover look)');
});

test('2 · the list comes first; the Next badge card, Next events and the numbers sit under it', () => {
  const cover = FIRST.indexOf('{setup ? null : cover}');
  const needs = FIRST.indexOf('data-today-needs=""');
  const top = FIRST.indexOf('<div data-today-top-only="">');
  const grow = FIRST.indexOf('{grow}');
  assert.ok(cover > 0 && needs > 0 && top > 0 && grow > 0, 'anti-vacuity: a part of the first screen was not found');
  assert.ok(cover < needs, 'the list is drawn above the mast');
  assert.ok(needs < top, 'Next badge · Next events · the numbers are above the list again — the first task is pushed down');
  assert.ok(top < grow, 'the three blocks lost their place under the list');
  assert.match(FIRST.slice(top, top + 160), /\{nextBadge\}\s*\{nextEvents\}\s*\{stats\}/, 'one of the three blocks was dropped — they move, they are not removed');
});

test('3 · one list, most urgent first — no Quick or "Opens a screen" groups', () => {
  assert.doesNotMatch(V2, />\s*Quick ·|Opens a screen ·|data-today-opens-a-screen|data-today-quick=""/, 'a group heading is back');
  assert.match(V2, /data-today-one-list=""/);
  const list = V2.slice(V2.indexOf('data-today-one-list=""'));
  const at = (re: RegExp) => list.search(re);
  const red = at(/r\.urgency\?\.level === 'red'/);
  const amber = at(/r\.urgency\?\.level === 'amber'/);
  const rest = at(/!r\.urgency\)/);
  assert.ok(red > 0 && amber > red && rest > amber, 'the list is not drawn red, then amber, then the rest');
  assert.match(list, /billsLevel === 'red' \? billsBlock : null\}[\s\S]*billsLevel !== 'red' \? billsBlock : null\}/, 'the fee bills do not sit beside their own level');
  assert.equal((V2.match(/<TodayQuickGroup\b/g) ?? []).length, 1, 'more than one group — two rows could be open at once');
});

test('4 · a tap opens the row in place as a card; no task rises as a second screen', () => {
  assert.doesNotMatch(V2, /<SupplierOpenRow\b|\brise\b/, 'a task rises as a screen again');
  assert.match(V2, /r\.mode === 'quick' \? <QuickBody card=\{r\.card\} a=\{a\} \/> : <ScreenBody card=\{r\.card\}/, 'a kind lost its shipped answer inside the card');
  assert.match(V2, /foot=\{<CardFoot href=\{nextHref\(r\.target\)\} \/>\}/, 'the open card has no "Open in page ›"');
  assert.match(V2, /Open in page ›/);
  assert.match(ROW, /open\s*\?\s*'[^']*bg-frame[^']*shadow-sn-frame'/, 'the open row does not wear the shared frame');
  assert.match(ROW, /data-today-urgency=\{urgency \?\? undefined\}/);
  assert.match(V2, /line=\{r\.urgency \? `\$\{r\.urgency\.word\} · \$\{r\.line\}` : r\.line\}/, 'a level is shown by colour alone — it must wear its word');
});

test('5 · the later parts are not pretended: no drag, no "Do it tomorrow", no wrap-up here', () => {
  assert.doesNotMatch(V2 + ROW + FIRST, /Do it tomorrow|data-today-swipe|onPointerMove|Tomorrow\b/, 'a later part was half-built into part 1');
});
