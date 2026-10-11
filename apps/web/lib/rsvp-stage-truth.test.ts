/**
 * ↺ AN UNDO REACHES THE RSVP STAGE'S CANVAS — `lib/rsvp-stage-truth.ts`.
 *
 * A tester, 2026-10-11 night (the release that put ＋ · drag · Group on the RSVP stage): ＋ below the question →
 * Message → typed → ↺ ↺. Both steps were taken back and the reply card still showed the added line.
 *
 *   1. THE RULE — the first render that lands after a write the canvas did not draw is the truth, unless an RSVP
 *      write of ours is still on its way; any other render is not judged here;
 *   2. THE HOLE IT CLOSES — undoing the ONLY step of a visit brings the server back to exactly what the Maker's copy
 *      was built on, and the store then answers OURS; handing the store the server's value as ours ends that;
 *   3. THE STAGE — hears every unheld write for the whole session, and on the truth: drops its copy, tells every
 *      frame, re-seeds the panel;
 *   4. WHAT THE RULE STANDS ON — ↺ is an unheld `makerSave`, which announces itself and flushes waiting picks first;
 *   5. THE LAB CAN SHOW IT — its RSVP stage is handed the draft's own config, a new object each render.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { createDraftedCanvases } from './maker-draft-store';
import { createRsvpStageTruth } from './rsvp-stage-truth';
import { rsvpLayoutEdit } from './rsvp-layout-edit';
import { emptyHubDraft, mergeHubDraft, undoHubDraft } from './hub-draft';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the rule: the render after an unheld write is the truth — once, and never over a write still on its way', () => {
  const S0 = { v: 0 };
  const t = createRsvpStageTruth();
  /* Renders with nothing owed are not judged here (the store's own rule stands). */
  assert.equal(t.lands(S0, false), false);
  assert.equal(t.lands({ v: 0 }, false), false, 'a render nobody owed was taken for the truth');
  /* ↺ is announced; the same object again is no render yet (the prop the stage already holds). */
  const held = { v: 1 };
  t.lands(held, false);
  t.unheld();
  assert.equal(t.lands(held, false), false, 'the config on hand at the press was taken for the render');
  /* The render lands: a NEW object — even when it reads the same as before. */
  assert.equal(t.lands({ v: 1 }, false), true);
  /* …and it is answered once. */
  assert.equal(t.lands({ v: 1 }, false), false);
  /* A write of ours still on its way when the render lands: its own answer decides, and nothing is owed after it. */
  t.unheld();
  assert.equal(t.lands({ v: 2 }, true), false);
  assert.equal(t.lands({ v: 2 }, false), false);
  /* Pressed while the stage was away (unmounted), answered when it comes back with what the render brought. */
  const away = createRsvpStageTruth();
  away.lands(S0, false);
  away.unheld();
  assert.equal(away.lands({ v: 9 }, false), true);
  /* Never mounted before the press: the first config it is handed is the render's. */
  const fresh = createRsvpStageTruth();
  fresh.unheld();
  assert.equal(fresh.lands(S0, false), true);
});

test('2 · the hole: the only step of a visit, undone — the store answers OURS until the stage hands it the server’s', () => {
  const store = createDraftedCanvases<Record<string, unknown>>(() => false);
  const server0: Record<string, unknown> = {};
  /* The real edit: ＋ a Message below the question. */
  const added = rsvpLayoutEdit(server0, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'question', where: 'below' });
  assert.ok(added.ok);
  const ours = { look: added.look };
  store.note('rsvp_ask', ours, server0);
  /* ↺ on the real draft: one state back — exactly the config the copy was built on. */
  const draft = mergeHubDraft(emptyHubDraft(), { events: { rsvp_ask_config: ours } } as never);
  const undone = undoHubDraft(draft);
  assert.equal(undone.events.rsvp_ask_config, undefined, 'anti-vacuity: the undo did not take the config back');
  const afterUndo: Record<string, unknown> = {};
  /* THE FAULT: the store cannot tell this render from "no render yet" — it still answers the undone edit. */
  assert.deepEqual(store.read('rsvp_ask', afterUndo), ours, 'anti-vacuity: the store no longer keeps ours on a render equal to its base — this guard needs another look');
  /* THE REMEDY the stage applies on the truth: ours IS the server's — and every reader gets the server's. */
  store.note('rsvp_ask', afterUndo, afterUndo);
  assert.deepEqual(store.read('rsvp_ask', afterUndo), afterUndo);
  assert.equal(store.size(), 0);
});

