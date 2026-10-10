/**
 * ONE INQUIRY COVERS EVERY CATEGORY THE COUPLE TICKS.
 *
 * Owner, 2026-10-10: "when they inquire, we also show what other categories
 * they offer. so when they inquire, they will inquire for all the categories
 * they want to know. it will be counted as 1 inquiry."
 *
 * The data already did it: `chat_threads UNIQUE (event_id, vendor_profile_id)`
 * IS the one inquiry, `thread_service_interests` holds each category asked, and
 * `startServiceInquiry` takes `alsoServiceIds`. The gap was the supplier sheet:
 * every "Ask about X" was its own press, and `contactShortlistVendor` sent
 * `alsoServiceIds: []` — so asking a saved supplier about Cake opened the chat
 * and recorded nothing about Cake at all.
 *
 * What this file holds:
 *   1. the ticks resolve to cards (pure, run for real);
 *   2. N ticks are ONE call: one `contactShortlistVendor` from the sheet, one
 *      `startServiceInquiry` behind it, carrying every card;
 *   3. a conversation that ALREADY exists gains the new categories on the SAME
 *      thread (`recordThreadInterests`, run for real against a stand-in client).
 *
 * ⚠ (2) is read from the source, per call and counted — the action is a server
 * action over a signed-in session and cannot be run here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { serviceIdsForTickedTiles, sheetOtherForCategory, type AskCard } from './supplier-sheet-ask';
import { sheetOthers } from './supplier-sheet';
import { recordThreadInterests, type InterestSeed } from './thread-interests';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

// ── 1 · the ticks resolve to cards ────────────────────────────────────────
const card = (id: string, category: string | null, created: string): AskCard => ({
  vendor_service_id: id,
  category,
  created_at: created,
});
const CARDS: AskCard[] = [
  card('svc-catering', 'catering', '2026-01-01T00:00:00Z'),
  card('svc-cake-late', 'wedding_cake', '2026-03-01T00:00:00Z'),
  card('svc-cake-first', 'wedding_cake', '2026-02-01T00:00:00Z'),
  card('svc-unfiled', 'no-such-service', '2026-01-15T00:00:00Z'),
  card('svc-none', null, '2026-01-16T00:00:00Z'),
];

test('a card\'s category names the Suppliers-page row it sits under — or nothing, never a guess', () => {
  assert.deepEqual(sheetOtherForCategory('wedding_cake'), { tile: 'cake', label: 'Cake' });
  assert.deepEqual(sheetOtherForCategory('catering'), { tile: 'catering', label: 'Catering' });
  // A card that stores the row's own id (Saysay's Host / MC card does).
  assert.equal(sheetOtherForCategory('cake')?.tile, 'cake');
  assert.equal(sheetOtherForCategory('no-such-service'), null);
});

test('🔑 N ticked categories → N cards, the earliest active card of each, in the order ticked', () => {
  const out = serviceIdsForTickedTiles(CARDS, ['cake'], 'svc-catering');
  assert.deepEqual(out, { serviceIds: ['svc-cake-first'], unresolved: [] });

  const more: AskCard[] = [...CARDS, card('svc-host', 'host_mc', '2026-04-01T00:00:00Z')];
  const two = serviceIdsForTickedTiles(more, ['host_mc', 'cake'], 'svc-catering');
  assert.deepEqual(two.serviceIds, ['svc-host', 'svc-cake-first']);
  assert.deepEqual(two.unresolved, []);
});

test('a category ticked twice is asked once; the anchor\'s own category adds nothing; nothing ticked adds nothing', () => {
  assert.deepEqual(serviceIdsForTickedTiles(CARDS, ['cake', ' cake ', 'cake'], 'svc-catering').serviceIds, ['svc-cake-first']);
  assert.deepEqual(serviceIdsForTickedTiles(CARDS, ['catering'], 'svc-catering'), { serviceIds: [], unresolved: [] });
  assert.deepEqual(serviceIdsForTickedTiles(CARDS, [], 'svc-catering'), { serviceIds: [], unresolved: [] });
  assert.deepEqual(serviceIdsForTickedTiles(CARDS, ['', '   '], 'svc-catering'), { serviceIds: [], unresolved: [] });
});

test('🔑 a ticked category with no live card any more is REPORTED, never quietly left out', () => {
  const out = serviceIdsForTickedTiles(CARDS, ['cake', 'photography'], 'svc-catering');
  assert.deepEqual(out.unresolved, ['photography']);
  // …and the action refuses to send a partial inquiry, in words that already ship.
  const action = read('app/dashboard/[eventId]/vendors/_actions/contact-shortlist-vendor.ts');
  assert.match(
    action,
    /if \(also\.unresolved\.length > 0\) \{\s*return \{ status: 'error', message: 'That service is no longer available\.' \};\s*\}/,
  );
  assert.ok(
    action.indexOf('also.unresolved.length > 0') < action.lastIndexOf('return startServiceInquiry({'),
    'the refusal comes after the inquiry is already sent',
  );
  assert.match(read('app/v/[slug]/inquiry-actions.ts'), /message: 'That service is no longer available\.'/, 'the sentence is no longer a shipped one');
});

test('every row the sheet offers to tick has a card behind it — the list and the resolver read one map', () => {
  const others = sheetOthers(CARDS.map((c) => c.category), 'catering', sheetOtherForCategory);
  assert.deepEqual(others, [{ tile: 'cake', label: 'Cake' }]);
  const resolved = serviceIdsForTickedTiles(CARDS, others.map((o) => o.tile), 'svc-catering');
  assert.deepEqual(resolved.unresolved, [], 'the sheet offered a category the inquiry cannot carry');
  assert.equal(resolved.serviceIds.length, others.length);
  // The sheet's read uses THIS resolver, not a copy of it.
  const reader = read('lib/supplier-sheet-read.ts');
  assert.match(reader, /sheetOthers\(\s*services\.map\(\(s\) => s\.category\),\s*input\.tile,\s*sheetOtherForCategory,?\s*\)/);
});

// ── 2 · N ticks are ONE call ──────────────────────────────────────────────
/** The body of `export async function <name>(` up to the next top-level export. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} moved`);
  const next = src.indexOf('\nexport async function ', start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}

test('🔑 the action sends every ticked category in ONE startServiceInquiry call', () => {
  const action = read('app/dashboard/[eventId]/vendors/_actions/contact-shortlist-vendor.ts');
  const body = fnBody(action, 'contactShortlistVendor');
  assert.equal(count(body, /\bstartServiceInquiry\(/g), 1, 'contactShortlistVendor starts more than one inquiry');
  assert.doesNotMatch(body, /for \([^)]*\)\s*\{[^}]*startServiceInquiry\(/, 'an inquiry per category');
  const call = body.slice(body.indexOf('return startServiceInquiry({'));
  assert.match(call, /alsoServiceIds: also\.serviceIds,/, 'the ticked categories do not reach the inquiry');
  assert.match(
    body,
    /const also = serviceIdsForTickedTiles\(\s*resolved\.active,\s*Array\.isArray\(input\.alsoTiles\) \? input\.alsoTiles : \[\],\s*resolved\.vendorServiceId,\s*\);/,
  );
  // The cards come from the SAME read the anchor was resolved from.
  assert.equal(count(action, /\.from\('vendor_services'\)/g), 1, 'a second read of their cards');
  // No new exported action (the route ceiling) — the ticks ride the one that was there.
  assert.deepEqual(
    [...action.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]).sort(),
    ['contactShortlistVendor', 'contactVendorProfile'],
  );
});

test('the one inquiry is one thread: the upsert is keyed on (event, supplier), and interests are written whether or not the thread is new', () => {
  const inquiry = read('app/v/[slug]/inquiry-actions.ts');
  const body = fnBody(inquiry, 'startServiceInquiry');
  assert.match(body, /\{ onConflict: 'event_id,vendor_profile_id' \}/, 'a second thread for the same event and supplier');
  assert.equal(count(body, /\.from\('chat_threads'\)\s*\.upsert\(/g), 1);
  // Each ticked card becomes a `couple_added` seed…
  assert.match(
    body,
    /for \(const rawId of input\.alsoServiceIds\) \{[\s\S]{0,260}source: 'couple_added',[\s\S]{0,80}confirmedServiceIds\.push\(id\);/,
  );
  // …and the write is not inside the brand-new-thread branch or the first-message branch.
  const record = body.indexOf('await recordThreadInterests(supabase, {');
  assert.ok(record > 0, 'the interests write moved');
  const newOnly = body.indexOf('if (!isExisting) {');
  assert.ok(newOnly > 0 && newOnly < record);
  const before = body.slice(0, record);
  const depth = (s: string) => count(s, /\{/g) - count(s, /\}/g);
  assert.equal(depth(before), 1, 'the interests write sits inside a branch — an existing thread may skip it');
  // …nor behind a brace-less condition: it is a statement of the function itself.
  assert.match(body, /\n  await recordThreadInterests\(supabase, \{/, 'the interests write is conditional');
});

const SHEET = read('app/dashboard/[eventId]/vendors/_components/supplier-sheet.tsx');
const COMPOSER = read('app/v/[slug]/_components/inquiry-composer.tsx');

test('🔑 the sheet asks ONCE: one contactShortlistVendor call, carrying the ticks — no press per category', () => {
  assert.equal(count(SHEET, /\bcontactShortlistVendor\(/g), 1, 'the sheet has more than one way to ask');
  assert.match(SHEET, /const res = await contactShortlistVendor\(\{ eventId, vendorId: id, alsoTiles \}\);/);
  // The ticks are the rows still offered, and only the ticked ones.
  assert.match(
    SHEET,
    /const alsoTiles = \(data\?\.others \?\? \[\]\)\.map\(\(o\) => o\.tile\)\.filter\(\(t\) => ticked\.has\(t\) && !target\.onPage\[t\]\);/,
  );
  // No row has its own ask any more: the only thing that calls `inquire` is the one button.
  assert.equal(count(SHEET, /\binquire\(/g), 0, 'something calls inquire with its own arguments — a press per category is back');
  assert.equal(count(SHEET, /onClick=\{inquire\}/g), 1, 'the sheet has more or fewer than ONE ask button');
  assert.doesNotMatch(SHEET, /\slabel=\{askAboutLabel\(/, '"Ask about X" is a button again');
  // A tick is a tick: it sends nothing by itself.
  const toggle = SHEET.slice(SHEET.indexOf('const toggleTick = '), SHEET.indexOf('const ask = useCallback'));
  assert.ok(toggle.length > 0, 'toggleTick moved');
  assert.doesNotMatch(toggle, /contactShortlistVendor|saveVendorToPicks|start\(/);
});

test('the tick list is the shipped "Also ask about" block — its words and its checkbox, not a new control', () => {
  const legend = /<legend className="font-mono text-\[10px\] uppercase tracking-\[0\.18em\] text-ink\/50">\s*Also ask about\s*<\/legend>/;
  assert.match(COMPOSER, legend, 'the composer no longer says "Also ask about" — re-copy the block');
  assert.match(SHEET, legend);
  // THE TICK IS THE APP'S ACCENT. A native checkbox takes its fill from
  // `accent-color`, never from a text colour. The composer's box is classed
  // `text-terracotta focus:ring-terracotta` — a forms-plugin idiom — and this app
  // has no forms plugin, so that class paints nothing and its boxes tick browser
  // blue (seen in the sheet's own picture at 375 px, 2026-10-10). The sheet
  // wears the token the app's ticked boxes really wear: the RSVP's.
  const rsvp = read('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(rsvp, /type="checkbox"[\s\S]{0,400}className="[^"]*\baccent-terracotta\b[^"]*"/, 'the RSVP tick changed its token — re-copy it');
  assert.match(SHEET, /type="checkbox"[\s\S]{0,900}className="h-4 w-4 shrink-0 accent-terracotta"/, 'the sheet’s tick is not the app’s accent');
  assert.doesNotMatch(read('tailwind.config.ts'), /tailwindcss\/forms/, 'a forms plugin arrived — the composer’s class paints now; re-read this test');
  assert.doesNotMatch(SHEET, /text-terracotta(?!-)/, 'bare gold as a text class is back on the sheet');
  for (const state of ["'border-terracotta/50 bg-terracotta/5 text-ink'", "'border-ink/10 bg-cream/80 text-ink/80 hover:border-terracotta/40'"]) {
    assert.ok(COMPOSER.includes(state) && SHEET.includes(state), `the ticked / unticked look drifted: ${state}`);
  }
  assert.match(SHEET, /type="checkbox"\s*checked=\{on\}\s*onChange=\{\(\) => toggleTick\(o\.tile\)\}/);
  // Every checkbox has a name a screen reader can say, in words that already ship.
  assert.match(SHEET, /aria-label=\{askAboutLabel\(o\.label\)\}/);
  // No pill row, and no new sentence: the row keeps the sheet's own words.
  assert.match(SHEET, /can be in the same quote/);
  assert.doesNotMatch(SHEET, /rounded-full[^"]*"[^>]*onClick=\{\(\) => toggleTick/);
});

test('frames only on what you press: each tick is framed; the heading and the helper line are not; the topic starts at a divider', () => {
  // Owner, 2026-10-11: "only have frames if something needs to be clicked like
  // a button, separate topics with divider."
  const also = SHEET.slice(SHEET.indexOf('data-sheet-also=""'), SHEET.indexOf('</fieldset>'));
  assert.ok(also.length > 0, 'the tick list moved');
  // The frame (rounded + border) is on the tick's own label, and nowhere else in the list.
  assert.match(SHEET, /const TICK_ROW = '[^']*\brounded-lg border\b[^']*';/);
  assert.equal(count(also, /\$\{TICK_ROW\}/g), 1, 'the frame is not on the tick row');
  assert.equal(count(also, /\brounded\b|\brounded-/g), 0, 'something that is only read got a box');
  // Inside the frame: the checkbox and the category's name. Nothing that is only read.
  const label = also.slice(also.indexOf('<label'), also.indexOf('</label>'));
  assert.doesNotMatch(label, /can be in the same quote/, 'the helper line is inside the frame');
  assert.equal(count(label, /<span /g), 1, 'the framed row carries more than the name');
  // The helper line is said once, on the sheet, before the ticks.
  assert.equal(count(SHEET, /can be in the same quote/g), 1);
  assert.ok(also.indexOf('data-sheet-also-help') > 0 && also.indexOf('data-sheet-also-help') < also.indexOf('<ul'));
  // The topic starts at a divider.
  assert.match(SHEET, /<section className="border-t border-ink\/10 pt-4" data-sheet-section="others">/);
});

test('🔑 with a conversation already open, ticking a category turns "Open chat" into the ask — the ticks are never stranded', () => {
  // No ticks: exactly what it was. Any tick: the ask button, thread or not, booked or not.
  assert.match(SHEET, /\{tickedCount === 0 && target\.threadId \? \(\s*<ActionButton tone=\{chat\.tone\} icon=\{MessageCircle\} label="Open chat"/);
  assert.match(SHEET, /\) : tickedCount === 0 && target\.booked \? null : \(\s*<ActionButton\s*tone=\{quote\.tone\}/);
  // …and it is the row's MAIN verb (the button rule: the main verb is filled,
  // the rest outlined) — exactly one filled button in the sheet's row.
  const row = SHEET.slice(SHEET.indexOf('<SheetCtaRow>'), SHEET.indexOf('</SheetCtaRow>'));
  assert.equal(count(row, /^\s*main$/gm), 1, 'the sheet’s row has no main verb, or more than one');
  assert.match(row, /tone=\{quote\.tone\}\s*main\s*icon=\{MessageCircle\}\s*label=\{busy \? 'Asking…' : quote\.label\}\s*disabled=\{busy\}\s*onClick=\{inquire\}/);
  assert.match(SHEET, /const tickedCount = tickable\.filter\(\(o\) => ticked\.has\(o\.tile\)\)\.length;/);
  // A category the couple already has them under is said, not offered again.
  assert.match(SHEET, /const tickable = \(data\?\.others \?\? \[\]\)\.filter\(\(o\) => !target\.onPage\[o\.tile\]\);/);
});

test('🪤 the sheet\'s button row is fitted by the component that draws it', () => {
  // The sheet returns null until <body> is known; a fit pass called up there
  // measured a row that did not exist and never ran again (measured at 375 px:
  // 343 px of buttons in a 333 px row). Same trap as find-thumb-row.
  const outer = SHEET.slice(SHEET.indexOf('export default function SupplierSheet('));
  assert.doesNotMatch(outer, /useFitRow\(/, 'the fit pass is called where the row does not exist yet');
  assert.match(SHEET, /function SheetCtaRow\([^)]*\) \{\s*const rowRef = useRef<HTMLDivElement>\(null\);\s*useFitRow\(rowRef\);\s*return \(\s*<div ref=\{rowRef\}/);
  assert.equal(count(SHEET, /useFitRow\(rowRef\)/g), 1);
  assert.equal(count(SHEET, /<SheetCtaRow>/g), 1);
});

// ── 3 · an existing conversation gains the categories on the SAME thread ───
type Row = Record<string, unknown>;
function standIn(existing: Row[]) {
  const upserts: { rows: Row[]; opts: unknown }[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, 'thread_service_interests');
      return {
        select() {
          return {
            eq(_col: string, threadId: string) {
              return {
                order: async () => ({ data: existing.filter((r) => r.thread_id === threadId), error: null }),
              };
            },
          };
        },
        upsert: async (rows: Row[], opts: unknown) => {
          upserts.push({ rows, opts });
          return { error: null };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, upserts };
}

test('🔑 ticking more categories on a conversation that already exists adds them to THAT thread — nothing new, nothing twice', async () => {
  const already: Row[] = [
    { interest_id: 'i1', thread_id: 't-1', vendor_service_id: 'svc-catering', category_key: 'catering', source: 'initial', status: 'asked', added_by_role: 'couple', created_at: '2026-10-01T00:00:00Z' },
  ];
  const { client, upserts } = standIn(already);
  // What startServiceInquiry builds on a resumed thread: the anchor again, then the ticks.
  const seeds: InterestSeed[] = [
    { vendorServiceId: 'svc-catering', categoryKey: 'catering', source: 'initial' },
    { vendorServiceId: 'svc-cake-first', categoryKey: 'wedding_cake', source: 'couple_added' },
    { vendorServiceId: 'svc-host', categoryKey: 'host_mc', source: 'couple_added' },
  ];
  await recordThreadInterests(client, { threadId: 't-1', addedByRole: 'couple', seeds });

  assert.equal(upserts.length, 1, 'one write');
  const { rows, opts } = upserts[0]!;
  assert.deepEqual(rows.map((r) => r.vendor_service_id), ['svc-cake-first', 'svc-host'], 'the anchor is not written twice');
  assert.deepEqual([...new Set(rows.map((r) => r.thread_id))], ['t-1'], 'a category landed on another thread');
  assert.deepEqual(rows.map((r) => r.source), ['couple_added', 'couple_added']);
  assert.deepEqual(opts, { onConflict: 'thread_id,vendor_service_id', ignoreDuplicates: true });

  // Pressing again with the same ticks writes nothing at all.
  const again = standIn([
    ...already,
    ...rows.map((r, i) => ({ ...r, interest_id: `n${i}`, status: 'asked', created_at: '2026-10-10T00:00:00Z' })),
  ]);
  await recordThreadInterests(again.client, { threadId: 't-1', addedByRole: 'couple', seeds });
  assert.equal(again.upserts.length, 0, 'the same ticks were recorded a second time');
});
