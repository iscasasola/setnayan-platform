/**
 * the-days-program-is-the-hosts-call.test.ts — 🗓 WHAT GUESTS SEE OF THE DAY IS THE HOSTS' AND THE COORDINATOR'S CALL.
 *
 * Owner rulings: 2026-10-27 (DECISION_LOG "SUPPLIERS › BOOKED GAINS A SCHEDULE PART …": *"A guest-facing 'The day's
 * program' row joins Home's ONE 'What guests see' table — no second mechanism"*) · 2026-10-28 ("FIVE OWNER DECISIONS",
 * (3)): *"coordinator and couple only"* — only the coordinator and the couple may show a schedule item to guests;
 * suppliers cannot; payments and meetings never show · 2026-10-29: *"coordinator and host/s of the event"* — the shipped
 * `mayShowToGuests` (`schedule/actions.ts`), the one host check (`userHostsEvent`).
 *
 *   1 · THE ROW — the What-guests-see table has ONE row for the Schedule scene, named "The day's program", and its note
 *       says who decides and that payments and meetings never show. Never a second row for the same part.
 *   2 · EVERY WRITER — each file that writes `event_schedule_blocks` and can set `is_public` to anything but `false` is
 *       named here with the gate that makes it the hosts' call (or the owner-ruled template default). A NEW writer that
 *       can turn a moment on for guests fails this until it is gated and listed.
 *   3 · SUPPLIERS NEVER WRITE IT — no supplier page, action or hub file sets `is_public` on a schedule block.
 *   4 · PAYMENTS AND MEETINGS NEVER SHOW — they live in Planning Stage (`lib/preparation.ts`: line-item due dates,
 *       appointments, hand-added Payment / Meeting rows); no guest page reads any of those sources.
 *
 * ⚠ WHAT THIS CANNOT SEE: the database. `event_schedule_blocks_moderator_write` lets a delegate with schedule "edit"
 * write the row directly; the rule above is the app's. A database fence needs a migration (out of scope for this PR —
 * recorded in its "Where I stopped").
 *
 * Sabotage (2026-11-06, each seen red, then restored): the row's label back to 'Schedule' → 1 red · the note dropped →
 * 1 red · `mayShowToGuests` dropped from the add-a-moment insert → 2 red · a supplier action writing `is_public: true`
 * → 2 + 3 red · a guest page importing `fetchPreparationAgenda` → 4 red.
 *
 * Run: cd apps/web && node --import tsx --test lib/the-days-program-is-the-hosts-call.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
/* FIRST: the page renderer's seam (see `lib/stage-pages-fixture.ts`) — as `guests-see-table.test.ts` loads it. */
import { stageWidgets } from './stage-pages-fixture';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildGuestsSeeTable } from './guests-see-build';
import { GUESTS_SEE_WORDS } from './guests-see-table';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.fixture\.ts$/.test(name)) out.push(relative(WEB, abs));
  }
  return out;
}
const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))].filter((f) => !f.startsWith('app/dev/'));

test('1 · the table has ONE row for the day — "The day’s program" — and its note says who decides', () => {
  const t = buildGuestsSeeTable({ widgets: stageWidgets(), hasEntourage: true, giftsOff: false });
  const rows = t.groups.flatMap((g) => g.rows);
  const schedule = rows.filter((r) => r.scene === 'schedule');
  assert.equal(schedule.length, 1, 'the Schedule scene has more than one row (a second mechanism) — or none');
  const row = schedule[0]!;
  assert.equal(row.label, 'The day’s program');
  assert.equal(row.label, GUESTS_SEE_WORDS.programLabel);
  assert.equal(row.note, GUESTS_SEE_WORDS.programNote);
  assert.match(row.note ?? '', /you and your coordinator/i, 'the note no longer says who decides');
  assert.match(row.note ?? '', /Payments and meetings never show/, 'the note no longer says payments and meetings never show');
  assert.ok(!rows.some((r) => r.label === 'Schedule'), 'a row is still called "Schedule"');
  // House words: "event", never "celebration" or "website".
  assert.doesNotMatch(`${row.label} ${row.note}`, /celebration|website/i);
});

/**
 * Every schedule writer that can set `is_public` to something other than a literal `false`, and the gate that makes it
 * the hosts' call. Matched against the file's code (comments stripped).
 */
