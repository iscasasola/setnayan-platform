/**
 * GUARD — the supplier sign-up's v17 → v21 deltas (owner 2026-11-07; the contract is the specs repo's
 * `prototypes/open_shop_redesign_2026-11-06/` at v21). Built ONTO the shipped `/open-shop` — every assertion below
 * is about a shipped screen that changed, never a new one.
 *
 * What is EXECUTED: `eventsTheyCanServe` (which event types a set of services can serve). What is READ: the wiring a
 * refactor could quietly undo — the row swipe + Undo, the buttons by meaning, the plan's two columns, the quiet
 * password rule, Email hiding Google/Apple, the motion classes and their reduced-motion off switch, the no-photo tile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { eventsTheyCanServe } from './_components/services-at-events';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const WIZARD = read('app/open-shop/_components/open-shop-wizard.tsx');
const CARDS = read('app/open-shop/_components/service-cards.tsx');
const PICKER = read('app/open-shop/_components/service-picker.tsx');
const AT_EVENTS = read('app/open-shop/_components/services-at-events.tsx');
const SHEET = read('app/open-shop/_components/plan-sheet.tsx');
const PW = read('app/_components/password-field.tsx');
const CSS = readFileSync(join(WEB, 'app/globals.css'), 'utf8');

/* ── ① v18 · a service row is removed by the swipe, with Undo; no visible Remove on the row ─────────────────────── */

