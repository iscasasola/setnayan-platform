/**
 * fixed-rows-are-real-boxes.test.ts — "WHAT GUESTS SEE", PASS 2 (owner 2026-10-11: *"this was already always supposed
 * to be built"*): the rows that are not scenes — E-Gifts · Entourage · Your seat · Live · Camera · Photos of you —
 * stop being grey ticks and become boxes that work. (The Digital pass, Announcements, the Reply card, Place and Reveal
 * are not boxes yet: each row says why in `lib/guests-see-build.ts`.)
 *
 * THE VALUE: `config_json.part_show.<part>[stage]` on the HERO row (`lib/stage-scenes.ts`) — per part the very shape
 * of `stage_show`. THE READING: `partChoice` / `partOnStage` / `partsHiddenOn` (`lib/what-guests-see.ts`).
 *
 *   1. the stored value: sanitised (real parts, real stages, real choices), merged part by part and stage by stage,
 *      on the hero row only, every sibling key kept; `null` takes a choice back;
 *   2. its road: the draft merge, the preview overlay, ONE free Apply item with the whole merged key, the live
 *      writer's key, and the Apply sheet's line by part name;
 *   3. the table: which cells of each fixed row are boxes, always-on, shown-as-is or dashes — printed and pinned;
 *      a tick writes exactly `hero.part_show.<part>.<stage>`, and one Apply carries scene ticks and part ticks together;
 *   4. ONLY BOXES THAT WORK: every box of every fixed row is flipped on the REAL guest page of its stage — a hide
 *      takes the part's own words or picture off the page (body AND Event Bar), an add puts it on;
 *   5. nothing stored = the page it was (the recorded pages hold that; here: the withholding touches nothing);
 *   6. a hide on one stage leaves every other stage's page exactly as it was;
 *   7. with stages switched off, no choice is read.
 *
 * SABOTAGES RUN (each seen red, then put back and re-checked by hash):
 *   A · the page's withholding made dead                                  → 4, 5, 6 red (gifts, seat, live, camera);
 *   B · the Entourage's gate made to ask our pick alone                   → 4 red (the add on the Save the Date);
 *   D · the photos-of-you mount made deaf                                 → 4 red;
 *   E · `guestsSeePatch` made to file a part under `stage_show`           → 3, 4 red;
 *   F · the draft's part-by-part merge removed                            → 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/* FIRST: the page renderer's seam (see `lib/stage-pages-fixture.ts`). */
import { PART_WORDS, renderStagePage, stageWidgets, withEveryPart, type StageCase } from './stage-pages-fixture';
import { FIXED_PARTS, PART_SHOW_KEY, configWithPartShow, partShown, sanitizePartShow, type FixedPart, type PartShow } from './stage-scenes';
import type { InvitationWidgetRow, LifecyclePhase } from './invitation-widgets';
import { partChoice, partOnStage, partsHiddenOn } from './what-guests-see';
import { buildGuestsSeeTable } from './guests-see-build';
import { GUESTS_SEE_COLUMNS, GUESTS_SEE_WORDS, guestsSeePatch, guestsSeeToggle, type GuestsSeeTable, type GuestsSeeWrites } from './guests-see-table';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, planHubDraftApply, sanitizeHubDraft } from './hub-draft';
import { hubDraftChangeLines, partShowWhat } from './hub-draft-change-lines';
import { stripComments } from './strip-comments';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const NONE: GuestsSeeWrites = {};
const withParts = (parts: PartShow, rows = stageWidgets()): InvitationWidgetRow[] =>
  rows.map((r) => (r.widget_type === 'hero' ? { ...r, config_json: configWithPartShow(r.config_json, parts) } : r));
const table = (rows: readonly InvitationWidgetRow[] = stageWidgets(), more: Partial<Parameters<typeof buildGuestsSeeTable>[0]> = {}) =>
  buildGuestsSeeTable({ widgets: rows, hasEntourage: true, giftsOff: false, ...more });