const GATED_WRITERS: Readonly<Record<string, readonly RegExp[]>> = {
  // The schedule page's own doors: add a moment, the eye, the edit sheet — `mayShowToGuests` (= `userHostsEvent`).
  'app/dashboard/[eventId]/schedule/actions.ts': [
    /is_public: formData\.get\('is_public'\) === 'on' && \(await mayShowToGuests\(supabase, user\.id, eventId\)\),/,
    /if \(desired && !\(await mayShowToGuests\(supabase, user\.id, eventId\)\)\) throw new Error\(ONLY_HOSTS_SHOW_GUESTS\);/,
    /if \(patch\.is_public === true && !\(await mayShowToGuests\(supabase, user\.id, eventId\)\)\)/,
    /return await userHostsEvent\(supabase, userId, eventId\);/,
  ],
  // The emcee's picks placed on the timeline — shown only when a host places them.
  'app/dashboard/[eventId]/schedule/activity-picks-actions.ts': [
    /const showToGuests = user \? await userHostsEvent\(supabase, user\.id, eventId\)\.catch\(\(\) => false\) : false;/,
    /is_public: showToGuests,/,
  ],
  // The Maker's Apply writes the Ceremony's time — behind the host membership check at the top of the action.
  'lib/ceremony-time.server.ts': [/export async function placeCeremonyBlock\(/],
  // The template's own chapters (owner 2026-11-03: Prep · Ceremony · Cocktail + Reception · After Party are DEFAULT
  // public chapters the host fills) — a default, not a person's choice; a host turns any of them off on the rail.
  'lib/schedule-seed.server.ts': [/export async function seedDefaultChapters\(/],
  // The template's chapters themselves, and the one insert helper the seeds write them with (proved below to have no
  // other caller).
  'lib/schedule.ts': [/export async function insertScheduleBlocks\(/],
};

test('2 · every writer that can turn a moment on for guests is the hosts’ call — a new one fails until gated', () => {
  const writers = SOURCES.filter((f) => {
    const src = code(f);
    if (!/from\('event_schedule_blocks'\)/.test(src) || !/\.(insert|update|upsert)\(/.test(src)) return false;
    // An `is_public` value that is not a literal false and not a type annotation.
    return /is_public\s*[:=]\s*(?!false\b|boolean\b|true;)[^\s,}]/.test(src);
  });
  assert.ok(writers.length >= 3, `anti-vacuity: only ${writers.length} schedule writers found`);
  for (const f of writers) {
    assert.ok(f in GATED_WRITERS, `${f} can show a schedule moment to guests and is not gated here — make it the hosts' call (mayShowToGuests) and list it`);
  }
  for (const [f, gates] of Object.entries(GATED_WRITERS)) {
    const src = code(f);
    for (const g of gates) assert.match(src, g, `${f}: its gate is gone (${g})`);
  }
  // The Maker's Apply — the one caller of `placeCeremonyBlock` — checks host membership first.
  const apply = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const host = apply.indexOf('await requireHostMembershipOrThrow(eventId, FORBIDDEN)');
  const place = apply.indexOf('placeCeremonyBlock({');
  assert.ok(host > 0 && place > host, 'the Maker’s Apply writes the Ceremony before it checks the host');
  // The seeds are the only callers of the template insert helper.
  const callers = SOURCES.filter((f) => f !== 'lib/schedule.ts' && /insertScheduleBlocks\(/.test(code(f)));
  assert.deepEqual(callers, ['lib/schedule-seed.server.ts'], `the template insert helper has another caller: ${callers.join(', ')}`);
  // The template seed runs only for a viewer who may edit the schedule.
  assert.match(code('app/dashboard/[eventId]/schedule/page.tsx'), /viewerAreaLevel\(viewer, 'schedule'\) === 'edit'\s*\)\s*\{\s*scheduleBlocks = await seedDefaultChapters\(eventId\);/);
});

test('3 · suppliers never set a moment’s guest visibility', () => {
  const supplierFiles = SOURCES.filter((f) => /^app\/vendor-dashboard\//.test(f) || /(supplier|vendor)[^/]*\.ts$/.test(f));
  assert.ok(supplierFiles.length > 20, 'anti-vacuity: no supplier files found');
  for (const f of supplierFiles) {
    const src = code(f);
    if (!/from\('event_schedule_blocks'\)/.test(src) || !/\.(insert|update|upsert)\(/.test(src)) continue;
    // A written value (`is_public: true` / `is_public: someVar`) — never a type annotation or a literal false.
    assert.doesNotMatch(src, /\bis_public\s*[:=]\s*(?!boolean\b|false\b)(?:true\b|[a-zA-Z_(])/, `${f} sets a moment's guest visibility`);
  }
  // The supplier's script reads the flag only to keep a private moment off the stage — never writes it.
  const script = code('app/vendor-dashboard/clients/[eventId]/script-actions.ts');
  assert.match(script, /const isPrivate = row\.is_public !== true;/);
});

test('4 · payments and meetings never reach a guest page', () => {
  const guestPages = SOURCES.filter((f) => /^app\/(\[slug\]|join|papic|sample|wall|e)\//.test(f));
  assert.ok(guestPages.length > 30, `anti-vacuity: only ${guestPages.length} guest files found`);
  const PLANNING_SOURCES = /event_preparation_items|event_appointments|event_vendor_line_items|vendor_payment_asks|fetchPreparationAgenda|@\/lib\/preparation'/;
  for (const f of guestPages) assert.doesNotMatch(code(f), PLANNING_SOURCES, `${f} reads a payment or meeting source`);
  // And the guests' schedule fence never widens to them: the one in-memory twin of the database's anonymous read.
  const audience = code('lib/schedule-audience.ts');
  assert.match(audience, /return block\.is_public === true && \(block\.audience \?\? null\) === null && block\.visibility !== 'coordinator_only';/);
});
