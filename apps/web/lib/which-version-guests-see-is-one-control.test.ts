/**
 * 🌐 WHICH VERSION GUESTS SEE IS ONE CONTROL (owner 2026-10-06, DECISION_LOG "THE
 * APPLY SHEET IS DRAWN AS SHIPPED; OPEN BROWSING JOINS 'WHICH VERSION GUESTS
 * SEE'"; `lib/which-version-guests-see.ts`).
 *
 *   1 · The choices: Automatic · Save the Date · Invitation · The Day · After ·
 *       All of them — the four phases in the SHIPPED words.
 *   2 · "All of them" posts `open_browse` 1 and `launch_phase` auto through the
 *       SHIPPED actions; a phase pick turns open browsing back off; nothing
 *       already right is written again. Read back, the two columns spell it.
 *   3 · In the new Maker's Studio it is ONE dropdown, and NO Open browsing
 *       switch of its own is drawn behind the flag (Info's Your Event Hub).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { LAUNCH_PHASE_CHOICES } from '../app/dashboard/[eventId]/website/editor/_components/launch-phase-choices';
import { WHICH_VERSION_OPTIONS, whichVersionNow, whichVersionWrites } from './which-version-guests-see';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · six choices, the phases in the shipped words, All of them last', () => {
  assert.deepEqual(
    WHICH_VERSION_OPTIONS.map((o) => o.label),
    ['Automatic', ...LAUNCH_PHASE_CHOICES.map((c) => c.label), 'All of them'],
  );
  assert.deepEqual(LAUNCH_PHASE_CHOICES.map((c) => c.label), ['Save the Date', 'Invitation', 'The Day', 'After']);
});

test('2 · All of them = open browsing ON + Automatic; a phase turns it off; read back it round-trips', () => {
  assert.deepEqual(whichVersionWrites('all', { openBrowse: false }), { launchPhase: 'auto', openBrowse: '1' });
  assert.deepEqual(whichVersionWrites('all', { openBrowse: true }), { launchPhase: 'auto', openBrowse: null });
  assert.deepEqual(whichVersionWrites('rsvp', { openBrowse: true }), { launchPhase: 'rsvp', openBrowse: '0' });
  assert.deepEqual(whichVersionWrites('auto', { openBrowse: true }), { launchPhase: 'auto', openBrowse: '0' });
  assert.deepEqual(whichVersionWrites('event', { openBrowse: false }), { launchPhase: 'event', openBrowse: null });
  for (const o of WHICH_VERSION_OPTIONS) {
    const w = whichVersionWrites(o.key, { openBrowse: false });
    const pinned = w.launchPhase === 'auto' ? null : w.launchPhase;
    const open = w.openBrowse === '1';
    assert.equal(whichVersionNow({ pinned, openBrowse: open }), o.key, `${o.label} does not read back as itself`);
  }
});

test('3 · Studio › Info draws ONE dropdown over the shipped actions — no second Open browsing switch', () => {
  const tools = read('app/dashboard/[eventId]/launch/_components/studio-tools.tsx');
  const hub = tools.slice(tools.indexOf('export function StudioHubSettings('), tools.indexOf('export function StudioQrActions('));
  assert.ok(hub.length > 200, 'StudioHubSettings moved — re-read this guard');
  /* Each is the Form row's chosen answer (`ChosenRow` — the house `PickMenu` inside it), since the 2026-10-08 Info redesign. */
  /* Two copies since 2026-10-30: the ⚙'s compact rows (`compactRows`, owner "Redraw to prototype") and Info's fold
     (`body`) — each is Who can view ▾ + Which version ▾, one dropdown each, over the SAME pick handlers. */
  const compact = hub.slice(hub.indexOf('const compactRows = ('), hub.indexOf('if (bare) return compactRows;'));
  const fold = hub.slice(hub.indexOf('const body = ('), hub.indexOf('<Fold data="more-for-guests"'));
  assert.ok(compact.length > 200 && fold.length > 200, 'anti-vacuity: the two copies were not found');
  for (const [where, copy] of [['the ⚙', compact], ['Info', fold]] as const) {
    assert.equal((copy.match(/<ChosenRow\b/g) ?? []).length, 2, `${where}: Your Event Hub is Who can view ▾ and Which version ▾ — one dropdown each`);
    assert.equal((copy.match(/options=\{WHICH_VERSION_OPTIONS\}/g) ?? []).length, 1, where);
    assert.match(copy, /onPick=\{pickVersion\}/, `${where}: Which version does not write through the one handler`);
  }
  assert.doesNotMatch(hub, /<PickMenu\b/, 'a dropdown is hand-made beside the Form row’s');
  assert.match(hub, /setOpenBrowse\(stayForm\(eventId, \{ open_browse:/, 'All of them no longer writes the shipped open_browse');
  assert.match(hub, /setLaunchPhase\(stayForm\(eventId, \{ launch_phase: writes\.launchPhase \}\)\)/, 'the pick no longer writes the shipped launch_mode');
  assert.match(tools, /import \{ setLaunchPhase, setOpenBrowse \} from '\.\.\/\.\.\/website\/editor\/actions';/);
  assert.doesNotMatch(hub, /Open browsing|OpenBrowsePanel|open-browse/i, 'a separate Open browsing control is drawn behind the flag');
  const studioSwitches = [...hub.matchAll(/<SwitchRow\b[\s\S]*?name="([^"]+)"/g)].map((m) => m[1]);
  assert.doesNotMatch(hub, /<StudioSwitch\b/, 'a switch is hand-made beside the Form row’s');
  assert.deepEqual(studioSwitches, ['Event Bar', 'Event Bar'], 'a switch other than the Event Bar is drawn in Your Event Hub (the QR and Go live are their own rows)');
  /* …and Info is where it is drawn: MakerDetails mounts it only under `studio`. */
  const details = read('app/dashboard/[eventId]/launch/_components/maker-details.tsx');
  const block = details.slice(details.indexOf('if (props.studio) {'));
  /* (Built by `hubSettingsEditor` since 2026-10-30 — the same rows, also drawn open in the Hub's ⚙.) */
  assert.match(block, /editors\.address = hubSettingsEditor\(props, \{ bare: false \}\);/);
  const builder = details.slice(details.indexOf('export function hubSettingsEditor('), details.indexOf('export function MakerDetails('));
  assert.match(builder, /if \(!st\) return null;[\s\S]*<StudioTool\s+part="hub"\s+eventId=\{eventId\}\s+slug=\{slug\}\s+hub=\{st\.hub\}/);
  assert.doesNotMatch(details, /OpenBrowsePanel/, 'Details draws the old Open browsing panel');
});