const rowOf = (t: GuestsSeeTable, key: string) => t.groups.flatMap((g) => g.rows).find((r) => r.key === key)!;
const COL = Object.fromEntries(GUESTS_SEE_COLUMNS.map((c, i) => [c.key, i])) as Record<(typeof GUESTS_SEE_COLUMNS)[number]['key'], number>;
const draftOf = (patch: unknown) => mergeHubDraft(emptyHubDraft(), JSON.parse(JSON.stringify(patch)));

test('1 · the stored value: real parts, real stages, real choices — merged part by part, on the hero row, siblings kept', () => {
  assert.deepEqual(sanitizePartShow({ gifts: { event: false, lunch: true }, seat: { rsvp: 'no' }, tickets: { rsvp: false }, live: { editorial: null } }), { gifts: { event: false }, live: { editorial: null } });
  for (const bad of [null, [], 'gifts', { tickets: { rsvp: false } }, {}]) assert.equal(sanitizePartShow(bad), null);
  const config = { main: { tint: '#000' }, [PART_SHOW_KEY]: { gifts: { event: false, rsvp: false } } };
  const next = configWithPartShow(config, { gifts: { rsvp: null }, seat: { save_the_date: false } });
  assert.deepEqual(next, { main: { tint: '#000' }, [PART_SHOW_KEY]: { gifts: { event: false }, seat: { save_the_date: false } } });
  assert.deepEqual(configWithPartShow({ a: 1, [PART_SHOW_KEY]: { gifts: { event: false } } }, { gifts: { event: null } }), { a: 1 }, 'the last choice taken back removes the key');
  assert.equal(partShown(next, 'gifts', 'event'), false);
  assert.equal(partShown(next, 'gifts', 'rsvp'), null);
  // Read off the HERO row, and only with stages on.
  const rows = withParts({ gifts: { event: false }, entourage: { save_the_date: true } });
  assert.equal(partChoice(rows, 'gifts', 'event', true), false);
  assert.equal(partChoice(rows, 'gifts', 'event', false), null);
  assert.equal(partOnStage(rows, 'gifts', 'rsvp', true, true), true, 'no choice → what the mount decided');
  assert.equal(partOnStage(rows, 'entourage', 'save_the_date', true, false), true);
  assert.deepEqual([...partsHiddenOn(rows, 'event', true)], ['gifts']);
  assert.equal(partsHiddenOn(stageWidgets(), 'event', true).size, 0);
});

test('2 · its road: merged in the draft, laid on the preview, ONE free Apply item, the live key, and a line by part name', () => {
  const live = withParts({ gifts: { event: false } });
  const d1 = draftOf({ widgets: { hero: { part_show: { gifts: { rsvp: false } } } } });
  const d2 = mergeHubDraft(d1, { widgets: { hero: { part_show: { seat: { event: false }, gifts: { event: null } } } } });
  assert.deepEqual(d2.widgets.hero?.part_show, { gifts: { rsvp: false, event: null }, seat: { event: false } });
  const laid = overlayHubDraftWidgets(live, d2).find((r) => r.widget_type === 'hero')!;
  assert.deepEqual((laid.config_json as Record<string, unknown>)[PART_SHOW_KEY], { gifts: { rsvp: false }, seat: { event: false } });
  // Only the hero row carries it.
  const stray = sanitizeHubDraft({ v: 1, events: {}, history: [], widgets: { schedule: { part_show: { gifts: { rsvp: false } } } } });
  assert.equal((stray.widgets.schedule as { part_show?: unknown } | undefined)?.part_show, undefined);
  const plan = planHubDraftApply(d2, { events: {}, widgets: live }, false);
  assert.equal(plan.refused.length, 0, 'showing or hiding a part of the page is never Pro');
  const items = plan.apply.filter((i) => i.kind === 'widget' && i.field === 'part_show');
  assert.deepEqual(items.map((i) => (i.kind === 'widget' ? [i.widgetType, i.value] : null)), [['hero', { gifts: { rsvp: false }, seat: { event: false } }]]);
  assert.equal(partShowWhat(live.find((r) => r.widget_type === 'hero')!.config_json, { gifts: { rsvp: false }, seat: { event: false } }), 'E-Gifts · Hidden on Invitation, Back to our pick on The Day · Your seat · Hidden on The Day');
  assert.deepEqual(hubDraftChangeLines(draftOf({ widgets: { hero: { part_show: { live: { rsvp: false } } } } }), { events: {}, widgets: stageWidgets() }, false), [{ place: 'What guests see', what: 'Live · Hidden on Invitation', pro: false, held: false }]);
  const ACTIONS = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8'));
  assert.match(ACTIONS, /item\.field === 'part_show'\s*\?\s*PART_SHOW_KEY/);
});

