/**
 * THE DATE SAVES TO THE EVENT — owner 2026-11-05, verbatim: *"it shouldn't rely on the hub."*
 * (DECISION_LOG 2026-11-05 "THE DATE SAVES TO THE EVENT", amending answer 7 of 2026-10-01 for the date only.)
 *
 * Measured that day on the demo event: a day picked in the Suppliers page's "Your date" sheet went into the Event Hub
 * DRAFT, `events.event_date` stayed NULL, Home kept saying "No date yet", and nothing said an Apply was needed. The
 * date is a fact of the event — suppliers, booking clashes, Home, Papic and Live Watch read it — so every place a
 * couple sets it now writes `events` at once through ONE door (`updateEventDate`), with the shipped checks moved
 * there, and the draft can no longer hold a date at all.
 *
 * Held here, on the source and on the draft's own pure functions:
 *   1. every date pick posts to `updateEventDate` — never `hubDraftAction`, never a draft patch with a date;
 *   2. the door writes `events.event_date` + `event_date_precision` itself, with the floor, the clash refusal at the
 *      pick (fail-closed), the booked suppliers' clearance, the notices, the Schedule move and the guest page;
 *   3. the draft drops a date — from a new save, from an older stored draft and from its Undo history — and the one
 *      draft door refuses a save that still carries one, in words (never a quiet "saved");
 *   4. the date-change flow's last step is the same door, from Home; nothing puts the date back into a draft;
 *   5. the words after a save never mention Apply.
 *
 * The schema half (the couple's session writes the row; a guest's reaches none; a stale drafted date plans nothing)
 * is `tests/db/a-typed-name-and-date-wait-for-apply.db.test.ts` 2b · 2c.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  HUB_DRAFT_DATE_IS_LIVE_MESSAGE,
  HUB_DRAFT_EVENT_COLUMNS,
  HUB_DRAFT_FACT_COLUMNS,
  emptyHubDraft,
  mergeHubDraft,
  planHubDraftApply,
  sanitizeHubDraft,
  sanitizeHubDraftPatch,
  summarizeHubDraft,
} from './hub-draft';
import { savedDateNote } from './suppliers-fact-sheets';
import { dateChangeRefusalText } from './date-change';

const WEB = join(__dirname, '..');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const D = 'app/dashboard/[eventId]/';

const door = code(`${D}actions.ts`);
const doorBody = door.slice(door.indexOf('export async function updateEventDate'), door.indexOf('export async function setPlanningMode'));

/* ═══ 1 · every pick posts to the one live door ═══ */