test('3 · the stage: hears unheld writes for the session; on the truth it drops its copy, tells the frames and the panel', () => {
  const STAGE = src(`${L}/maker-rsvp-stage.tsx`);
  assert.match(STAGE, /if \(hearsUnheld\) return;\s*hearsUnheld = true;\s*window\.addEventListener\(MAKER_UNHELD_WRITE_EVENT, \(\) => rsvpStageTruth\.unheld\(\)\);/, 'the stage does not hear a write the canvas did not draw');
  /* Never taken off again: the stage is unmounted while another stage shows, and an undo there must still count. */
  assert.doesNotMatch(STAGE, /removeEventListener\(MAKER_UNHELD_WRITE_EVENT/);
  assert.match(
    STAGE,
    /const pending = makerWritesPending\(canvasWriteKey\(RSVP_DRAFT_TYPE\)\) > 0 \|\| makerSavesInFlight\(\) > 0;\s*if \(!rsvpStageTruth\.lands\(current, pending\)\) return;/,
    'a render is taken for the truth over an RSVP write still on its way',
  );
  assert.match(STAGE, /noteDraftedCanvas\(RSVP_DRAFT_TYPE, current as HubSectionCanvas, current as HubSectionCanvas\);\s*latest\.current = current;\s*postAll\(\);\s*setTruth\(\(n\) => n \+ 1\);\s*\}, \[current, postAll\]\);/);
  /* Both of the stage's panels are re-seeded (a phone's rows and the desktop's list). */
  assert.equal((STAGE.match(/\btruth=\{truth\}/g) ?? []).length, 2);
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(PANEL, /setLocal\(saved\.current\);\s*\}, \[currentKey, truth\]\);/, 'the panel is not re-seeded by a render that reads the same as its base');
  /* The frames are told what the SERVER holds — the stage's own ref is what every frame is posted. */
  assert.match(STAGE, /if \(latest\.current\) \{\s*for \(const m of rsvpPreviewMessages\(latest\.current, solemn\)\) win\.postMessage\(m, origin\);/);
});

test('4 · what the rule stands on: ↺ is an unheld save, which announces itself and sends waiting picks first', () => {
  const BAR = src('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(BAR, /makerSave\(\(\) => action\(eventId, fd\), \(\) => router\.refresh\(\)\)/, 'the draft bar’s intents are no longer an unheld makerSave');
  const REFRESH = src('lib/maker-refresh.ts');
  assert.match(REFRESH, /export function makerSave<T>\([\s\S]{0,140}\): Promise<T> \{\s*if \(!options\.held\) announceUnheldWrite\(\);/);
  assert.match(REFRESH, /export function announceUnheldWrite\(\): void \{\s*started \+= 1;\s*writer\.flush\(\);[\s\S]{0,120}window\.dispatchEvent\(new Event\(MAKER_UNHELD_WRITE_EVENT\)\);/);
  /* …and the RSVP stage's own saves are HELD (they announce nothing, so they never make a render "the truth"). */
  assert.match(src(`${L}/maker-rsvp-ask.tsx`), /requestMakerRefresh,\s*\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true \},/);
});

test('5 · the lab can show it: its RSVP stage is handed the draft’s own config, a new object on every render', () => {
  const LAB = src('app/dev/maker-lab/maker-lab-shell.tsx');
  assert.match(LAB, /const drafted = readLabDraft\(scrub\)\.events\.rsvp_ask_config;/);
  assert.match(LAB, /if \(here\) setRsvpNow\(sanitizeRsvpAskConfig\(drafted \?\? live \?\? \{\}\)\);/);
  assert.match(LAB, /\}, \[scrub, renderStamp\]\);\s*const rsvpProps = useMemo/);
  assert.match(LAB, /current: rsvpNow,/);
  assert.doesNotMatch(LAB, /current: sanitizeRsvpAskConfig\(\{\}\),/, 'the lab hands the RSVP stage a constant again');
});
