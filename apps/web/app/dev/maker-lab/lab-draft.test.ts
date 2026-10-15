import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyHubDraft, overlayHubDraftWidgets, type HubDraft, type HubDraftWidget } from '@/lib/hub-draft';
import { stageAddPatch, stageOrderPatch } from '@/lib/maker-reorder';
import { buildMakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { GUESTS_SEE_COLUMNS, guestsSeeBackToPicks, guestsSeePatch, guestsSeeToggle, type GuestsSeeWrites } from '@/lib/guests-see-table';
import type { LifecyclePhase, WidgetType } from '@/lib/invitation-widgets';
import { stageEyeValue } from '@/lib/stage-eye';
import { sceneOnStage } from '@/lib/what-guests-see';
import {
  LAB_APPLY_MESSAGE,
  LAB_BAR_COOKIE,
  LAB_NAMES_COOKIE,
  LAB_OWN_COOKIE_KEYS,
  LAB_ROWS_COOKIE,
  labBarFromCookie,
  labDraftBar,
  labDraftCookies,
  labDraftFrom,
  labDraftStep,
  labDraftedRows,
  labNamesFrom,
  labRenderedSummary,
  labPublishedFrom,
  labRows,
} from './lab-draft';
import { labNavigatorInput, labSeen, labStageTiles } from './lab-navigator';

/**
 * 🧪 THE LAB'S DRAFT IS THE REAL DRAFT (the walk of 2026-10-11, P01 · P02 · P05).
 *
 * The tester's steps, on the lab's own door, with no browser: three changes and ↺ three times; Later then Earlier;
 * Remove then ＋; a change made and unmade. Each asserts what a signed-in couple's draft does, because the lab runs the
 * same reducers (`lab-draft.ts`) — a lab that counts calls instead fails every one of these.
 */

const save = (d: HubDraft, patch: unknown, bar = true) => labDraftStep(d, { intent: 'save', patch: JSON.stringify(patch), ...(bar ? { bar: '1' } : {}) }, false);
const count = (d: HubDraft) => labBarFromCookie(labDraftCookies(d, false)[LAB_BAR_COOKIE] ?? undefined);
const SERIF = { fixedStyles: { hero_eyebrow: 'serif' } };
const TITLE = { widgets: { hero: { canvas: { elements: { eyebrow: { word: 'With joy, we invite you' } } } } } };
const FADE = { widgets: { countdown: { canvas: { inFx: { fade: true } } } } };

test('P01 — three changes, then ↺ three times: each is undone, newest first, and the ✓ count goes 3 → 2 → 1 → 0', () => {
  let d = emptyHubDraft();
  for (const patch of [SERIF, TITLE, FADE]) d = save(d, patch).draft;
  assert.equal(count(d).changeCount, 3);
  assert.equal(count(d).canUndo, true);

  const cookiesAt = [labDraftCookies(d, false)];
  const seen: number[] = [];
  for (let i = 0; i < 3; i++) {
    const step = labDraftStep(d, { intent: 'undo' }, false);
    assert.equal(step.result.ok, true);
    d = step.draft;
    seen.push(count(d).changeCount);
    cookiesAt.push(labDraftCookies(d, false));
  }
  assert.deepEqual(seen, [2, 1, 0], 'the count did not step back one change at a time');
  /* The page follows: ↺ 1 takes the Fade off the Countdown, ↺ 2 the typed Title, ↺ 3 the Serif. */
  assert.match(decodeURIComponent(cookiesAt[0]!.lab_widgets ?? ''), /countdown/);
  assert.doesNotMatch(decodeURIComponent(cookiesAt[1]!.lab_widgets ?? ''), /countdown/);
  assert.match(decodeURIComponent(cookiesAt[1]!.lab_widgets ?? ''), /With joy, we invite you/);
  assert.equal(cookiesAt[2]!.lab_widgets, null, 'the typed Title is still handed to the page after its undo');
  assert.match(decodeURIComponent(cookiesAt[2]!.lab_styles ?? ''), /serif/);
  assert.equal(cookiesAt[3]!.lab_styles, null);
  assert.equal(count(d).canUndo, false, '↺ is still offered with nothing left to undo');
  assert.equal(cookiesAt[3]![LAB_BAR_COOKIE], null);
});

test('P05 — the count is the changes that differ from what guests see, never the taps', () => {
  let d = save(emptyHubDraft(), FADE).draft;
  assert.equal(count(d).changeCount, 1);
  /* Un-picking Fade puts the scene back as guests have it: no change is waiting. */
  d = save(d, { widgets: { countdown: { canvas: {} } } }).draft;
  assert.equal(count(d).changeCount, 0, 'a change made and unmade still counts');
  assert.equal(count(d).canUndo, true, 'the two steps can still be undone');
});

test('P05 — a save answers with the bar only when it asks for it, as the real save does', () => {
  const asked = save(emptyHubDraft(), SERIF, true).result;
  const plain = save(emptyHubDraft(), SERIF, false).result;
  assert.ok(asked.ok && asked.bar && asked.bar.free.changeCount === 1 && asked.bar.free.changes?.length === 1);
  assert.ok(plain.ok && plain.bar === undefined);
});

/** The Invitation's scenes as the Maker lists them and its canvas draws them (`lab-navigator.ts`), by type. */
const invitation = (d: HubDraft) =>
  labStageTiles(labDraftedRows(labDraftCookies(d, false)[LAB_ROWS_COOKIE] ?? undefined), 'rsvp')
    .filter((k) => k.startsWith('w:') && k !== 'w:what_to_bring')
    .map((k) => k.slice(2));
/** The Maker's own move: the stage's WHOLE order in one save (`lib/maker-reorder.ts`). */
const move = (d: HubDraft, order: string[]) => save(d, stageOrderPatch(order.map((t) => `w-${t}`), (id) => id.slice(2), 'rsvp'), false).draft;

test('P02 — Later moves the Message one place down on the page, Earlier moves it back', () => {
  const start = invitation(emptyHubDraft());
  assert.deepEqual(start, ['countdown', 'special_message', 'our_love_story', 'schedule', 'venue_map', 'dress_code']);
  const later = move(emptyHubDraft(), ['countdown', 'our_love_story', 'special_message', 'schedule', 'venue_map', 'dress_code']);
  assert.deepEqual(invitation(later), ['countdown', 'our_love_story', 'special_message', 'schedule', 'venue_map', 'dress_code']);
  assert.equal(count(later).changeCount > 0, true);
  const back = move(later, start);
  assert.deepEqual(invitation(back), start);
  /* ↺ after the two moves: the page is where Later left it. */
  assert.deepEqual(invitation(labDraftStep(back, { intent: 'undo' }, false).draft), invitation(later));
});

test('P02 — Remove takes the Message off the page; ＋ (the eye again) brings it back in place', () => {
  const removed = save(emptyHubDraft(), { widgets: { special_message: { is_visible: false } } }).draft;
  assert.equal(invitation(removed).includes('special_message'), false, 'a removed scene is still drawn');
  assert.equal(count(removed).changeCount, 1);
  const back = save(removed, { widgets: { special_message: { is_visible: true } } }).draft;
  assert.deepEqual(invitation(back), invitation(emptyHubDraft()));
  assert.equal(count(back).changeCount, 0);
});

/* ── THE JUNCTION ON THE LAB'S OWN PLUMBING (the merged copy's walk, 2026-10-11, M01–M08) ──────────────────────────
   The two tests above took a scene off with `is_visible` — what the eye USED to write. The merged Maker's Remove and
   the "What guests see" table both write `stage_show[stage]`, the lab's cookie had a hand-kept list of four keys, and
   that one was not in it: every tick and every Remove reached the draft and the ✓ count, and no page drew it. These
   send what the real Maker sends (`stageEyeValue`, `guestsSeeToggle` → `guestsSeePatch`) through the lab's door and
   read the lab's two pages the way they read themselves. */

const labPages = (d: HubDraft) => {
  const rows = labDraftedRows(labDraftCookies(d, false)[LAB_ROWS_COOKIE] ?? undefined);
  const nav = buildMakerNavigatorData({ postEvent: null, ...labNavigatorInput(rows) });
  const box = (type: string, stage: LifecyclePhase) => {
    const row = nav.guestsSee.groups.flatMap((g) => g.rows).find((r) => r.scene === type)!;
    const col = GUESTS_SEE_COLUMNS.findIndex((c) => c.stage === stage);
    return { row, col, cell: row.cells[col] as Extract<(typeof row.cells)[number], { kind: 'box' }> };
  };
  /* The canvas draws a stage from the same rows (`guest/page.tsx`: `labStageTiles(labDraftedRows(cookie), stage)`). */
  const canvas = (stage: LifecyclePhase) => labStageTiles(rows, stage).filter((k) => k.startsWith('w:')).map((k) => k.slice(2));
  return { rows, nav, box, canvas };
};
const tick = (d: HubDraft, ...cells: Array<[string, LifecyclePhase]>) => {
  const at = labPages(d);
  let writes: GuestsSeeWrites = {};
  for (const [type, stage] of cells) writes = guestsSeeToggle(at.nav.guestsSee, writes, type, at.box(type, stage).col).writes;
  return save(d, guestsSeePatch(writes)).draft;
};
const eye = (d: HubDraft, type: WidgetType, stage: LifecyclePhase, want: boolean) =>
  save(d, { widgets: { [type]: { stage_show: { [stage]: stageEyeValue(labPages(d).nav.stageEye[stage][type], want) } } } }).draft;

test('M01 · M04 — a box unticked in "What guests see" is off that stage’s canvas, and the table opened again says so', () => {
  const start = labPages(emptyHubDraft());
  assert.ok(start.canvas('rsvp').includes('special_message') && start.box('special_message', 'rsvp').cell.on, 'anti-vacuity: Message is on the Invitation');
  const d = tick(emptyHubDraft(), ['special_message', 'rsvp']);
  const after = labPages(d);
  assert.equal(after.canvas('rsvp').includes('special_message'), false, 'M01: an unticked part stays drawn on the Invitation');
  assert.ok(after.canvas('editorial').includes('special_message'), 'it left Post Event too');
  assert.equal(after.box('special_message', 'rsvp').cell.on, false, 'M04: the reopened table forgets the Apply');
  assert.equal(after.box('special_message', 'rsvp').cell.choice, false);
  assert.equal(count(d).changeCount, 1);
});

test('M02 — a ticked EMPTY box is drawn on its stage — a written scene, and one with nothing in it yet', () => {
  const d = tick(emptyHubDraft(), ['special_message', 'save_the_date'], ['our_photos', 'rsvp']);
  const after = labPages(d);
  assert.ok(after.canvas('save_the_date').includes('special_message'), 'M02: Message ticked on Save the Date is not drawn there');
  assert.ok(after.canvas('rsvp').includes('our_photos'), 'M02: Our photos ticked on the Invitation is not drawn there');
  /* The sample has no photos: the box keeps its tick and the row says why a guest will not see it. */
  assert.deepEqual([after.box('our_photos', 'rsvp').cell.on, after.box('our_photos', 'rsvp').row.empty], [true, true]);
  assert.equal(after.box('special_message', 'save_the_date').cell.on, true);
});

test('M05 — "Back to our picks" after three boxes: it changes them, and ✓ returns to 0', () => {
  let d = tick(emptyHubDraft(), ['special_message', 'rsvp']);
  d = tick(d, ['special_message', 'save_the_date'], ['our_photos', 'rsvp']);
  assert.equal(count(d).changeCount, 2);
  const back = guestsSeeBackToPicks(labPages(d).nav.guestsSee, {});
  assert.equal(back.changed, true, 'M05: "These are our picks already." while three boxes are changed');
  d = save(d, guestsSeePatch(back.writes)).draft;
  assert.deepEqual(labPages(d).nav.guestsSee, labPages(emptyHubDraft()).nav.guestsSee);
  assert.equal(count(d).changeCount, 0, 'M05: ✓ still holds changes that no screen shows');
});

test('M06 · M07 · M03 — Remove on the canvas unticks exactly its box, stays removed when the Maker is opened again, and ＋ offers it back', () => {
  const start = labPages(emptyHubDraft());
  const d = eye(emptyHubDraft(), 'countdown', 'rsvp', false);
  assert.deepEqual(d.widgets.countdown?.stage_show, { rsvp: false });
  const after = labPages(labDraftFrom(JSON.stringify(d))); // the Maker opened again: the draft read back from the browser
  assert.equal(after.canvas('rsvp').includes('countdown'), false, 'M07: the removed part is drawn again when the Maker is reopened');
  assert.ok(after.canvas('save_the_date').includes('countdown'), 'Remove on the Invitation took it off Save the Date');
  const flipped = start.nav.guestsSee.groups.flatMap((g) => g.rows).flatMap((r) =>
    /* 🔁 RE-AIMED 2026-10-11 ("What guests see", pass 2): a box is no longer always a SCENE's — E-Gifts, the Entourage,
       Your seat… are boxes too, with no scene to look up. Each box is compared with the SAME row and column of the
       reopened table (by the row's own key), so a Remove that unticked a fixed row's box would be caught as well. */
    r.cells.flatMap((c, i) => {
      const then = after.nav.guestsSee.groups.flatMap((g) => g.rows).find((x) => x.key === r.key)!.cells[i]!;
      return c.kind === 'box' && (then.kind !== 'box' || c.on !== then.on) ? [`${r.scene ?? r.key}:${GUESTS_SEE_COLUMNS[i]!.stage}`] : [];
    }),
  );
  assert.deepEqual(flipped, ['countdown:rsvp'], 'M06: the canvas Remove did not untick exactly its own box');
  /* M03 after a reload: the stage's fold says the couple took it off — that is what ＋ offers (`add-part-sheet.tsx`). */
  const fold = after.nav.stageLists.rsvp.folded.find((f) => f.key === 'w:countdown');
  assert.ok(fold?.hiddenByCouple && fold.widgetId, 'M03: ＋ says "Every part is already on this page."');
  /* ＋ brings it back on THIS stage, in place, and nothing is left waiting. */
  const back = eye(d, 'countdown', 'rsvp', true);
  assert.deepEqual(labPages(back).canvas('rsvp'), start.canvas('rsvp'));
  assert.equal(count(back).changeCount, 0);
});

test('M08 — before any tap, every box agrees with the canvas — or its row says the scene has nothing in it yet', () => {
  const at = labPages(emptyHubDraft());
  let boxes = 0;
  for (const row of at.nav.guestsSee.groups.flatMap((g) => g.rows)) {
    row.cells.forEach((cell, i) => {
      const stage = GUESTS_SEE_COLUMNS[i]!.stage;
      if (cell.kind !== 'box' || !row.scene || !stage) return;
      boxes += 1;
      const seen = sceneOnStage({ ...labSeen(at.rows), stage, reader: 'guest', content: {} }, row.scene)!;
      /* A scene with nothing written is drawn only where the stage LISTS it (its prompt) — never off the list. */
      const drawn = at.canvas(stage).includes(row.scene) || (!row.empty && seen.offList !== null);
      assert.equal(cell.on, drawn, `${row.scene} × ${stage}: the box is ${cell.on ? 'ticked' : 'empty'} and the canvas ${drawn ? 'draws it' : 'does not'}`);
    });
  }
  assert.ok(boxes >= 25, `anti-vacuity: only ${boxes} boxes were compared`);
  /* The three the sample has nothing in say so — the tester's "ticked, not drawn" rows. */
  const empty = at.nav.guestsSee.groups.flatMap((g) => g.rows).filter((r) => r.empty).map((r) => r.scene);
  assert.deepEqual(empty.sort(), ['our_love_story', 'our_photos', 'what_to_bring']);
  /* THE RE-WALK'S THREE (2026-10-11, M08) — pale-ticked, and nothing on their canvas. Each is now what it can be:
       · Our photos × Save the Date — a dash: the film leads that stage and carries the gallery (`stdShows`);
       · What to bring × The Day    — a dash: the Day's Welcome draws it for a guest, never the Maker's canvas;
       · Love Story × The Day       — an EMPTY box: a tick adds the scene to The Day, and its prompt is drawn there. */
  const kind = (type: string, stage: LifecyclePhase) => at.box(type, stage).cell as unknown as { kind: string; why?: string; on?: boolean };
  assert.deepEqual([kind('our_photos', 'save_the_date').kind, kind('our_photos', 'save_the_date').why], ['dash', 'Nothing written yet — guests will not see it.']);
  assert.deepEqual([kind('what_to_bring', 'event').kind, kind('what_to_bring', 'event').why], ['dash', 'Nothing written yet — guests will not see it.']);
  assert.deepEqual([kind('our_love_story', 'event').kind, kind('our_love_story', 'event').on], ['box', false]);
  const story = tick(emptyHubDraft(), ['our_love_story', 'event']);
  assert.deepEqual(story.widgets.our_love_story?.stage_show, { event: true });
  assert.ok(labPages(story).canvas('event').includes('our_love_story'), 'a ticked Love Story is not on The Day’s canvas');
  assert.equal(labPages(story).box('our_love_story', 'event').cell.on, true);
  /* Every pale tick left is on a stage whose canvas draws the part (its prompt). */
  for (const row of at.nav.guestsSee.groups.flatMap((g) => g.rows).filter((r) => r.empty)) {
    row.cells.forEach((cell, i) => {
      const stage = GUESTS_SEE_COLUMNS[i]!.stage;
      if (cell.kind === 'box' && cell.on && stage) assert.ok(at.canvas(stage).includes(row.scene!), `${row.scene} × ${stage}: a pale tick with no prompt on its canvas`);
    });
  }
  /* The lab's Day draws every scene The Day lists — one ticked onto it included (`lab-day.tsx`). */
  assert.match(read('guest', 'lab-day.tsx'), /const added = tiles\.filter\(/);
  /* …and The Day's gallery is drawn only where The Day draws it (`guest/page.tsx` `dayDraws`). */
  assert.equal(at.box('our_photos', 'event').cell.on, false);
  assert.equal(at.canvas('event').includes('our_photos'), false);
  assert.match(read('guest', 'lab-day.tsx'), /if \(key\.startsWith\('w:'\) && !draws\(key\.slice\(2\) as WidgetType\)\) continue;/);
});

test('the lab’s pages are handed EVERY key of a scene’s draft — the list of what is left out is the two with a cookie of their own', () => {
  /* A draft that sets every key a scene's draft can carry (`HubDraftWidget`). */
  const every: Record<keyof HubDraftWidget, unknown> = {
    mode: 'hidden',
    is_visible: false,
    display_order: 9,
    canvas: { inFx: { fade: true } },
    main: { ground: 'pattern', pattern: 'dots' },
    music: { button: 'disc' },
    stage_order: { rsvp: 3 },
    stage_show: { rsvp: false, event: true },
    /* "What guests see", pass 2 — the fixed parts' choices (kept on the hero row by the real sanitiser). */
    part_show: { gifts: { event: false } },
    std_lead: 'photos',
    photos_heading: 'A few of our favourites',
    custom: { title: 'Ours', body: 'Words.' },
    venue: { ceremony: { source: 'own' } },
    removed: true,
  };
  const keys = Object.keys(every) as Array<keyof HubDraftWidget>;
  const d: HubDraft = { ...emptyHubDraft(), widgets: { countdown: every as HubDraftWidget } };
  const rows = JSON.parse(decodeURIComponent(labDraftCookies(d, false)[LAB_ROWS_COOKIE] ?? '{}')) as Record<string, Record<string, unknown>>;
  assert.deepEqual(Object.keys(rows.countdown ?? {}).sort(), keys.filter((k) => !(LAB_OWN_COOKIE_KEYS as readonly string[]).includes(k)).sort(), 'a key of the draft is not handed to the lab’s pages');
  assert.deepEqual([...LAB_OWN_COOKIE_KEYS], ['canvas', 'main']);
  /* …and no hand-kept list is back in its place. */
  assert.doesNotMatch(read('lab-draft.ts'), /w\.stage_order !== undefined \? \{ stage_order/);
  /* What the real overlay lays for the keys the sample's rows take, it lays here: place, eye, mode, per-stage choice,
     and the Save the Date's Film · Photos pick and the Photos heading on the gallery's row. */
  const real: HubDraft = { ...emptyHubDraft(), widgets: { countdown: { mode: 'hidden', is_visible: false, display_order: 9, stage_order: { rsvp: 3 }, stage_show: { rsvp: false, event: true } }, our_photos: { std_lead: 'photos', photos_heading: 'A few of our favourites' } } };
  assert.deepEqual(labDraftedRows(labDraftCookies(real, false)[LAB_ROWS_COOKIE] ?? undefined), overlayHubDraftWidgets(labRows(), real));
});

/* ── R01 of the re-walk (2026-10-11): the Apply sheet named no changes after a Style pick, after any ↺ and after
   reopening the Maker — every time the bar came from a RENDER, because the lab's render knew the count alone. ── */
test('R01 — the bar a render brings lists exactly as many changes as it counts: after a Style pick, after each ↺, after reopening', () => {
  const rendered = (d: HubDraft) => labRenderedSummary(labDraftFrom(JSON.stringify(d)), false); // the draft as the browser kept it
  const check = (d: HubDraft, when: string) => {
    const bar = rendered(d);
    assert.ok(Array.isArray(bar.changes), `${when}: the Apply sheet is handed no list at all`);
    assert.equal(bar.changes!.length, bar.changeCount, `${when}: the badge counts ${bar.changeCount} and the sheet lists ${bar.changes!.length}`);
    assert.equal(bar.changeCount, count(d).changeCount, `${when}: the render's count is not the cookie's`);
    return bar;
  };
  let d = save(emptyHubDraft(), TITLE).draft;
  check(d, 'after the Title’s words');
  d = save(d, SERIF, false).draft; // a Style pick: its save brings a render, never the bar
  const two = check(d, 'after a Style pick');
  assert.equal(two.changeCount, 2);
  d = save(d, { widgets: { special_message: { canvas: { kind: 'color', color: '#A9834B' } } } }).draft;
  d = save(d, FADE).draft;
  assert.equal(check(d, 'after four edits').changeCount, 4);
  const seen: number[] = [];
  while (d.history.length > 0) {
    d = labDraftStep(d, { intent: 'undo' }, false).draft;
    seen.push(check(d, `after ↺ ${seen.length + 1}`).changeCount);
  }
  assert.deepEqual(seen, [3, 2, 1, 0]);
  assert.deepEqual(rendered(d).changes, [], 'nothing waiting, and something is still listed');
  /* …and the shell hands the bar THIS, not the cookie's count alone. */
  const shell = read('maker-lab-shell.tsx');
  assert.match(shell, /setBar\(standIn \? summary : labRenderedSummary\(readLabDraft\(scrub\), scrub, readLabPublished\(scrub\)\)\);/);
  assert.match(shell, /<HubDraftToolbar eventId=\{eventId\} summary=\{bar\}/);
  /* The REAL Maker's render has always named them (this is the lab's fault alone): one reader, right after the count. */
  const store = readFileSync(join(process.cwd(), 'lib', 'hub-draft-store.ts'), 'utf8');
  assert.match(store, /summary = summarizeHubDraft\(draft, live, ownsPro && !storeShell\);[\s\S]{0,260}summary\.changes = hubDraftChangeLines\(draft, live, ownsPro && !storeShell\);/);
});

test('leaving and coming back keeps the draft — its count, its history and what the page draws', () => {
  let d = emptyHubDraft();
  for (const patch of [SERIF, TITLE]) d = save(d, patch).draft;
  const kept = labDraftFrom(JSON.stringify(d));
  assert.deepEqual(labDraftCookies(kept, false), labDraftCookies(d, false));
  assert.equal(count(kept).changeCount, 2);
  assert.equal(labDraftStep(kept, { intent: 'undo' }, false).draft.history.length, 1);
  /* Nothing stored, or something unreadable, is no draft — never a throw. */
  assert.deepEqual(labDraftFrom(null), emptyHubDraft());
  assert.deepEqual(labDraftFrom('{not json'), emptyHubDraft());
});

test('Restore throws the draft away; Reset goes into it and can be undone; what the sample cannot do is said', () => {
  const d = save(emptyHubDraft(), FADE).draft;
  const restored = labDraftStep(d, { intent: 'restore' }, false);
  assert.deepEqual(restored.draft, emptyHubDraft());
  assert.ok(Object.values(labDraftCookies(restored.draft, false)).every((v) => v === null), 'a cookie outlived Restore');

  const reset = labDraftStep(d, { intent: 'reset', stage: 'rsvp' }, false);
  assert.equal(reset.result.ok, true);
  assert.deepEqual(labDraftStep(reset.draft, { intent: 'undo' }, false).draft.widgets, d.widgets);
  assert.equal(labDraftStep(d, { intent: 'reset', stage: 'nowhere' }, false).result.ok, false);

  const drop = labDraftStep(d, { intent: 'drop' }, false);
  assert.deepEqual(drop.result, { ok: false, intent: 'drop', error: LAB_APPLY_MESSAGE });
  assert.equal(drop.draft, d, 'a refused step changed the draft');
  assert.doesNotMatch(LAB_APPLY_MESSAGE, /celebration|website|\bsite\b/i);
});

/* ── 📣 a published state under the draft (the owner's run of 2026-10-11) ──────────────────────────────────────── */

const rowsCookie = (d: HubDraft, published: ReturnType<typeof labDraftStep>['published']) => labDraftCookies(d, false, published)[LAB_ROWS_COOKIE] ?? undefined;
const venueOnInvitation = (d: HubDraft, published: ReturnType<typeof labDraftStep>['published']) => labStageTiles(labDraftedRows(rowsCookie(d, published)), 'rsvp').includes('w:venue_map');

test('✓ Apply PUBLISHES in the lab: the planner’s changes go live, the draft is left empty with no Undo history', () => {
  /* The Venue hidden on the Invitation (the eye / a tick), then Applied. */
  const hidden = save(emptyHubDraft(), { widgets: { venue_map: { stage_show: { rsvp: false } } } }).draft;
  assert.equal(count(hidden).changeCount, 1);
  const applied = labDraftStep(hidden, { intent: 'apply' }, false, null);
  assert.deepEqual(applied.result, { ok: true, intent: 'apply', applied: 1, held: [] });
  assert.deepEqual(applied.draft, emptyHubDraft(), 'the draft kept what went live — or its Undo history');
  assert.deepEqual(applied.published, { events: {}, widgets: { venue_map: { stage_show: { rsvp: false } } } });
  /* Nothing is waiting, ↺ has nothing — and the page STILL draws the hide: it is published now. */
  const bar = labBarFromCookie(labDraftCookies(applied.draft, false, applied.published)[LAB_BAR_COOKIE] ?? undefined);
  assert.deepEqual([bar.changeCount, bar.canUndo], [0, false]);
  assert.equal(venueOnInvitation(applied.draft, applied.published), false, 'the published hide is not drawn');
  /* Stored and read back whole. */
  assert.deepEqual(labPublishedFrom(JSON.stringify(applied.published)), applied.published);
  assert.equal(labPublishedFrom(null), null);
  assert.equal(labPublishedFrom('{not json'), null);
});

test('THE OWNER’S CASE: a PUBLISHED hide, then ＋ — one Undo step, drawn at once, and one ↺ takes it all back', () => {
  const published = labDraftStep(save(emptyHubDraft(), { widgets: { venue_map: { stage_show: { rsvp: false } } } }).draft, { intent: 'apply' }, false, null).published;
  assert.equal(venueOnInvitation(emptyHubDraft(), published), false);
  /* ＋ → Venue, as the Maker sends it now: its place and its showing in ONE patch (the eye stores `null` — the
     published choice taken back — because the stage's own list has the Venue). */
  const order = ['countdown', 'special_message', 'venue_map', 'our_love_story', 'event_details', 'schedule', 'dress_code', 'what_to_bring'];
  const patch = stageAddPatch(order.map((t) => `w-${t}`), (id) => id.slice(2), 'rsvp', 'venue_map', null)!;
  const step = labDraftStep(emptyHubDraft(), { intent: 'save', patch: JSON.stringify(patch) }, false, published);
  assert.equal(step.draft.history.length, 1, 'one press, more than one Undo step');
  assert.equal(venueOnInvitation(step.draft, published), true, 'the draft’s `null` did not take the published hide back');
  const tiles = labStageTiles(labDraftedRows(rowsCookie(step.draft, published)), 'rsvp').filter((k) => k.startsWith('w:'));
  assert.equal(tiles[tiles.indexOf('w:special_message') + 1], 'w:venue_map', 'not in the place it was added');
  /* It counts against what is PUBLISHED: the hide taken back, and the new order. */
  assert.ok(labBarFromCookie(labDraftCookies(step.draft, false, published)[LAB_BAR_COOKIE] ?? undefined).changeCount >= 1);
  /* One ↺: the draft is empty again and the page is the published one — the Venue off the Invitation. */
  const undone = labDraftStep(step.draft, { intent: 'undo' }, false, published);
  assert.deepEqual(undone.draft, emptyHubDraft());
  assert.equal(venueOnInvitation(undone.draft, published), false);
  /* Applied: the hide is gone from what is published, and guests of the sample would see the Venue. */
  const live = labDraftStep(step.draft, { intent: 'apply' }, false, published);
  assert.equal(live.result.ok, true);
  assert.equal(venueOnInvitation(live.draft, live.published), true);
  assert.equal(labStageTiles(overlayHubDraftWidgets(labRows(), live.published), 'rsvp').includes('w:venue_map'), true);
});

test('the Scrub chain is its own draft: its start is what guests "see", so opening it counts nothing', () => {
  const none = labDraftCookies(emptyHubDraft(), true);
  assert.equal(none[LAB_BAR_COOKIE], null);
  const d = labDraftStep(emptyHubDraft(), { intent: 'save', patch: JSON.stringify({ widgets: { countdown: { canvas: { out: 'none' } } } }) }, true).draft;
  const c = labDraftCookies(d, true);
  assert.ok(c.lab_widgets_scrub, 'the chain saved to the ordinary jar');
  assert.equal(c.lab_widgets, undefined);
});

test('↺ answers with its own count: asked, Undo and Reset return the bar of the draft they just wrote', () => {
  const save = (d: ReturnType<typeof emptyHubDraft>, patch: unknown) => labDraftStep(d, { intent: 'save', patch: JSON.stringify(patch) }, false).draft;
  let d = save(emptyHubDraft(), { widgets: { countdown: { stage_show: { rsvp: false } } } });
  d = save(d, { widgets: { special_message: { stage_show: { rsvp: false } } } });
  assert.equal(labRenderedSummary(d, false).changeCount, 2);
  const undo = labDraftStep(d, { intent: 'undo', bar: '1' }, false);
  assert.ok(undo.result.ok && undo.result.bar, 'the answer carries no bar');
  assert.deepEqual(undo.result.bar.free, labDraftBar(undo.draft, false).free, 'the bar is not the written draft’s');
  assert.equal(undo.result.bar.free.changeCount, 1);
  assert.equal(undo.result.bar.free.canUndo, true);
  const last = labDraftStep(undo.draft, { intent: 'undo', bar: '1' }, false);
  assert.ok(last.result.ok && last.result.bar);
  assert.equal(last.result.bar.free.changeCount, 0);
  assert.equal(last.result.bar.free.canUndo, false, '↺ is still offered with nothing left to take back');
  const reset = labDraftStep(d, { intent: 'reset', stage: 'rsvp', bar: '1' }, false);
  assert.ok(reset.result.ok && reset.result.bar);
  assert.deepEqual(reset.result.bar.free, labDraftBar(reset.draft, false).free);
  /* Not asked: no bar, as before. */
  const quiet = labDraftStep(d, { intent: 'undo' }, false);
  assert.ok(quiet.result.ok && quiet.result.bar === undefined);
});

test('the lab’s cover draws the DRAFTED names — and the sample’s again once they are taken back', () => {
  const typed = labDraftStep(emptyHubDraft(), { intent: 'save', patch: JSON.stringify({ events: { display_name: 'Bolognese' } }) }, false).draft;
  const c = labDraftCookies(typed, false);
  assert.equal(labNamesFrom(c[LAB_NAMES_COOKIE] ?? undefined, 'Maria & Jose'), 'Bolognese');
  const two = labDraftStep(typed, { intent: 'save', patch: JSON.stringify({ events: { display_name: 'Bolognese & Pasta' } }) }, false).draft;
  assert.equal(labNamesFrom(labDraftCookies(two, false)[LAB_NAMES_COOKIE] ?? undefined, 'Maria & Jose'), 'Bolognese & Pasta');
  const back = labDraftStep(labDraftStep(two, { intent: 'undo' }, false).draft, { intent: 'undo' }, false).draft;
  assert.equal(labDraftCookies(back, false)[LAB_NAMES_COOKIE], null);
  assert.equal(labNamesFrom(undefined, 'Maria & Jose'), 'Maria & Jose');
  assert.equal(labNamesFrom('%E0%A4%A', 'Maria & Jose'), 'Maria & Jose', 'a cookie that cannot be read is drawn');
});

/* ── wiring: the lab's shell and pages really go through this file ─────────────────────────────────────────────── */

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'app', 'dev', 'maker-lab', ...p), 'utf8');

test('the lab keeps no draft arithmetic of its own — one door, and the bar is handed it', () => {
  const shell = read('maker-lab-shell.tsx');
  assert.doesNotMatch(shell, /labChanges|labPro\b|labSummary/, 'the call counter is back');
  assert.match(shell, /labDraftStep\(/);
  assert.match(shell, /labDraftCookies\(/);
  /* ↺ · ✓ · Restore · Reset go to the lab's door too — never to the real server action with a made-up event. */
  assert.match(shell, /<HubDraftToolbar[^>]*draftAction=\{labDraft\}/);
  const page = read('page.tsx');
  assert.match(page, /labDraftedRows\(/, 'the Maker is handed the sample rows without the draft over them');
  assert.match(page, /labBarFromCookie\(/, 'the lab render reports no draft');
  const guest = read('guest', 'page.tsx');
  assert.match(guest, /const labRowsNow = labDraftedRows\(/, 'the canvas ignores the draft’s order');
  assert.match(guest, /const stageTiles = labStageTiles\(labRowsNow, stageNow, labStory\);/, 'the canvas draws a list of its own');
  assert.match(guest, /<LabStagePages\s+stage=\{stageNow\}\s+tiles=\{stageTiles\}/);
  assert.equal(labRows().length, 16);
});