test('1 · every place a couple sets the date posts to `updateEventDate` — never the Event Hub draft', () => {
  const pickers: Array<[string, RegExp]> = [
    // The Suppliers page's "Your date" sheet.
    [`${D}vendors/_components/fact-sheets.tsx`, /date: \(date, precision(?:, extra)?\) => \{[\s\S]{0,500}return updateEventDate\(fd\);/],
    // The Maker's Details › Your date (a day, a month, Help me choose's "Use <day>").
    [`${D}launch/_components/details-your-event.tsx`, /const saveDate = async \(date: string, precision: 'day' \| 'month'\)[\s\S]{0,400}const r = await makerSave\(\(\) => updateEventDate\(fd\), NO_SECOND_RENDER\);/],
    // Event Settings › Personalization's governed row.
    [`${D}details/_components/governed-fields.tsx`, /const res = await updateEventDate\(fd\);/],
    // Home's date-change card, once every supplier answered.
    [`${D}_components/date-change-doorway.tsx`, /const useDate = updateEventDate as unknown/],
    // Explore's "Lock this day".
    ['app/(shell)/explore/_components/vendors-availability-banner.tsx', /const res = await updateEventDate\(fd\);/],
  ];
  for (const [file, shape] of pickers) assert.match(code(file), shape, `${file} does not save the date through updateEventDate`);

  // The sheet's date save is `doors.date`, and its draft door never carries a date.
  const sheets = code(`${D}vendors/_components/fact-sheets.tsx`);
  // 📅 2026-11-13: a day also carries its last day and replaces the options — still the one door.
  assert.match(sheets, /const r = await doors\.date\(date, precision(?:, [^;]{0,160})?\);/);
  assert.doesNotMatch(sheets, /doors\.draft\(\{\s*events: \{\s*event_date/, 'the sheet still drafts the date');
  // No screen sends a date into a draft patch.
  for (const file of [`${D}vendors/_components/fact-sheets.tsx`, `${D}launch/_components/details-your-event.tsx`]) {
    const src = code(file);
    for (const m of src.matchAll(/(?:draftFacts|doors\.draft|draftFactsFull)\(([^;]{0,240})/g)) {
      assert.doesNotMatch(m[1]!, /event_date/, `${file} sends a date into the draft: ${m[0].slice(0, 120)}`);
    }
  }
  // The Home card's ready step is a form to the door — not a link to the Maker's Apply.
  const home = code(`${D}_components/date-change-doorway.tsx`);
  assert.match(home, /<form action=\{useDate\}>[\s\S]{0,400}name="event_date" value=\{view\.proposedDate\}/);
  assert.doesNotMatch(home, /Apply \{to\}|launch\?tool=details/, 'Home still sends the couple to Apply the date');
});

/* ═══ 2 · the door writes the event itself, with every shipped check ═══ */

test('2 · `updateEventDate` writes `events` itself — the floor, the clash at the pick, the clearance, the notices, the Schedule, the guest page', () => {
  assert.ok(doorBody.length > 500, 'anti-vacuity: the door was found');
  const steps: Array<[string, RegExp]> = [
    ['the date floor', /const floorRefusal = eventDateFloorRefusal\(/],
    ['the clash refusal at the pick, FAIL-CLOSED', /datePickClash\(\{[\s\S]{0,200}failClosed: true,/],
    ['"the supplier in conflict decides"', /const asked = await clashStillOpen\(supabase, eventId,/],
    ['the clash comes back with who', /if \(asked\) return \{ ok: false, error: asked\.reason, clash: asked\.clash \};/],
    ['the one date rule', /let refusal = eventDateRefusal\(prior, next, confirmed\);/],
    ['Q8 clearance', /const clearance = await dateApplyClearance\(/],
    ['the write itself, the couple’s session', /\.from\('events'\)\s*\.update\(\{\s*event_date: eventDate,\s*event_date_precision: newPrecision,[\s\S]{0,700}?\}\)\s*\.eq\('event_id', eventId\)\s*\.select\('event_id'\);/],
    ['a write that reached no row is said', /if \(error \|\| !wrote \|\| wrote\.length === 0\)/],
    ['each booked supplier is told', /await afterDateApplied\(\{ supabase, eventId,/],
    ['the Schedule follows the day', /const shifted = await moveScheduleWithDate\(\{/],
    ['the dashboard is drawn again', /revalidatePath\(`\/dashboard\/\$\{eventId\}`, 'layout'\);/],
    ['the published Event Hub is drawn again', /revalidateGuestSite\(priorRow\.slug/],
  ];
  for (const [what, shape] of steps) assert.match(doorBody, shape, `the date door lost: ${what}`);
  // Order: every check before the write, every follow-up after it.
  const at = (re: RegExp) => doorBody.search(re);
  const write = at(/\.update\(\{\s*event_date: eventDate/);
  for (const re of [/eventDateFloorRefusal\(/, /datePickClash\(/, /eventDateRefusal\(prior/, /dateApplyClearance\(/]) assert.ok(at(re) < write, `${re} runs after the write`);
  for (const re of [/afterDateApplied\(/, /moveScheduleWithDate\(/, /revalidateGuestSite\(/]) assert.ok(at(re) > write, `${re} runs before the write`);
  // Never the Hub: the door touches no draft.
  assert.doesNotMatch(doorBody, /hubDraftAction|updateHubDraft|saveHubDraftPatch|event_site_drafts/, 'the date door goes through the Event Hub');
  // Every refusal is RETURNED in words — a thrown message is replaced by a generic one in production.
  assert.doesNotMatch(doorBody, /throw new Error/, 'the date door throws a refusal');
});

/* ═══ 3 · the draft never holds a date ═══ */

test('3 · the draft drops a date — from a save, from an older stored draft, from its Undo history', () => {
  for (const c of ['event_date', 'event_date_precision']) {
    assert.equal((HUB_DRAFT_EVENT_COLUMNS as readonly string[]).includes(c), false, `${c} is draftable`);
    assert.equal((HUB_DRAFT_FACT_COLUMNS as readonly string[]).includes(c), false, `${c} is a drafted fact`);
  }
  const DATE = { event_date: '2027-04-17', event_date_precision: 'day' };
  assert.deepEqual(sanitizeHubDraftPatch({ events: { ...DATE, display_name: 'Ana & Miguel' } }).events, { display_name: 'Ana & Miguel' });
  const stored = sanitizeHubDraft({ v: 1, events: DATE, widgets: {}, history: [{ events: DATE, widgets: {} }] });
  assert.deepEqual(stored.events, {}, 'an older draft’s date is read');
  assert.equal(stored.history.some((h) => 'event_date' in h.events), false, 'Undo can bring a drafted date back');
  const merged = mergeHubDraft(emptyHubDraft(), { events: DATE as never });
  assert.deepEqual(merged.events, {});
  // Nothing to plan, nothing to count, against any live date.
  const live = { events: { event_date: '2027-03-13', event_date_precision: 'day' }, widgets: [] };
  const plan = planHubDraftApply(sanitizeHubDraft({ v: 1, events: DATE, widgets: {} }), live, false);
  assert.equal(plan.apply.length + plan.refused.length, 0, 'Apply would write a drafted date over the real one');
  assert.equal(summarizeHubDraft(stored, live, false).changeCount, 0, 'the ✓ Apply count counts a drafted date');
});

test('3b · the one draft door REFUSES a save that still carries a date — in words, never a quiet "saved"', () => {
  const action = code(`${D}website/hub-draft-actions.ts`);
  const save = action.slice(action.indexOf("if (intent === 'save') {"), action.indexOf("if (intent === 'reset') {"));
  assert.match(
    save,
    /if \(patch\.events && \('event_date' in patch\.events \|\| 'event_date_precision' in patch\.events\)\) \{\s*return \{ ok: false, intent, error: HUB_DRAFT_DATE_IS_LIVE_MESSAGE \};/,
  );
  assert.match(HUB_DRAFT_DATE_IS_LIVE_MESSAGE, /saves on its own/);
  // Apply holds no date step any more — nothing for a date to wait on.
  assert.doesNotMatch(action, /isDateItem|dateHeld|dateMove\b|date_locked|date_in_past|date_before_first_event/);
});

/* ═══ 4 · the date-change flow ends at the same door ═══ */

test('4 · every supplier answered → the couple uses the date from Today; nothing puts it back into a draft', () => {
  const flow = code('lib/date-change.server.ts');
  assert.doesNotMatch(flow, /enterReadyDateIntoDraft|takeAskedDateOutOfDraft|updateHubDraft|mergeHubDraft/, 'the date-change flow still writes the draft');
  assert.doesNotMatch(flow, /Apply it in your Event Hub|in your draft/, 'the date-change flow still sends the couple to Apply');
  // 🔁 UPDATED ON PURPOSE (THE ONE BUILD, v113): the couple's first tab is named Today now — the copy follows the
  // tab's name. Same door, same assertion — NOT WEAKENED.
  assert.match(flow, /use \$\{when\} on Today/);
  assert.doesNotMatch(dateChangeRefusalText('fits'), /draft|Apply/);
});

/* ═══ 5 · the words ═══ */

test('5 · the note after a saved date never mentions Apply or a draft', () => {
  for (const n of [0, 1, 4]) assert.doesNotMatch(savedDateNote(n), /Apply|draft/i, `savedDateNote(${n}) still waits for Apply`);
  const maker = code(`${D}launch/_components/details-your-event.tsx`);
  assert.match(maker, /setNote\(r\.note \?\? savedDateNote\(governed\.confirmedVendorCount\)\)/, 'the Maker says the same note');
  assert.doesNotMatch(maker, /Saved to your draft — your booked suppliers/);
  const line = code(`${D}vendors/_components/fact-line.tsx`);
  assert.doesNotMatch(line, /DRAFTED_DATE_WORD|in your draft/, 'the Suppliers line still says the date is in a draft');
});