/** The Save the Date led by the couple's photos — the page with a foot (under its film the film is the whole page). */
const PHOTOS_LED = () => stageWidgets({ our_photos: { config: { std_lead: 'photos' } } });

test('3 · the table: each fixed row’s cells, and a tick writes exactly hero.part_show.<part>.<stage>', () => {
  const t = table(PHOTOS_LED());
  // 🎞 Under a film-led Save the Date there is no gift door to tick: a dash, with why.
  assert.deepEqual(rowOf(table(), 'gifts').cells[COL.save_the_date], { kind: 'dash', why: 'The Save-the-Date film is the whole page here.' });
  const shape = (key: string) => rowOf(t, key).cells.map((c) => (c.kind === 'box' ? (c.on ? (c.ourPick ? 'BOX✓•' : 'BOX✓') : 'BOX') : c.kind === 'dash' ? '—' : c.on ? 'tick' : 'quiet')).join(' ');
  const got = Object.fromEntries(['names', 'place', 'gifts', 'entourage', 'reply', 'seat', 'pass', 'announce', 'live', 'camera', 'photosofyou', 'reveal'].map((k) => [k, shape(k)]));
  for (const [k, v] of Object.entries(got)) console.log(`  ${k.padEnd(12)} ${v}`);
  assert.deepEqual(got, {
    //            Save the Date · RSVP · Invitation · The Day · Post Event
    names:       'tick tick tick tick tick',
    place:       'tick tick tick tick quiet',
    gifts:       'BOX✓• quiet BOX✓• BOX✓• BOX✓•',
    entourage:   'BOX quiet BOX✓• BOX✓• BOX✓•',
    reply:       'quiet tick tick quiet —',
    seat:        'BOX✓• quiet BOX✓• BOX✓• BOX✓•',
    pass:        'quiet quiet tick tick quiet',
    announce:    'tick quiet tick tick —',
    live:        'BOX✓• quiet BOX✓• BOX✓• BOX✓•',
    camera:      'quiet quiet quiet BOX✓• —',
    photosofyou: '— — — BOX✓• BOX✓•',
    reveal:      'tick quiet tick tick —',
  });
  // The always-shown rows answer in the prototype's words; a part's RSVP column says the reply screens' line.
  assert.equal(guestsSeeToggle(t, NONE, 'names', COL.rsvp).line, 'Names and date are always shown.');
  assert.equal(guestsSeeToggle(t, NONE, 'reply', COL.rsvp).line, 'The reply card is always on the Invitation and RSVP — it is how guests answer.');
  assert.equal(guestsSeeToggle(t, NONE, 'gifts', COL.rsvp_screens).line, GUESTS_SEE_WORDS.replyScreens);
  assert.equal(guestsSeeToggle(t, NONE, 'announce', COL.event).line, GUESTS_SEE_WORDS.locked);
  // A tick on a part, and on a scene, in ONE patch — one Apply, one draft save.
  let w: GuestsSeeWrites = NONE;
  const off = guestsSeeToggle(t, w, 'gifts', COL.event);
  assert.equal(off.line, 'Hidden on The Day. Still shown on Save the Date, Invitation and Post Event.');
  w = off.writes;
  const add = guestsSeeToggle(t, w, 'entourage', COL.save_the_date);
  assert.equal(add.line, 'Added to Save the Date.');
  w = guestsSeeToggle(t, add.writes, 'special_message', COL.rsvp).writes;
  assert.deepEqual(guestsSeePatch(w), {
    widgets: { hero: { part_show: { gifts: { event: false }, entourage: { save_the_date: true } } }, special_message: { stage_show: { rsvp: false } } },
  });
  // Stored choices come back as boxes that remember them; taking one back writes null.
  const stored = table(withParts({ gifts: { event: false }, entourage: { save_the_date: true } }));
  assert.deepEqual(rowOf(stored, 'gifts').cells[COL.event], { kind: 'box', on: false, ourPick: true, base: true, choice: false });
  assert.deepEqual(rowOf(stored, 'entourage').cells[COL.save_the_date], { kind: 'box', on: true, ourPick: false, base: false, choice: true });
  assert.deepEqual(guestsSeePatch(guestsSeeToggle(stored, NONE, 'gifts', COL.event).writes), { widgets: { hero: { part_show: { gifts: { event: null } } } } });
  // "Accept gifts? — No": our pick is then off on every stage (the page draws no gift door).
  assert.deepEqual(rowOf(table(stageWidgets(), { giftsOff: true }), 'gifts').cells.map((c) => c.kind === 'box' && c.on), [false, false, false, false, false]);
  assert.equal(rowOf(table(stageWidgets(), { hasEntourage: false }), 'entourage').note, GUESTS_SEE_WORDS.nobodyYet);
});

