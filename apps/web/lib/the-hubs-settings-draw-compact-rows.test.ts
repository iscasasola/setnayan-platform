/**
 * ⚙ THE HUB'S ⚙ › YOUR EVENT HUB IS DRAWN AS THE PROTOTYPE DRAWS IT — owner, 30 Oct, verbatim: *"Redraw to prototype"*,
 * in reply to: the ⚙ re-used Studio › Info's editors (a tall address block with its own full-width "Save address"; Go
 * live as the big "Your Event Hub is private · Launch now / Schedule for later" card) instead of the prototype's compact
 * rows (`prototypes/build-contracts-2026-10-30/event-hub-pro/` `openSettings`).
 *
 *   1 · compact rows, ONE line each, in the prototype's order: the address inline + Save · Show the event QR (switch) ·
 *       Go live (switch) · Who can view ▾ · Which version ▾ · Event Bar (switch) — and no tall card, no fold;
 *   2 · the address is the SHIPPED field on one row (`SlugField`/`AddressField` `compact`): the same form, the same
 *       `saveAction`, a small "Save" — never a second, full-width "Save address";
 *   3 · Who can view offers EXACTLY the stored values the shipped control offers (`WHO_CAN_VIEW`) — no new tier;
 *   4 · Go live is the shipped launch panel's three actions, nothing new: it ASKS before it launches, "Schedule for
 *       later" stays reachable, and once live there is no off (the panel has no un-launch);
 *   5 · every other write is the fold's own handler (one pick handler per setting, both copies).
 *
 * Read from SOURCE, comments stripped (the sheet is drawn on <body> only in a browser).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { EVENT_VISIBILITIES, WHO_CAN_VIEW } from './event-visibility';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const TOOLS = read(`${L}/studio-tools.tsx`);
const HUB = TOOLS.slice(TOOLS.indexOf('export function StudioHubSettings('), TOOLS.indexOf('export function StudioQrActions('));
const COMPACT = HUB.slice(HUB.indexOf('const compactRows = ('), HUB.indexOf('if (bare) return compactRows;'));
const GO_LIVE = read(`${L}/hub-go-live-row.tsx`);
const SLUG = read('app/dashboard/[eventId]/invitation/_components/slug-field.tsx');

test('anti-vacuity: the ⚙ copy and the Go live row were found', () => {
  assert.ok(HUB.length > 500, 'StudioHubSettings moved — re-read this guard');
  assert.ok(COMPACT.length > 500, 'the ⚙’s compact rows were not found');
  assert.ok(GO_LIVE.length > 500, 'the Go live row was not found');
});

test('1 · compact rows in the prototype’s order — switches and two dropdowns, no tall card, no fold', () => {
  assert.match(HUB, /if \(bare\) return compactRows;/, 'the ⚙ does not draw its own compact rows');
  const marks: Array<[string, RegExp]> = [
    ['address', /data-studio-hub-row="address"/],
    ['QR switch', /<StudioQrShown eventId=\{eventId\} shown=\{qrShown\} line=/],
    ['Go live switch', /<HubGoLiveRow /],
    ['Who can view ▾', /<ChosenRow\s+data="who-can-view"/],
    ['Which version ▾', /<ChosenRow\s+data="which-version"/],
    ['Event Bar switch', /<SwitchRow\s+data="event-bar"/],
  ];
  let at = -1;
  for (const [name, re] of marks) {
    const m = re.exec(COMPACT);
    assert.ok(m, `${name} is not drawn in the ⚙`);
    assert.ok(m.index > at, `${name} is out of the prototype’s order`);
    at = m.index;
  }
  assert.doesNotMatch(COMPACT, /<LaunchStdButton\b/, 'the tall launch card is drawn in the ⚙ again');
  assert.doesNotMatch(COMPACT, /<Fold\b/, 'the ⚙’s rows are folded');
  assert.doesNotMatch(COMPACT, /STUDIO_LIVE_LINE/, 'the "right away" line is said in the ⚙ beside its ⓘ');
  // Every row says one quiet line of what it is, as the prototype's `.ln` does.
  for (const row of ['who-can-view', 'which-version', 'event-bar']) {
    const i = COMPACT.indexOf(`data="${row}"`);
    assert.match(COMPACT.slice(i, i + 300), /line=/, `${row} has no line`);
  }
  // The switches are the house switch (a frame only on what is pressed): QR and Event Bar `SwitchRow`, Go live too.
  assert.match(TOOLS, /export function StudioQrShown\([\s\S]{0,400}<SwitchRow[\s\S]{0,120}line=\{line\}/, 'the QR row is not the house switch with its line');
  assert.match(GO_LIVE, /<SwitchRow\s+data="go-live"\s+name="Go live"\s+line=\{line\}/, 'Go live is not a switch row');
});

test('2 · the address is the shipped field on ONE row — a small Save, never a full-width "Save address"', () => {
  const details = read(`${L}/maker-details.tsx`);
  assert.match(details, /address=\{addressEditor\(props, \{ compact: bare \}\)\}/, 'the ⚙ is not handed the compact address');
  const editor = details.slice(details.indexOf('function addressEditor('), details.indexOf('export function hubSettingsEditor('));
  assert.match(editor, /if \(compact\) \{[\s\S]*<AddressField compact eventId=\{eventId\} slug=\{slug\} saveAction=\{slugAction\} \{\.\.\.addressPart\} \/>[\s\S]*<SlugField compact eventId=\{eventId\} initialSlug=\{slug \?\? ''\} saveAction=\{slugAction\} \/>/);
  const compact = SLUG.slice(SLUG.indexOf('if (compact) {'), SLUG.indexOf('return (\n    <form action={submit} className="space-y-2">'));
  assert.ok(compact.length > 300, 'anti-vacuity: SlugField’s compact branch was not found');
  assert.match(compact, /<form action=\{submit\} data-slug-field="compact">/, 'the compact row is not the same form');
  assert.match(compact, /setnayan\.com\//, 'the address is not shown inline after setnayan.com/');
  assert.match(compact, /type="submit"[\s\S]{0,600}\{pending \? 'Saving…' : 'Save'\}/, 'the compact row’s Save is not a small "Save"');
  assert.doesNotMatch(compact, /Save address|w-full|button-secondary/, 'the compact row draws the tall field’s full-width button');
  // The one submit handler, shared with the tall field: the same action, the same refusal handling.
  assert.equal((SLUG.match(/await saveAction\(formData\)/g) ?? []).length, 1, 'the compact row saves through a second handler');
  // AddressField's three answers, one row each way: held → live save; on sale → drafts; neither → shown.
  const af = SLUG.slice(SLUG.indexOf('export function AddressField('));
  assert.match(af, /if \(compact\) \{[\s\S]*if \(!offered\) \{[\s\S]*data-address-field="shown"[\s\S]*<SlugField\s+compact[\s\S]*\{\.\.\.\(owns \? \{\} : \{ onDraft: draftAddress, drafted \}\)\}/);
});

test('3 · Who can view offers exactly the stored values the shipped control offers — no new tier', () => {
  assert.deepEqual(WHO_CAN_VIEW.map((w) => w.key), ['private', 'unlisted', 'public']);
  for (const w of WHO_CAN_VIEW) assert.ok((EVENT_VISIBILITIES as readonly string[]).includes(w.key), `${w.key} is not a stored value`);
  const who = COMPACT.slice(COMPACT.indexOf('data="who-can-view"'), COMPACT.indexOf('data="which-version"'));
  assert.match(who, /options=\{WHO_CAN_VIEW\}/, 'the ⚙’s Who can view is not the shipped options');
  assert.match(who, /onPick=\{pickWho\}/, 'the ⚙’s Who can view does not write through the shipped handler');
  assert.doesNotMatch(COMPACT, /Exclusive|invited_accounts|'Private — /, 'a tier the shipped control does not offer is drawn');
});

test('4 · Go live reuses the shipped launch panel’s actions — it asks first, Schedule for later stays, no off once live', () => {
  // The three shipped writes, and nothing else.
  assert.match(GO_LIVE, /import \{ cancelScheduledLaunch, launchSaveTheDate, scheduleSaveTheDateLaunch \} from '\.\.\/\.\.\/studio\/save-the-date\/actions';/);
  assert.equal((GO_LIVE.match(/from '[^']*actions'/g) ?? []).length, 1, 'Go live imports a write the shipped panel does not make');
  assert.match(GO_LIVE, /SchedulePicker, answered, formatManila, toManilaInputValue \} from '\.\.\/\.\.\/studio\/save-the-date\/_components\/launch-std-button';/, 'the panel’s own picker / refusal shape is not reused');
  // A tap never launches by itself: the switch opens the panel's question; only "Yes, launch" launches.
  const change = GO_LIVE.slice(GO_LIVE.indexOf('onChange={() => {'), GO_LIVE.indexOf('problem={error}'));
  assert.ok(change.length > 20, 'anti-vacuity: the switch’s onChange was not found');
  assert.doesNotMatch(change, /doLaunch|launchSaveTheDate/, 'the switch launches without asking');
  assert.match(change, /setAsking\(\(v\) => !v\)/);
  assert.match(GO_LIVE, /'Make your Event Hub public now\?'/, 'the shipped question is not asked');
  assert.equal((GO_LIVE.match(/onClick=\{doLaunch\}/g) ?? []).length, 1, 'launch is reachable other than by “Yes, launch”');
  assert.match(GO_LIVE, /label=\{pending \? 'Launching…' : 'Yes, launch'\}[^\n]*onClick=\{doLaunch\}/);
  // Schedule for later stays reachable, and a schedule can be changed or cancelled.
  assert.match(GO_LIVE, /label=\{scheduledAt \? 'Change time' : 'Schedule for later'\} onClick=\{openPicker\}/, 'Schedule for later is lost');
  assert.match(GO_LIVE, /label="Cancel schedule"[^\n]*onClick=\{doCancel\}/, 'a schedule cannot be cancelled');
  assert.match(GO_LIVE, /Goes live \$\{formatManila\(scheduledAt\)\}/, 'the row does not say when it is scheduled');
  // Once live there is no off — the shipped panel has no un-launch; the ⓘ says the way back.
  assert.match(GO_LIVE, /disabled=\{launched \|\| pending\}/, 'a live Event Hub can be switched “off” with no write behind it');
  assert.match(GO_LIVE, /set Who can view to Private to close it again/);
  // A launch makes the page Public — the row beside it says so.
  assert.match(COMPACT, /onLaunched=\{\(\) => setWho\('public'\)\}/, 'Who can view still reads the old value after a launch');
  // A press that never answered is said, and a launch not confirmed never looks launched.
  assert.match(GO_LIVE, /if \(res\.ok\) \{\s*setLaunched\(true\);/);
  assert.match(GO_LIVE, /'Could not launch right now — please try again\.'/);
});

test('5 · the other writes are the fold’s own handlers — one per setting, shared by both copies', () => {
  assert.equal((HUB.match(/const pickWho = /g) ?? []).length, 1);
  assert.equal((HUB.match(/const pickVersion = /g) ?? []).length, 1);
  assert.equal((HUB.match(/updateLandingPageVisibility\(/g) ?? []).length, 1, 'Who can view writes in two places');
  assert.match(COMPACT, /onChange=\{\(\) => maker\.eventBar\?\.toggle\(\)\}/, 'the ⚙’s Event Bar is not the registered switch');
  assert.doesNotMatch(COMPACT, /studioDraftKeep\(/, 'the QR is drafted in a second place');
});
