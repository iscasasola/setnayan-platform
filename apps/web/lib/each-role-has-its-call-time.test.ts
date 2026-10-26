/**
 * ⏰ EACH ROLE HAS ITS CALL TIME — set beside its outfit (owner 2026-10-18, verbatim: *"Call time: each role will have
 * their call time."*).
 *
 * Before: a call time could only be typed in the older desktop dress-code form (the Maker's Dress code scene Content) —
 * not on a phone — while Studio › Mood Board & Dress Code, where each row is dressed, only SAID it ("Arrives 2:00 PM").
 * Now each row of the Studio sets it, and the old form's field is gone.
 *
 * ONE HOME, NOTHING MOVED: `dress_code_config[roles|groups][key].callTime` — the field the old form wrote and the guest
 * page reads (`resolveAttireFor` → the reader's own row → "Call time" above their outfit). So every time already set
 * shows in the Studio as it is, with no migration.
 *
 *   1 · `withCallTime` / `callTimeOf` — set, clear, refuse a half-read time, never a line that is not there.
 *   2 · a time set in the Studio is the one the guest in that row reads (group row and own row); none → nothing said.
 *   3 · the Studio draws one Call time chip per row, holding the stored time, and the field opens from it in a sheet
 *       (owner 2026-10-22, the row's header chip) (the GUESTS' is not a dress-code time: it is the Schedule's arrival
 *       moment, owner 2026-10-19 — `guests-have-one-arrival-time.test.ts`); a row with no Wear says what to do first.
 *   4 · the old form draws no time field and posts no time; a save from it KEEPS every stored time (`carryCallTimes`),
 *       and a poster that still sends times is read as before.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callTimeOf, withCallTime } from './mood-board-studio';
import { carryCallTimes, sanitizeRoleAttire } from './role-dress-code';
import { resolveGuestAttireWithGroups, sanitizeGroupAttire } from './role-group-dress-code';
import { isDressableRole } from './attire-rows';
import { fallbackInspirationParts } from './inspiration-parts';

/* The Studio and the old form are client components that import server actions — stood in, as
   `each-role-has-its-own-designs.test.ts` does, so they render here without a server. */
(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (/(?:^|\/)(?:actions|wizard-actions|hub-draft-actions|colour-access-actions)$/.test(request)) {
      return new Proxy({}, { get: () => async () => ({}) });
    }
    return load.call(this, request, ...rest);
  };
}

const CONFIG = {
  roles: { bride: { style: 'mermaid', note: 'Ivory' }, groom: { style: 'suit', callTime: '13:00' } },
  groups: { principal_sponsors: { style: 'barong_tagalog' }, bridesmaids: { style: 'long_gown', callTime: '12:30' } },
};

/* ── 1 · the write ───────────────────────────────────────────────────────── */

test('1 · a row’s call time is set and cleared on its own outfit line; the rest is kept exactly', () => {
  const set = withCallTime(CONFIG, 'groups', 'principal_sponsors', '14:00');
  assert.deepEqual(set.groups.principal_sponsors, { style: 'barong_tagalog', callTime: '14:00' });
  assert.equal(set.groups.bridesmaids, CONFIG.groups.bridesmaids, 'another group is not touched');
  assert.equal(set.roles, CONFIG.roles, 'the other tier is not touched');
  assert.equal(callTimeOf(set, 'groups', 'principal_sponsors'), '14:00');

  const own = withCallTime(CONFIG, 'roles', 'bride', '07:45');
  assert.deepEqual(own.roles.bride, { style: 'mermaid', note: 'Ivory', callTime: '07:45' }, 'the note stays');

  const cleared = withCallTime(CONFIG, 'roles', 'groom', null);
  assert.deepEqual(cleared.roles.groom, { style: 'suit' }, 'cleared → no callTime key at all');
  assert.equal(callTimeOf(cleared, 'roles', 'groom'), null);

  for (const bad of ['7', '7pm', '24:00', '1:00', 'seven']) {
    assert.deepEqual(withCallTime(CONFIG, 'roles', 'groom', bad).roles.groom, { style: 'suit' }, `"${bad}" is not a time — it clears, never repairs`);
  }

  /* A row with no Wear has no outfit line — every reader drops a line with no style, so a time there changes nothing. */
  assert.equal(withCallTime(CONFIG, 'groups', 'groomsmen', '12:30'), CONFIG, 'no line → the config comes back unchanged');
  assert.equal(callTimeOf(CONFIG, 'groups', 'groomsmen'), null);
  assert.equal(callTimeOf(null, 'roles', 'bride'), null);
  assert.equal(callTimeOf({ roles: { bride: { style: 'mermaid', callTime: '7' } } }, 'roles', 'bride'), null, 'a stored junk time reads as none');
});