/** What a guest can SEE of a page: its words, its pictures and where its links go — not its markup. */
function visible(html: string): string {
  const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]).join(' ');
  const words = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return `${words} ¦ ${refs}`;
}
const STAGE_DATE: Record<LifecyclePhase, string> = { save_the_date: '2027-06-12', rsvp: '2026-12-12', event: '2026-10-10', editorial: '2026-10-01' };
/** The part's own words / link on the page — gone when it is hidden. Null: told by the page changing (the ticket's picture). */
const OWN: Record<FixedPart, readonly string[] | null> = {
  gifts: ['/pabuya'], entourage: [PART_WORDS.sponsor], seat: [PART_WORDS.table, '/venue'], live: ['fxtr-stream'], camera: ['/papic/guest'], photosofyou: ['Photos of you'],
  pass: null, reply: null, announce: null,
};

test('4 · ONLY BOXES THAT WORK: every box of every fixed row is flipped on the real page of its stage', async () => {
  const t = table(PHOTOS_LED());
  const dead: string[] = [];
  let boxes = 0;
  let adds = 0;
  for (const col of GUESTS_SEE_COLUMNS) {
    if (col.stage === null) continue;
    const stage = col.stage;
    const c: StageCase = { stage, reader: 'guest', arrangement: stage === 'save_the_date' ? 'photos' : 'plain' };
    const props = withEveryPart(c);
    const more = { ...props, event: { ...props.event!, event_date: STAGE_DATE[stage] } };
    const rows = PHOTOS_LED();
    const before = (await renderStagePage(c, rows, more)).html;
    for (const part of FIXED_PARTS) {
      const row = rowOf(t, part);
      const cell = row.cells[COL[col.key]]!;
      if (cell.kind !== 'box') continue;
      boxes += 1;
      const patch = guestsSeePatch(guestsSeeToggle(t, NONE, part, COL[col.key]).writes);
      assert.ok(patch, `${row.label} × ${col.label}: a box whose tap writes nothing`);
      const page = await renderStagePage(c, overlayHubDraftWidgets(rows, draftOf(patch)), more);
      assert.deepEqual(page.complaints, [], `${row.label} × ${col.label}`);
      const name = `${row.label} × ${col.label} (${cell.on ? 'hide' : 'add'})`;
      if (visible(page.html) === visible(before)) dead.push(name);
      const own = OWN[part];
      if (cell.on) {
        if (own) {
          assert.ok(own.some((o) => before.includes(o)), `anti-vacuity: ${name} — the page does not draw it to begin with`);
          for (const o of own) assert.ok(!page.html.includes(o), `${name}: hidden, and the page still carries "${o}"`);
        }
      } else {
        adds += 1;
        if (own) assert.ok(own.every((o) => !before.includes(o)) && own.some((o) => page.html.includes(o)), `${name}: added, and the page does not draw it`);
      }
    }
  }
  console.log(`  ${boxes} boxes of the fixed rows flipped on the real page (${adds} of them an add) · ${dead.length} changed nothing${dead.length ? `: ${dead.join(' · ')}` : ''}`);
  assert.deepEqual(dead, [], 'a box that changes nothing a guest sees must not be a box');
  assert.ok(boxes >= 19 && adds >= 1, `anti-vacuity: ${boxes} boxes, ${adds} adds`);
});

