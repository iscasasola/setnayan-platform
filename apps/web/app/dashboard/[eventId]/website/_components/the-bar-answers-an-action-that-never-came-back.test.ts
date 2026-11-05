import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_DRAFT_SAVE_FAILED_MESSAGE, hubDraftAnswer, hubDraftOutcome, type HubDraftActionResult } from '@/lib/hub-draft';

/**
 * 📵 ↺ · ✓ · RESTORE WITH NO SIGNAL SAY SO — THEY NEVER TAKE THE MAKER DOWN.
 *
 * Measured 2026-10-11, 375 px, touch, on the unfixed bar: one change made, the phone taken offline, one tap on ↺.
 * The console: "TypeError: Failed to fetch … occurred in the <HubDraftToolbar> component" → "[root error boundary]";
 * the screen: the app's error page in place of the whole Maker (`hub-walk/maker-fixes/shots/BEFORE-P01-d-offline-undo.png`).
 * `useDraftIntent` awaited the action inside a transition with nothing to catch a request that could not leave.
 */

const BAR = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', '_components', 'hub-draft-bar.tsx'), 'utf8');

test('a request that never left is answered as a refusal, in the bar’s own words — for every intent the bar sends', async () => {
  for (const intent of ['undo', 'apply', 'restore', 'reset', 'drop'] as const) {
    const r = await hubDraftAnswer(intent, async () => {
      throw new TypeError('Failed to fetch');
    });
    assert.deepEqual(r, { ok: false, intent, error: HUB_DRAFT_SAVE_FAILED_MESSAGE });
    /* …and that refusal is one the bar SAYS (the line beside ✓), never a silent nothing. */
    assert.deepEqual(hubDraftOutcome(r), { kind: 'error', text: HUB_DRAFT_SAVE_FAILED_MESSAGE });
  }
  assert.match(HUB_DRAFT_SAVE_FAILED_MESSAGE, /your draft is kept/, 'the words no longer say the draft is safe');
});

test('an action that DID answer is handed back untouched — a refusal of its own included', async () => {
  const ok: HubDraftActionResult = { ok: true, intent: 'undo', applied: 0, held: [] };
  const no: HubDraftActionResult = { ok: false, intent: 'apply', error: 'Pick the city or area from the list.' };
  assert.equal(await hubDraftAnswer('undo', async () => ok), ok);
  assert.equal(await hubDraftAnswer('apply', async () => no), no);
});

test('the bar sends every intent through it — no bare await of the action is left in the transition', () => {
  const hook = BAR.slice(BAR.indexOf('function useDraftIntent('), BAR.indexOf('function ResultLine('));
  assert.ok(hook.length > 200, 'useDraftIntent was not found');
  /* The intent is read once, at the press (the wait for the page is started from it too — `lib/maker-settle.ts`). */
  assert.match(hook, /const intent = isHubDraftIntent\(fields\.intent\) \? fields\.intent : null;/);
  /* (2026-10-13, `rd/maker-undo-instant`, `lib/an-older-undo-is-drawn-at-once.test.ts`): a ↺ the Maker DREW goes through
     its own held door (`drawnIo`) — answered by the same `hubDraftAnswer`; every other intent is this unheld one. */
  assert.match(hook, /const r = await hubDraftAnswer\(intent, \(\) =>\s*makerSave\(\(\) => action\(eventId, fd\), \(\) => router\.refresh\(\), \{ held: false \}\),?\s*\);/);
  assert.match(hook, /return hubDraftAnswer\('undo', \(\) => makerSave\(\(\) => action\(eventId, fd\), \(\) => router\.refresh\(\), \{ held: true, undo: 'noted' \}\)\);/, 'the drawn ↺ is answered, never thrown');
  assert.doesNotMatch(hook, /await makerSave\(/, 'the action is awaited bare again — a throw takes the Maker down');
  /* Three callers of the action in the whole bar, all in the hook and all answered: `slow` (Undo, Restore, Reset and the
     sheet's × all use `run`), the drawn ↺'s `drawnIo`, and ✓ Apply's `applyHeld`. */
  /* (2026-10-15, rd/maker-fast-edits) …and ✓ Apply's own held door (`applyHeld`), answered by the same `hubDraftAnswer`. */
  assert.match(hook, /void hubDraftAnswer\('apply', \(\) => makerSave\(\(\) => action\(eventId, fd\), \(\) => router\.refresh\(\), \{ held: true, undo: 'noted' \}\)\)\.then\(/, 'Apply is answered, never thrown');
  assert.equal((BAR.match(/\baction\(eventId, fd\)/g) ?? []).length, 3);
  assert.doesNotMatch(BAR.replace(/draftAction = hubDraftAction,/, ''), /hubDraftAction\(/, 'something in the bar calls the action around the hook');
  /* A real Maker hands no door: the default is the one server action. */
  assert.match(BAR, /draftAction = hubDraftAction,\s*\}: HubDraftBarProps\)/);
  assert.match(BAR, /useDraftIntent\(eventId, draftAction\)/);
});
