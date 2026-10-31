/**
 * build-body.test.ts — the BUILD body of the couple's Suppliers page draws what
 * the approved prototype draws, with the shipped pieces, through the shipped
 * writes (Suppliers PR3; `prototypes/suppliers_page_2026-10-07_fable.html`).
 *
 * A source guard: it reads the component, never a DOM. Each assertion names a
 * PROPERTY the owner approved (a word, a door, a rule) — the look itself is
 * held by the side-by-sides taken in `/dev/suppliers-lab?tab=build`.
 *
 * 2026-10-31 — the words are the APPROVED FINAL frames' now (`carry-2026-10-29/suppliers-final-proto/`, frames 12 ·
 * 12b · 13 · 14; owner 2026-10-30 "that is the last rule for the suppliers"): This build ▾ · ＋ New build · the
 * budget line + meter · Compare builds (a sheet on a phone, All builds from 1024). The shape itself is held by
 * `lib/the-build-is-the-approved-frame.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const BODY = read('_components/build-body.tsx');
const SHELL = read('_components/services-takeover.tsx');
const PAGE = read('page.tsx');
const ACTION = read('build-actions.ts');

/** The words the prototype prints in Build mode — fixed, no synonyms. */
const WORDS = [
  "'This build'",
  ' · edited',
  'label="New build"',
  'Pick one',
  'Nobody shortlisted with a price yet',
  '`Find in ${line.label}`',
  'label="Set price"',
  ' budget ·',
  ' buffer',
  ' over',
  'buffer not knowable',
  '· no budget set yet',
  'booked <Count',
  'if you book these <Count',
  "row('Booked'",
  "row('If you book these'",
  "row('Budget'",
  "row('Buffer'",
  "'Not knowable'",
  'priced picks are free on',
  'Pick suppliers to check your date',
  "'Help me choose'",
  "'Set the date'",
  "'All builds'",
  "'Compare builds'",
  'Side by side, with the dates each one is free on.',
  'Save this build to compare it with another.',
  'builds · the dates each is free on',
  '`Compare ${formatCount(view.cards.length)} builds`',
  ' at a time on a phone · green = lowest total',
  'Hide what’s the same',
  'Total',
  'Budget left',
  'Free on',
  ' · now',
  ' · booked',
  'without a price',
  'Free: ',
  'No shared free date',
  'label="Use this build"',
  'label="Rename"',
  'label="Delete this build"',
  'label="Done"',
  'label="Saved"',
  'label="Save"',
  'label="Save this build"',
  "'Save build'",
  "'Nothing changed'",
  "'Already saved'",
  'already has exactly these suppliers.',
  '— the same suppliers in every category. Nothing new to save.',
  "'Your current combination, kept to compare later.'",
  '(optional)',
  '`Updated "${target.name}"`',
  '`Using "${card.name}"`',
  '`Deleted "${card.name}"`',
  '— see Compare builds`',
];

test('the prototype’s words are the body’s words', () => {
  for (const w of WORDS) assert.ok(BODY.includes(w), `the Build body lost the words ${w}`);
});

test('a person reads "supplier" and "event" — never the retired words', () => {
  // Identifiers and import paths are not words a person reads.
  const said = BODY.replace(/^import [^;]*;$/gm, '').replace(/vendorId|vendorName|\/vendors\b|Vendor[A-Z]\w*|vendor_\w+/g, '');
  assert.doesNotMatch(said, /vendor/i, 'the body says "vendor" somewhere a person can read');
  assert.doesNotMatch(said, /celebration|website|\bsite\b/i);
});

test('every write is a shipped action, and nothing else writes', () => {
  assert.match(BODY, /import \{ deleteBudgetBuild, savePlanBuildNamed \} from '\.\.\/build-actions';/);
  assert.match(BODY, /import \{ applyBuildToWorking, removeBuildPick, setBuildPick \} from '\.\.\/build-pick-actions';/);
  assert.match(
    BODY,
    /const SHIPPED_WRITES: BuildWrites = \{\s*setPick: setBuildPick,\s*removePick: removeBuildPick,\s*save: savePlanBuildNamed,\s*remove: deleteBudgetBuild,\s*use: applyBuildToWorking,\s*\};/,
  );
  assert.doesNotMatch(BODY, /supabase|createClient|fetch\(/, 'the body reads or writes on its own');
  // The stand-in is the lab's only: absent, the real actions run.
  assert.match(BODY, /const writes = standIn \?\? SHIPPED_WRITES;/);
});

test('GOLDEN: a save posts the four fields it always posted', () => {
  const calls = [...BODY.matchAll(/writes\.save\(\{([^}]*)\}\)/g)].map((m) => m[1]!.split(',').map((f) => f.trim().split(':')[0]!.trim()).filter(Boolean));
  assert.ok(calls.length >= 5, 'Save, Save as new, Rename and the two undos all go through the one save');
  for (const fields of calls) assert.deepEqual(fields.sort(), ['eventId', 'overwriteBuildId', 'rawName', 'snapshot']);
  // Overwrite names its build; Save as new never does.
  assert.match(BODY, /overwriteBuildId: target\.id, snapshot: view\.snapshot/);
  assert.match(BODY, /rawName: typed \|\| null, overwriteBuildId: null, snapshot: view\.snapshot/);
});

