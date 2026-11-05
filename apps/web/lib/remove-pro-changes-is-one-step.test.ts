/**
 * ◆ "REMOVE PRO CHANGES" IS ONE SAVE (owner 2026-10-08, "keep, marked"; review of #6844, 2026-10-23): every held Pro
 * effect leaves the draft together, as ONE undo step — ↺ brings them all back at once — and a `remove` that does not
 * take its own effect off can never spin.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyHubDraft, mergeHubDraft, undoHubDraft, type HubLiveState } from './hub-draft';
import { dropAllHubProEffects, hubDraftProEffects } from './hub-pro-effects';

const live = { events: {}, widgets: [], editorial: { headline: 'Kept' } } as unknown as HubLiveState;
const twoHeld = () =>
  mergeHubDraft(emptyHubDraft(), {
    editorial: { customColumns: [{ id: 'col1', title: 'A', body: 'B' }], chapterOverrides: [{ leadId: 'lead1', title: 'T' }] },
  } as never);

test('two held Pro changes leave together, as ONE undo step, and ↺ brings both back', () => {
  const d0 = twoHeld();
  assert.equal(hubDraftProEffects(d0, live, false).length, 2, 'premise: two held Pro effects');
  const out = dropAllHubProEffects(d0, live, 'user-1');
  assert.ok(out, 'nothing was removed');
  assert.equal(hubDraftProEffects(out!, live, false).length, 0, 'a Pro change is still held');
  assert.equal(out!.history.length, d0.history.length + 1, 'one press made more than one undo step');
  assert.deepEqual(undoHubDraft(out!).editorial, d0.editorial, '↺ does not bring every Pro change back at once');
});

test('nothing held → no save at all', () => {
  assert.equal(dropAllHubProEffects(emptyHubDraft(), live), null);
});
