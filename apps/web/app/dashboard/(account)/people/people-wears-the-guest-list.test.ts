/**
 * people-wears-the-guest-list.test.ts — owner 2026-10-22: *"People must look similar to guests … Somewhat but
 * not exactly"*, and, of the view dropdown at the top, *"remove it"*. The approved contract is
 * `prototypes/people_and_memories_template_2026-10-22.html` (P1–P5) and its §5 capability map: every shipped
 * control keeps a seat.
 *
 * Three properties, each read from the CODE (comments stripped, so prose cannot pass it):
 *   1 · THE ROW IS THE GUEST ROW — People draws its rows, sections, sticky head and thumb row with the Guest
 *       list's OWN stylesheet and `ActionButton`, imported, never copied (a copy is how two lists drift).
 *   2 · NOTHING SHIPPED LOST ITS SEAT — every capability of the capability map is still reached from a control.
 *   3 · A FAILED READ SAYS SO — a refused roster never reaches the counts line as a number, a count that was not
 *       read is never printed as 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const code = (rel: string) => {
  const src = readFileSync(join(HERE, rel), 'utf8');
  assert.ok(src.length > 400, `${rel} is missing or a stub`);
  return stripComments(src);
};
const ROSTER = code('_components/people-roster-view.tsx');
const ROW = code('../_components/account-thumb-row.tsx');
const FIND = code('_components/find-or-invite.tsx');
const THUMB = code('_components/people-thumb.tsx');
const FOLLOW = code('_components/follow-list-view.tsx');
const PAGE = code('page.tsx');
const PS_CSS = readFileSync(join(HERE, '_components/people-screen.module.css'), 'utf8');

/** The body of one function in a file, from its declaration to the next top-level `function `. */
function fn(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is gone — re-anchor this guard`);
  const next = src.indexOf('\nfunction ', at + 10);
  const exp = src.indexOf('\nexport function ', at + 10);
  const ends = [next, exp].filter((n) => n > 0);
  return src.slice(at, ends.length ? Math.min(...ends) : undefined);
}

const GS_IMPORT = "import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';";
const ROW_IMPORT = "from '../../_components/account-thumb-row';";

// ── 1 · the row is the Guest row ────────────────────────────────────────────

test('🔴 People draws with the Guest list’s own stylesheet and button — imported, never copied', () => {
  for (const [name, src] of [['people-roster-view', ROSTER], ['find-or-invite', FIND]] as const) {
    assert.ok(src.includes(GS_IMPORT), `${name} no longer reads the Guest list's stylesheet`);
  }
  assert.ok(ROSTER.includes("import { ActionButton } from '@/components/action-button';"), 'the rows lost the shared button');
  // A person's row: the Guest row's grid, face, name block, pill line and button group.
  const row = fn(ROSTER, 'PersonRow');
  for (const cls of ['gs.g', 'gs.ava', 'gs.who', 'gs.nmt', 'gs.meta', 'gs.acts']) {
    assert.ok(row.includes(cls), `a person's row no longer wears the Guest row's ${cls}`);
  }
  assert.ok((row.match(/<ActionButton /g) ?? []).length >= 4, 'a row verb is drawn as something other than the shared button');
  // The sections fold the Guest list's way, and the thumb row is its glass row.
  for (const cls of ['gs.sec', 'gs.barWrap', 'gs.bar', 'gs.ico', 'gs.lab', 'gs.fold', 'gs.stick', 'gs.counts']) {
    assert.ok(ROSTER.includes(cls), `the roster lost the Guest list's ${cls}`);
  }
  // …and People's own sheet adds, it does not re-draw: none of the Guest list's structural classes is defined here.
  for (const own of ['.g ', '.g{', '.ava', '.acts', '.sec ', '.bar ', '.fold', '.thumb', '.stick', '.field']) {
    assert.ok(!PS_CSS.split('\n').some((l) => l.trimStart().startsWith(own)), `people-screen.module.css re-draws ${own.trim()} — a copy`);
  }
});