test('KEPT REACHABLE: the shipped controls the prototype is silent about are still on the page', () => {
  // Rename — the shipped rename-by-overwrite: the same build, its own suppliers.
  assert.match(BODY, /label="Rename"/);
  assert.match(BODY, /rawName: typed \|\| null, overwriteBuildId: target\.id, snapshot: own/);
  // What a price comes with — folded on the build's card.
  assert.match(BODY, /data-build-inclusions=""/);
  // "Fill your build from your quotes" and "Clear candidates" — mounted by the page.
  assert.match(BODY, /\{extrasSlot \? \(/);
  assert.match(PAGE, /<QuoteFillRow eventId=\{eventId\} fillable=\{quoteFillable\} budgetPhp=\{buildBudgetPhp\} \/>/);
  assert.match(PAGE, /<TeamClearCandidates eventId=\{eventId\} \/>/);
});

test('a Use never re-opens a booked category, and can be undone', () => {
  assert.match(BODY, /writes\.use\(\{ eventId, picks: card\.apply, lockedPlanGroupIds: locked \}\)/);
  assert.match(BODY, /undo: \(\) =>\s*run\(\[\(\) => writes\.use\(\{ eventId, picks: before, lockedPlanGroupIds: locked \}\)\]/);
});

test('the save refuses a twin on the server too — the same compare the screen draws with', () => {
  assert.match(ACTION, /picks: input\.snapshot\.picks,/);
  assert.match(ACTION, /if \(plan\.mode === 'twin'\) return \{ ok: false, error: `Already saved — exactly “\$\{plan\.twinTitle\}”` \};/);
  assert.match(ACTION, /if \(plan\.mode === 'unchanged'\) return \{ ok: false, error: 'Nothing changed' \};/);
  // …and both refusals come BEFORE either write.
  const refuse = ACTION.indexOf("plan.mode === 'unchanged'");
  assert.ok(refuse > 0 && refuse < ACTION.indexOf(".update({", refuse - 1) && refuse < ACTION.indexOf('.insert({'));
});

test('a set of choices is ONE dropdown, and the buttons are the shipped button', () => {
  assert.match(BODY, /<PickMenu\s/);
  assert.doesNotMatch(BODY, /<select|<button/, 'a hand-made control — use PickMenu / ActionButton');
  assert.match(BODY, /import \{ ActionButton, useFitRow \} from '@\/components\/action-button';/);
  assert.match(BODY, /import \{ ScheduleSheet, SheetField, SheetFoot \} from '@\/app\/dashboard\/\[eventId\]\/schedule\/_components\/schedule-sheet';/);
  assert.match(BODY, /import \{ PeekToast \} from '@\/app\/_components\/toast\/peek-toast';/);
});

test('every number a person reads counts, and money is formatted by the one formatter', () => {
  assert.doesNotMatch(BODY, /toLocaleString|₱\$\{|₱\{/, 'a hand-formatted figure');
  assert.match(BODY, /<Count value=\{total\} format="peso"/);
  assert.match(BODY, /formatPhp\(c\.pricePhp\)/);
  // No price is written into the body: every figure comes from the view.
  assert.doesNotMatch(BODY, /\b\d{4,}\b/, 'a figure is written into the Build body');
});

test('the buffer refuses while a price is missing — never a number', () => {
  assert.match(BODY, /money\.unpriced > 0 \? \(\s*<span data-build-buffer="unknown">buffer not knowable<\/span>/);
  assert.match(BODY, /money\.unpriced > 0 \? 'Not knowable'/);
  assert.match(BODY, /c\.unpriced > 0 \? \(\s*'Not knowable'/);
});

test('the saved builds that could not be read are not called "none"', () => {
  const at = BODY.indexOf('!view.buildsMeasured ?');
  assert.ok(at > 0, 'the unreadable branch is gone');
  assert.ok(at < BODY.indexOf('Save this build to compare it with another.'), 'the "none yet" line is reachable without a measured read');
  assert.match(BODY, /We couldn’t load your saved builds\./);
});

test('the bar slides with the mode, and only in Build', () => {
  assert.match(BODY, /const wanted = mode === 'build' && !leaving;/);
  assert.match(BODY, /thumbUp\.current = true;/);
  assert.match(BODY, /data-build-bar=""/);
  assert.match(BODY, /createPortal\(/);
});

test('"Book this build" stays mounted, so its toast outlives the last pick it booked', () => {
  const BOOK = read('_components/book-this-build.tsx');
  assert.match(BODY, /bookSlot=\{bookSlot\}/);
  assert.doesNotMatch(BODY, /bar\.book \? bookSlot/, 'the bar unmounts the booking with its button — the toast is lost');
  // Always on the bar now (frame 12); with nothing to book it says so instead of disappearing.
  assert.match(BOOK, /<ActionButton tone="brand" main icon=\{CalendarCheck\} label="Book this build" onClick=\{press\}/);
  assert.match(BOOK, /if \(picks\.length === 0\) \{\s*setToast\(NOTHING_TO_BOOK\);/);
});

test('the shell draws the Build body whole, and keeps both anchors', () => {
  assert.match(SHELL, /\{buildBody \? \(\s*buildBody\s*\) : \(/);
  assert.match(BODY, /<section id="svc-build" /);
  assert.match(BODY, /<section id="svc-compare" /);
  // The page hands it over only on the one-screen page.
  assert.match(PAGE, /const onePage = isExploreReplanEnabled\(\);/);
  assert.match(PAGE, /buildBody=\{\s*buildView \? \(/);
  assert.match(PAGE, /const currentPlan: PlanBuildSnapshot = onePage\s*\? buildSnapshotOf\(buildLines, buildBudgetPhp\)/);
});