test('v18 ① · every picked-service row sits in the shipped SwipeToDelete; removing it pushes an Undo', () => {
  assert.match(CARDS, /import \{ SwipeToDelete \} from '@\/app\/_components\/swipe-to-delete'/);
  assert.match(CARDS, /<SwipeToDelete\b[\s\S]{0,300}word="Remove"[\s\S]{0,120}onDelete=\{\(\) => onRemove\(s\.key\)\}/);
  // A one-service card's header IS the row that swipes; a multi-service card swipes each service row.
  assert.match(CARDS, /\{swipe\(services\[0\]!, header\)\}/);
  assert.match(CARDS, /services\.map\(\(s\) =>\s*swipe\(/);
  // The wizard's remove keeps a snapshot and gives it back from the house Undo toast.
  const rm = WIZARD.slice(WIZARD.indexOf('const removeService'), WIZARD.indexOf('const removeService') + 2600);
  assert.match(rm, /pushUndo\(\{/);
  assert.match(rm, /label: `\$\{[^}]+\} removed`/);
  assert.match(WIZARD, /<UndoToastHost \/>/);
  assert.match(WIZARD, /onRemove=\{removeService\}/);
  // The v16 "Change / Remove" text links beside each row are gone.
  assert.doesNotMatch(CARDS, />\s*Change\s*<\/button>|>\s*Remove\s*<\/button>/);
});

test('v18 ① · Remove also sits inside the opened specialties — red, in one fit row with ⌃ and ✓ Done', () => {
  const bar = CARDS.slice(CARDS.indexOf('function SpecialtiesBar'));
  assert.match(bar, /useFitRow\(/);
  assert.match(bar, /tone="neutral" icon=\{ChevronUp\}/);
  assert.match(bar, /tone="danger" icon=\{Trash2\} label="Remove"/);
  assert.match(bar, /tone="ok" icon=\{Check\} label="Done"/);
});

/* ── ② v18 · BUTTON_RULE: every action is an ActionButton by meaning — no text-link actions ─────────────────────── */

test('v18 ② · no text-link actions left on the step-2 surfaces — grey pills for Cancel / back / open, by ActionButton', () => {
  for (const [name, src] of [['CARDS', CARDS], ['PICKER', PICKER], ['WIZARD', WIZARD]] as const) {
    assert.doesNotMatch(src, /className="[^"]*\btext-terracotta\b[^"]*"[^>]*>\s*(Select all|Clear|Cancel|Search all services|All categories|Change|Remove)\b/, `${name} draws a text-link action`);
  }
  assert.match(CARDS, /<ActionButton tone="neutral" icon=\{X\} label="Cancel"/);
  assert.match(PICKER, /<ActionButton tone="neutral" icon=\{ArrowLeft\} label="All categories"/);
  assert.match(PICKER, /<ActionButton\s+tone="neutral"\s+icon=\{Search\}\s+label="Search all services"/);
  assert.match(WIZARD, /tone="neutral"\s+icon=\{CheckCheck\}\s+label="Select all"/);
  assert.match(WIZARD, /tone="neutral"\s+icon=\{Eraser\}\s+label="Clear"/);
  // The grey back pill, its words a prop since the claim door's plan slide reuses the body (A6) — the sign-up's own by default.
  assert.match(SHEET, /<ActionButton tone="neutral" icon=\{ArrowLeft\} label=\{backLabel\}/);
  assert.match(SHEET, /backLabel = 'Back to my services'/);
});

/* ── ③ v19 · "Events you serve" shows only the events their services are offered for ───────────────────────────── */

test('v19 ③ · eventsTheyCanServe — nothing picked → every event; else only where some service is offered', () => {
  const events: Parameters<typeof eventsTheyCanServe>[0] = [
    { key: 'wedding', label: 'Wedding', emoji: '' },
    { key: 'birthday', label: 'Birthday', emoji: '' },
    { key: 'corporate', label: 'Corporate', emoji: '' },
  ];
  const allowed: Record<string, string[] | null> = { cake: ['wedding', 'birthday'], gown: ['wedding'], any: null };
  const of = (k: string) => allowed[k] ?? null;
  assert.deepEqual(eventsTheyCanServe(events, [], of).map((e) => e.key), ['wedding', 'birthday', 'corporate']);
  assert.deepEqual(eventsTheyCanServe(events, [{ key: 'gown', label: 'Gown' }], of).map((e) => e.key), ['wedding']);
  assert.deepEqual(
    eventsTheyCanServe(events, [{ key: 'gown', label: 'Gown' }, { key: 'cake', label: 'Cake' }], of).map((e) => e.key),
    ['wedding', 'birthday'],
  );
  // No allowed set = offered everywhere (the coverage editor's rule).
  assert.equal(eventsTheyCanServe(events, [{ key: 'any', label: 'Any' }], of).length, 3);
});

test('v19 ③ · the tiles, the count, "at least one event" and the glance all read the SHOWN events', () => {
  assert.match(WIZARD, /const shownEvents = eventsTheyCanServe\(eventTypeOptions, picked, allowedOf\);/);
  assert.match(WIZARD, /<EventTiles\s+options=\{shownEvents\}/);
  assert.match(WIZARD, /activeEvents\.length === 0/);
  assert.match(WIZARD, /`\$\{formatCount\(activeEvents\.length\)\} of \$\{formatCount\(shownEvents\.length\)\}`/);
  assert.doesNotMatch(AT_EVENTS, /aria-disabled|isn’t offered|isn't offered/);
});

/* ── ④ v19 · the plan explainer: their own picks in two columns, caps from TIER_CAPS, first booking free ─────────── */

test('v19 ④ · two columns — what stays Free (the main) and the plan that holds the rest — no price typed', () => {
  assert.match(SHEET, /data-open-shop-plan-split=""/);
  assert.match(SHEET, /data-open-shop-plan-free=""[\s\S]{0,400}\{split\.free\.name\}[\s\S]{0,300}\{main\}/);
  assert.match(SHEET, /data-open-shop-plan-held=""[\s\S]{0,300}\{split\.held\.name\}[\s\S]{0,300}rest\.map\(/);
  assert.match(SHEET, /Your first booking is free, so you can experience Setnayan\./);
  assert.match(WIZARD, /split: planSplit\(/);
  assert.doesNotMatch(SHEET, /₱|PHP\s*\d|\b\d+ (categories|per category|services?)\b/, 'a price or a cap is typed into the sheet');
});

/* ── ⑤ v19 · password: one rule line once typed; the leak check speaks only on failure; name/email only warns ──── */

test('v19 ⑤ · the quiet field draws ONE rule line, only when the box is not empty, and never blocks on name/email', () => {
  assert.match(PW, /\{tracks && quiet \? \([\s\S]{0,200}\{typed \? <QuietRule\b/);
  const rule = PW.slice(PW.indexOf('function QuietRule'));
  assert.match(rule, /At least 8 characters/);
  assert.match(rule, /rules\.length === 'ok'/);
  // The name/email line is a warning (warn ink), drawn only on failure; the leak line is never drawn here.
  assert.match(rule, /rules\.personal === 'fail' \?[\s\S]{0,200}--color-warn/);
  assert.doesNotMatch(rule, /leak/i);
  assert.match(WIZARD, /<PasswordField\s+id="open-shop-password"\s+mode="new"\s+quiet\b/);
});

/* ── ⑥ v19 · choosing Email hides Google / Apple; one grey "✕ Use another way" brings them back ─────────────────── */

test('v19 ⑥ · Email hides the other ways; "Use another way" is a grey pill that brings them back', () => {
  assert.match(WIZARD, /<ActionButton\s+tone="neutral"\s+icon=\{X\}\s+label="Use another way"\s+onClick=\{\(\) => setAcctEmail\(false\)\}/);
  assert.match(WIZARD, /\{waysShown && !taken && !acctEmail \? \(/);
});

/* ── ⑦ v19 · motion — slides on a step change, cards rise once, numbers count, bars grow; reduced motion off ───── */

test('v19 ⑦ · the motion classes exist, are CSS animations, and reduced motion turns them off', () => {
  for (const k of ['os-in-r', 'os-in-l', 'os-rise']) {
    assert.match(CSS, new RegExp(`@keyframes ${k} \\{`));
    assert.match(CSS, new RegExp(`\\.${k} \\{\\s*animation: ${k} `));
  }
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.os-in-r,\s*\.os-in-l,\s*\.os-rise \{\s*animation: none;/);
  // The slide is chosen by the move and is empty until the first one (no slide on load).
  assert.match(WIZARD, /const slide = dir === 'fwd' \? 'os-in-r' : dir === 'back' \? 'os-in-l' : '';/);
  assert.match(WIZARD, /useState<'fwd' \| 'back' \| null>\(null\)/);
  // A card rises only the first time it appears.
  assert.match(CARDS, /const rise = !seenCards\.current\.has\(id\);/);
  // Numbers count, bars grow — the house Count / Fill, keyed by id so a re-render never replays.
  assert.match(WIZARD, /<Fill\s+value=\{n <= step \? 100 : 0\}\s+id=\{`open-shop-seg-\$\{n\}`\}/);
  assert.match(CARDS, /<Count value=\{line\.categories\} id="open-shop-cov-c" \/>/);
});

/* ── ⑨ v19 · a category tile with no photo: wash + line, name in ink, ONE lucide icon in gold ─────────────────── */

test('v19 ⑨ · a no-photo category tile is the wash + line + gold tileIcon — no brown gradient, no emoji', () => {
  const tiles = PICKER.slice(PICKER.indexOf('function CategoryTiles'));
  assert.match(tiles, /const Icon = tileIcon\(b\.tileId\);/);
  assert.match(tiles, /background: 'var\(--m-paper-2\)', boxShadow: 'inset 0 0 0 1px var\(--m-line\)'/);
  assert.match(tiles, /color: 'rgb\(var\(--color-terracotta\)\)'/);
  assert.match(tiles, /\{ color: 'var\(--m-ink\)' \}/);
  assert.doesNotMatch(tiles, /linear-gradient\(135deg, var\(--m-orange-deep\), var\(--m-ink\)\)/, 'the brown gradient is back');
  assert.doesNotMatch(tiles, /\p{Extended_Pictographic}/u, 'an emoji is drawn on a tile');
  // The service cards' thumb follows the same rule.
  assert.match(CARDS, /tileIcon\(id\)/);
});