/* ── 2 · the guest reads it ──────────────────────────────────────────────── */

function guestPanel(config: { roles?: unknown; groups?: unknown }, role: string) {
  return resolveGuestAttireWithGroups({
    role: role as never,
    roles: sanitizeRoleAttire(config.roles, isDressableRole),
    groups: sanitizeGroupAttire(config.groups),
    palette: null,
  }).panel;
}

test('2 · the time set in the Studio is the time the guest in that row reads — above their outfit', () => {
  const studio = withCallTime(withCallTime(CONFIG, 'groups', 'principal_sponsors', '14:00'), 'roles', 'bride', '07:45');
  assert.equal(guestPanel(studio, 'principal_sponsor_ninang')?.callTime, '2:00 PM', 'a ninang reads her group row’s time');
  assert.equal(guestPanel(studio, 'principal_sponsor_ninong')?.callTime, '2:00 PM', 'and so does a ninong');
  assert.equal(guestPanel(studio, 'bride')?.callTime, '7:45 AM', 'the bride reads her own row’s');
  assert.equal(guestPanel(studio, 'bridesmaid')?.callTime, '12:30 PM', 'a time set before this change still reads');
  /* A row with no time: the guest is told nothing about a time — never one invented. */
  assert.equal(guestPanel(CONFIG, 'principal_sponsor_ninang')?.callTime ?? null, null);
  /* Cleared in the Studio → gone from the guest's panel. */
  assert.equal(guestPanel(withCallTime(studio, 'groups', 'bridesmaids', null), 'bridesmaid')?.callTime ?? null, null);
});

/* ── 3 · the Studio draws the field ──────────────────────────────────────── */

const ROWS = [
  { tier: 'roles', key: 'bride', label: 'The bride', paletteKey: 'bride', arrives: null },
  { tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: null },
  { tier: 'groups', key: 'principal_sponsors', label: 'Principal Sponsors', paletteKey: 'principal_sponsors', arrives: null },
  { tier: 'groups', key: 'bridesmaids', label: 'Bridesmaids', paletteKey: 'bridesmaids', arrives: null },
  { tier: 'groups', key: 'groomsmen', label: 'Groomsmen', paletteKey: 'groomsmen', arrives: null },
  { tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null },
];
async function studio(dressConfig: Record<string, unknown> | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  return renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'e',
      inspirationParts: fallbackInspirationParts(),
      palette: { reception: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'] },
      fallbackFive: ['#5C0700', '#669C35', '#F7F2EC', '#646B38', '#F3E5B9'],
      frozenDressing: [],
      changes: [],
      attire: ROWS,
      dressConfig,
      attireStyles: [],
      inspirations: [],
      autoThemes: [],
      regions: [],
      dosLists: null,
      startTab: 'attire',
    }),
  );
}
const section = (html: string, key: string) => {
  const at = html.indexOf(`data-mood-board-role="${key}"`);
  assert.ok(at >= 0, `${key} is not drawn`);
  const end = html.indexOf('data-mood-board-role="', at + 10);
  return end < 0 ? html.slice(at) : html.slice(at, end);
};