test('🔴 THE ONE THUMB ROW (owner 2026-10-22): ≡ · "Search or invite" · ＋ Invite — no band, each control its own glass', () => {
  // Every People row is the one row component — never a band of its own.
  for (const [name, src] of [['people-roster-view', ROSTER], ['people-thumb', THUMB]] as const) {
    assert.ok(src.includes(ROW_IMPORT), `${name} draws its own bottom row instead of the one row`);
    assert.ok(!/gs\.lower|sn-glass-row`\} data-on=/.test(src), `${name} brought back the Guests band`);
  }
  const list = ROSTER.slice(ROSTER.indexOf("<AccountThumbRow data={{ 'data-people-thumb': 'list' }}"));
  assert.match(list, /^<AccountThumbRow data=\{\{ 'data-people-thumb': 'list' \}\} tools=\{filterPick\} field=\{<FindField f=\{find\} \/>\} action=\{<InviteAction f=\{find\} \/>\} \/>/, 'the list row is not ≡ · field · ＋');
  assert.match(THUMB, /field=\{<FindField f=\{find\} \/>\}\s*action=\{<InviteAction f=\{find\} \/>\}/, 'the other views lost the same row');
  // The row paints nothing; each control is its own glass; the field keeps 60 %.
  const band = ROW.slice(ROW.indexOf('data-one-thumb-row=""'), ROW.indexOf('{tools}'));
  assert.ok(!/sn-glass-row|border-t|shadow|bg-/.test(band), 'the row paints a band again');
  assert.match(ROW, /sn-glass-row flex h-11 min-w-\[60%\] flex-1/, 'the field lost its glass or its 60 %');
  // The placeholder is two or three words and never truncates.
  const words = (FIND.match(/placeholder="([^"]+)"/) ?? [])[1] ?? '';
  assert.equal(words, 'Search or invite');
  assert.ok(words.split(' ').length <= 3);
  assert.ok(!ROSTER.includes('<FindOrInvite'), 'the old framed capture card is back above the list');
});

test('🔒 ≡ is one dropdown that keeps the list’s own tools — Expand / Collapse all and Select', () => {
  const pick = ROSTER.slice(ROSTER.indexOf('const filterPick = ('), ROSTER.indexOf('const thumb = selectMode'));
  assert.match(pick, /picker\.options\.map\(/, 'the views left ≡');
  assert.match(pick, /key: 'list:fold'/, 'Expand / Collapse all lost its seat');
  assert.match(pick, /key: 'list:select'/, 'Select lost its seat');
  assert.match(pick, /router\.push\(peopleViewHref\(k as PeopleView, picker\.gates\)\)/);
});

// ── 2 · nothing shipped lost its seat (the prototype's §5 map) ──────────────

const CAPABILITIES: Array<[string, string, RegExp]> = [
  ['Accept a request (and the one-partner question)', ROSTER, /confirmConnection\(id, \{ replacePartner, label: isLabelAsk \}\)/],
  ['Decline a request', ROSTER, /declineConnection\(id, \{ label: isLabelAsk \}\)/],
  ['Send again on a waiting row', ROSTER, /resendConnectionInvitation\(p\.connectionId/],
  ['Withdraw / Remove', ROSTER, /withdrawConnection\(id\)/],
  ['Label = the editor (pick · remove · ask)', ROSTER, /setConnectionLabel\(person\.connectionId \?\? '', next, \{ replacePartner \}\)/],
  ['Take back an asked label', ROSTER, /setConnectionLabel\(p\.connectionId \?\? '', null\)/],
  ['Ask one person into a group', ROSTER, /invitePersonToSamahan\(\{\s*connectionId: person\.connectionId/],
  ['Ask the selected into a group (select mode)', ROSTER, /invitePersonToSamahan\(\{ connectionId: p\.connectionId \?\? '', communityId \}\)/],
  ['Plan an event together', ROSTER, /<PlanTogether person=\{p\} \/>/],
  ['Find by name', FIND, /findPeopleByName\(nameQuery\)/],
  ['Add a hit', FIND, /addPersonByPublicId\(\{ publicId: hit\.publicId \}\)/],
  ['Follow a public hit', FIND, /setFollowByPublicId\(\{ publicId: hit\.publicId, follow: true \}\)/],
  ['Invite by name + email', FIND, /addPersonConnection\(\{ name, email: to \}\)/],
  ['Loved ones (alaga) as a section of the list', PAGE, /key: 'alaga' as const, label: 'Loved ones'/],
  ['Your connection tree as the last section', PAGE, /key: 'tree' as const, label: 'Your connection tree'[\s\S]{0,120}<ConnectionTreeSection userId=\{user\.id\} bare \/>/],
  ['Your story', PAGE, /<YourStorySection \/>/],
  ['Groups · New group', PAGE, /href="\/dashboard\/samahan\/new"/],
  ['Following / Followers lists', PAGE, /<FollowListView[\s\S]{0,200}picker=\{picker\}/],
  ['The first-visit tour', PAGE, /<MiniTour tourKey="customer_people_v1" \/>/],
];

for (const [what, src, re] of CAPABILITIES) {
  test(`🔒 still reachable: ${what}`, () => {
    assert.match(src, re, `"${what}" lost its seat — the capability map says every shipped control keeps one`);
  });
}

test('🔒 the ≡ list holds Groups · Following · Followers — and every view the rail links to still resolves', () => {
  const pick = PAGE.slice(PAGE.indexOf('const picker = {'), PAGE.indexOf('const lovedOnes'));
  assert.match(pick, /\.filter\(\(o\) => o\.key !== 'requests' && o\.key !== 'alaga'\)/, 'the ≡ list drops more than Requests and Loved ones');
  for (const v of ['connected', 'requests', 'alaga', 'following', 'followers', 'samahan']) {
    assert.ok(PAGE.includes(`view === '${v}'`), `?view=${v} no longer draws anything — the rail's row lands on nothing`);
  }
  assert.match(PAGE, /initialFilter=\{view === 'requests' \? 'asking' : 'all'\}/, 'the Requests row no longer opens on "asking you"');
  // The views that are not the roster carry the same thumb row (field + ≡), so a phone can always get back.
  assert.ok(FOLLOW.includes('<PeopleThumb picker={picker} />'), 'Following / Followers have no way back on a phone');
  assert.ok(PAGE.slice(PAGE.indexOf("view === 'samahan' ? (")).includes('<PeopleThumb picker={picker} />'), 'Groups has no way back on a phone');
  assert.match(THUMB, /<PeopleViewPicker view=\{picker\.view\} options=\{picker\.options\} gates=\{picker\.gates\} \/>/);
});

test('🔒 select mode has the two verbs and only two — no bulk label (a label needs each person’s yes)', () => {
  const sel = ROSTER.slice(ROSTER.indexOf('const thumb = selectMode ? ('), ROSTER.indexOf("<AccountThumbRow data={{ 'data-people-thumb': 'list' }}"));
  assert.ok(sel.includes('onPick={askIntoGroup}'), 'select mode lost "Ask into group"');
  assert.match(sel, /label=\{`Remove \$\{formatCount\(pickedRows\.length\)\}`\}/, 'select mode lost "Remove N"');
  assert.ok(!/setConnectionLabel/.test(sel), 'a bulk label appeared in select mode');
});

// ── 3 · a failed read says so ───────────────────────────────────────────────

test('🔴 a refused roster says "couldn’t load" at the top — never "0 connected"', () => {
  const head = ROSTER.slice(ROSTER.indexOf('const topLine = ('), ROSTER.indexOf('const rowFor = '));
  const refused = head.indexOf('roster.connectionsUnavailable && tally.connected + tally.waiting + tally.asking === 0 ?');
  const first = head.indexOf('<CountDoor');
  assert.ok(refused >= 0, 'the counts line no longer checks the refusal first');
  assert.ok(first > refused, 'a count can be drawn before the refusal is checked');
  assert.ok(head.slice(refused, first).includes('{REFUSED_COUNTS}'), 'the refusal branch does not say so');
  assert.ok(!/\d/.test(ROSTER.slice(ROSTER.indexOf("const REFUSED_COUNTS = '"), ROSTER.indexOf("const REFUSED_COUNTS = '") + 60).split("'")[1] ?? '0'), 'the refused counts line carries a number');
  // The counts ARE the rows they filter to — never a server number that can disagree with the list.
  assert.match(ROSTER, /const tally = \{ connected: connectedRows\.length, waiting: waitingRows\.length, asking: requests\.length \};/);
});

test('🔴 a section count that was not read is left off — never printed as 0', () => {
  const fold = ROSTER.slice(ROSTER.indexOf('const fold = ('), ROSTER.indexOf('const list = searching'));
  assert.match(fold, /\{n === null \? null : <span className=\{gs\.n\}>· \{formatCount\(n\)\}<\/span>\}/);
  assert.match(PAGE, /count: roster\.counts\.alaga, node: lovedOnes/, 'Loved ones is counted from something other than its read (null = unread)');
});