test('4b · the seat has two doors on The Day — the table in Me and the room walk in the menu — and both close', async () => {
  const c: StageCase = { stage: 'event', reader: 'guest', arrangement: 'plain' };
  const more = withEveryPart(c);
  const before = (await renderStagePage(c, stageWidgets(), more)).html;
  assert.ok(before.includes(PART_WORDS.table) && before.includes('/venue'), 'anti-vacuity: The Day draws the table and the room walk');
  const after = (await renderStagePage(c, withParts({ seat: { event: false } }), more)).html;
  assert.ok(!after.includes(PART_WORDS.table), 'the table is still named');
  assert.ok(!after.includes('/venue'), 'the room walk is still offered');
});

test('5 · nothing stored: the withholding touches nothing', async () => {
  const c: StageCase = { stage: 'event', reader: 'guest', arrangement: 'plain' };
  const a = await renderStagePage(c, stageWidgets(), withEveryPart(c));
  // An empty key, and choices that are all "shown", withhold nothing either.
  const b = await renderStagePage(c, withParts({ gifts: { event: true }, seat: { event: true }, live: { event: true }, camera: { event: true }, photosofyou: { event: true } }), withEveryPart(c));
  assert.equal(visible(b.html), visible(a.html));
  const BODY = stripComments(readFileSync(join(__dirname, '..', 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(BODY, /const partsOff = partsHiddenOn\(widgets, lifecyclePhase, phasesEnabled\);\s*if \(partsOff\.size > 0\) \{/);
});

test('6 · a part hidden on one stage leaves every other stage’s page exactly as it was', async () => {
  const hidden = withParts({ gifts: { event: false }, entourage: { event: false }, seat: { event: false }, live: { event: false } });
  for (const stage of STAGES.filter((s) => s !== 'event')) {
    const c: StageCase = { stage, reader: 'guest', arrangement: stage === 'save_the_date' ? 'film' : 'plain' };
    assert.equal((await renderStagePage(c, hidden, withEveryPart(c))).html, (await renderStagePage(c, stageWidgets(), withEveryPart(c))).html, `hidden on The Day changed ${stage}`);
  }
  // A reader with no key: the door and the names go for them too.
  const c: StageCase = { stage: 'event', reader: 'anonymous', arrangement: 'plain' };
  const plain = (await renderStagePage(c, stageWidgets(), withEveryPart(c))).html;
  const off = (await renderStagePage(c, hidden, withEveryPart(c))).html;
  assert.ok(plain.includes('/pabuya') && plain.includes(PART_WORDS.sponsor), 'anti-vacuity');
  assert.ok(!off.includes('/pabuya') && !off.includes(PART_WORDS.sponsor));
});

test('7 · with stages switched off there is no stage to choose for', async () => {
  const hidden = withParts({ gifts: { rsvp: false }, entourage: { rsvp: false }, seat: { rsvp: false } });
  const c: StageCase = { stage: 'rsvp', reader: 'guest', arrangement: 'plain' };
  const off = { ...withEveryPart(c), phasesEnabled: false };
  assert.equal((await renderStagePage(c, hidden, off)).html, (await renderStagePage(c, stageWidgets(), off)).html);
  assert.ok((await renderStagePage(c, hidden, off)).html.includes('/pabuya'), 'anti-vacuity');
});
