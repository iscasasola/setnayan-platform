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
  assert.match(hook, /const r = await hubDraftAnswer\(isHubDraftIntent\(fields\.intent\) \? fields\.intent : null, \(\) =>\s*makerSave\(\(\) => action\(eventId, fd\), \(\) => router\.refresh\(\)\),\s*\);/);
  assert.doesNotMatch(hook, /await makerSave\(/, 'the action is awaited bare again — a throw takes the Maker down');
  /* One caller of the action in the whole bar: the hook (Undo, Apply, Restore, Reset and the sheet's × all use `run`). */
  assert.equal((BAR.match(/\baction\(eventId, fd\)/g) ?? []).length, 1);
  assert.doesNotMatch(BAR.replace(/draftAction = hubDraftAction,/, ''), /hubDraftAction\(/, 'something in the bar calls the action around the hook');
  /* A real Maker hands no door: the default is the one server action. */
  assert.match(BAR, /draftAction = hubDraftAction,\s*\}: HubDraftBarProps\)/);
  assert.match(BAR, /useDraftIntent\(eventId, draftAction\)/);
});
