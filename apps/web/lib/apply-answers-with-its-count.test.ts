/**
 * ✓ APPLY ANSWERS WITH ITS OWN COUNT (2026-10-15, `controller-2026-10-12/maker-speed/MEASURE.md`: Apply was an unheld
 * save — the ✓ badge kept the old count until the whole Maker re-rendered, ~6–10 s at production latency).
 *
 * Now ✓ Apply is held (`hub-draft-bar.tsx` `applyHeld`) and ASKS for the bar; the answer carries what is left, and the
 * toolbar shows it from the answer (`MAKER_DRAFT_BAR_EVENT`), before any render. Driven through the lab's real planner
 * (`labDraftStep`, the same summary the real save answers with); the server's own Apply is held to the same shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { emptyHubDraft } from './hub-draft';
import { labDraftStep } from '../app/dev/maker-lab/lab-draft';

const WEB = path.resolve(__dirname, '..');

test('an Apply that asked for the bar answers with it — the count of what is left (0), with no render', () => {
  const saved = labDraftStep(emptyHubDraft(), { intent: 'save', patch: JSON.stringify({ widgets: { venue_map: { stage_show: { rsvp: false } } } }) }, false).draft;
  const asked = labDraftStep(saved, { intent: 'apply', bar: '1' }, false, null).result as { ok: boolean; bar?: { free: { changeCount: number } } };
  assert.equal(asked.ok, true);
  assert.ok(asked.bar, 'the Apply answer carries no bar — the ✓ count waits for the Maker render');
  assert.equal(asked.bar!.free.changeCount, 0, 'the bar is the draft LEFT after the apply');
  const bare = labDraftStep(saved, { intent: 'apply' }, false, null).result as { bar?: unknown };
  assert.equal(bare.bar, undefined, 'only when asked, as every save');
});

test('the server’s Apply answers with the bar when asked, read from the draft it leaves; the bar asks for it', () => {
  const action = fs.readFileSync(path.join(WEB, 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8');
  assert.match(action, /const left: HubDraft = \{ v: 1, \.\.\.remaining, history: \[\] \};\s*await writeHubDraft\(supabase, eventId, left, snapshot\);/);
  assert.match(action, /const applyBar = formData\.get\(HUB_DRAFT_BAR_FIELD\) === '1' \? await hubDraftBarAfterSave\(supabase, eventId, left\) : null;/);
  assert.match(action, /return applyBar \? \{ \.\.\.applied, bar: applyBar \} : applied;/);
  const bar = fs.readFileSync(path.join(WEB, 'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx'), 'utf8');
  const apply = bar.slice(bar.indexOf('const applyHeld = '), bar.indexOf('const slow = '));
  assert.match(apply, /fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\);/, 'Apply does not ask for its count');
});