test('3 · Studio › Attire: one Call time chip per row, holding the stored time; the guests’ is not the dress code’s', async () => {
  /* RE-AIMED 2026-10-22 (owner, "Yes to all" to prototype `dress_code_role_rows_tidy_2026-10-22.html` § 2): the row's time
     is its HEADER CHIP — "Call time 1:00 PM" · "Set a call time" — and the same field and Clear open from it in a sheet
     (drawn below). The row itself draws no time field any more; the chip carries the stored value it hands the sheet. */
  const html = await studio(CONFIG);
  const fields = (s: string) => s.split('type="time"').length - 1;
  const chipOf = (s: string) => /data-mood-board-call-time="[^"]+" data-mood-board-call-time-value="([^"]*)"><button([^>]*)>[\s\S]*?<span class="lbl">([^<]*)<\/span>/.exec(s);
  for (const key of ['bride', 'groom', 'principal_sponsors', 'bridesmaids']) {
    const s = section(html, key);
    assert.equal((s.match(/data-mood-board-call-time="/g) ?? []).length, 1, `${key} has not exactly one Call time chip`);
    assert.equal(fields(s), 0, `${key} draws a time field in the row — it belongs in the chip’s sheet`);
  }
  const groom = chipOf(section(html, 'groom'));
  assert.equal(groom?.[1], '13:00', 'the groom’s stored time (set in the old form) is not what his chip holds');
  assert.equal(groom?.[3], 'Call time 1:00 PM', 'and his chip does not say it');
  assert.equal(chipOf(section(html, 'bridesmaids'))?.[1], '12:30');
  const sponsors = chipOf(section(html, 'principal_sponsors'));
  assert.equal(sponsors?.[1], '', 'no time yet → an empty chip, never a guess');
  assert.equal(sponsors?.[3], 'Set a call time');
  assert.doesNotMatch(sponsors?.[2] ?? '', /data-waiting/, 'a row with a Wear cannot open its time');

  /* No Wear picked → no line to keep a time on: the chip waits (grey, still a button) and the row says what to do first. */
  const groomsmen = section(html, 'groomsmen');
  assert.match(chipOf(groomsmen)?.[2] ?? '', /aria-disabled="true"[\s\S]*data-waiting=""|data-waiting=""[\s\S]*aria-disabled="true"/, 'the chip of a row with no Wear can be pressed');
  assert.equal(fields(groomsmen), 0);
  assert.match(groomsmen, /data-mood-board-call-time-waits="">Pick what they wear first/);

  /* The guests' call time is the Schedule's arrival moment (owner 2026-10-19), handed in as `arrival` — never a dress-code
     time. Without the programme handed in, the Guests row draws none (`guests-have-one-arrival-time.test.ts` draws it). */
  const guests = section(html, 'guest');
  assert.doesNotMatch(guests, /data-mood-board-call-time=/, 'the guests’ row draws a dress-code call time');

  /* The dress code could not be read → no chip (nothing to write onto), as Wear ▾ is not offered then. */
  assert.doesNotMatch(await studio(null), /data-mood-board-call-time=/);
});

test('3b · the chip’s sheet is the SAME field and Clear, read from the one `timeOf(row)` the chip reads', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CallTimeRow } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const draw = (p: Record<string, unknown>) => renderToStaticMarkup(React.createElement(CallTimeRow as React.ComponentType<Record<string, unknown>>, { rowKey: 'groom', label: 'The groom', onSet: () => {}, onDone: () => {}, ...p }));
  const set = draw({ value: '13:00', canSet: true });
  assert.match(set, /type="time"[^>]*value="13:00"/, 'the sheet’s field does not hold the stored time');
  assert.match(set, /aria-label="Clear the call time for The groom"/, 'Clear is not in the sheet');
  assert.match(set, /data-mood-board-call-time-done=""/, 'the sheet has no Done');
  assert.match(draw({ value: null, canSet: true }), /type="time"[^>]*value=""/);
  assert.doesNotMatch(draw({ value: null, canSet: true }), /Clear the call time/, 'Clear offered with nothing to clear');
  assert.doesNotMatch(draw({ value: null, canSet: false }), /type="time"/, 'a field that would save onto nothing');
  /* One read for both: the chip and the sheet are handed `timeOf(row)` — never two answers to "what time is it". */
  const src = readFileSync(join(__dirname, '../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'), 'utf8');
  assert.match(src, /const time = timeOf\(row\);/, 'the chip does not read timeOf(row)');
  assert.match(src, /const t = timeOf\(row\);[\s\S]{0,600}<CallTimeRow \{\.\.\.t\} onDone=/, 'the sheet does not read timeOf(row)');
  assert.match(src, /setSheet\(\{ kind: 'time', row \}\)/, 'the chip does not open the sheet');
});

/* ── 4 · the old form retires its field and keeps every time ─────────────── */

test('4 · the old dress-code form draws no time field and posts no time', async () => {
  const { DressCodeFields, normalizeDressCodeConfig } = await import(
    '../app/dashboard/[eventId]/studio/mood-board/_components/dress-code-fields'
  );
  const { renderToStaticMarkup } = await import('react-dom/server');
  const config = normalizeDressCodeConfig({
    roles: { bride: { style: 'mermaid', callTime: '07:45' }, best_man: { style: 'suit', callTime: '12:00' } },
    groups: { principal_sponsors: { style: 'barong_tagalog', callTime: '14:00' } },
  });
  const html = renderToStaticMarkup(
    React.createElement(DressCodeFields, {
      config,
      eventNoun: 'wedding',
      eventRoles: [
        { role: 'bride', label: 'Bride', count: 1 },
        { role: 'principal_sponsor_ninang', label: 'Ninang', count: 4 },
      ],
    }),
  );
  assert.doesNotMatch(html, /type="time"/, 'a time field is drawn in the old form again');
  assert.doesNotMatch(html, /_call_time/, 'the old form posts a call time again');
  assert.match(html, /name="role_key" value="bride"/, 'precondition: the bride’s row is drawn');
  assert.match(html, /name="group_key" value="principal_sponsors"/, 'precondition: the sponsors’ row is drawn');
});

test('4 · a save from the old form keeps every stored time; a poster that sends times is read as sent', () => {
  /* What the old form's save builds: every line it posted, with no time (it posts none). */
  const built = {
    roles: { bride: { style: 'mermaid' as const }, groom: { style: 'suit' as const } },
    groups: { principal_sponsors: { style: 'barong_tagalog' as const }, bridesmaids: { style: 'long_gown' as const } },
  };
  /* What the draft holds: times set in the Studio — one of them after this tab was opened. */
  const base = {
    roles: { bride: { style: 'mermaid', callTime: '07:45' }, groom: { style: 'suit', callTime: '7' } },
    groups: { principal_sponsors: { style: 'barong_tagalog', callTime: '14:00' }, groomsmen: { style: 'suit', callTime: '12:30' } },
  };
  const kept = carryCallTimes(built, base, { roles: false, groups: false });
  assert.deepEqual(kept.roles.bride, { style: 'mermaid', callTime: '07:45' }, 'the bride’s time is wiped by a Save in the old form');
  assert.deepEqual(kept.groups.principal_sponsors, { style: 'barong_tagalog', callTime: '14:00' });
  assert.deepEqual(kept.roles.groom, { style: 'suit' }, 'a stored junk time is not carried');
  assert.deepEqual(kept.groups.bridesmaids, { style: 'long_gown' }, 'no stored time → none invented');
  assert.equal('groomsmen' in kept.groups, false, 'a line the save does not hold is not brought back by its time');

  /* A poster that still sends a tier's times (an older tab) is read as it sent them — that tier is not overwritten. */
  const sentRoles = { ...built, roles: { bride: { style: 'mermaid' as const, callTime: '08:00' }, groom: { style: 'suit' as const } } };
  const read = carryCallTimes(sentRoles, base, { roles: true, groups: false });
  assert.deepEqual(read.roles.bride, { style: 'mermaid', callTime: '08:00' });
  assert.deepEqual(read.roles.groom, { style: 'suit' });
  assert.deepEqual(read.groups.principal_sponsors, { style: 'barong_tagalog', callTime: '14:00' }, 'the tier that sent none still carries');

  /* Nothing readable to carry from (a first save, a refused read never reaches here) → the lines as posted. */
  assert.deepEqual(carryCallTimes(built, null, { roles: false, groups: false }), built);

  /* And the action runs it on BOTH of its writes — the draft (the Maker) and live (the Mood Board's own page): every
     `const config =` the action builds goes through the carry, with the tier's "did it post times" read from the form. */
  const action = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'studio', 'mood-board', 'dress-code-actions.ts'), 'utf8');
  const builds = action.match(/^\s*const config = .*$/gm) ?? [];
  assert.equal(builds.length, 2, 'precondition: the action builds the config in its two writes');
  for (const line of builds) assert.match(line, /withCallTimesCarried\(/, `a write skips the call-time carry: ${line.trim()}`);
  assert.match(action, /carryCallTimes\(next, base, \{ roles: formData\.has\('role_call_time'\), groups: formData\.has\('group_call_time'\) \}\)/);
});
