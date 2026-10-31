/**
 * a-helper-asks-the-hosts.test.ts — 🪪 ASK THE HOSTS: a helper's "Your access" row has ONE press besides its ⓘ, which
 * asks every host — in the app, never by email — for more on one part, landing the hosts on that helper's row.
 *
 * Owner, 2026-10-31: *"yes"* to building "Ask the hosts" (DECISION_LOG "A HELPER SEES THEIR OWN ACCESS AS THE FIRST
 * ROW OF HOME ⚙ EVENT SETTINGS — read-only, with 'Ask the hosts'"); standing: no new emails without his word.
 * The database half (who may ask, once a day, every host told, no email row) is `tests/db/a-helper-asks-the-hosts.db.test.ts`.
 *
 * Held here, as properties:
 *   1 · IN-APP ONLY — `access_more_asked` is a notification kind with its own words, and is on NEITHER the email nor the
 *       push allowlist (parsed from the Set literals, comments stripped);
 *   2 · the parts the door accepts, and the words it writes, are exactly the hosts' own: one per area a host can set
 *       (`areaChoices` ≠ null), each `DELEGATE_AREA_LABEL` — never a second list;
 *   3 · the sheet offers only what could be raised (`askableParts`), and Send calls the ONE door by name with the
 *       event, the part and the note;
 *   4 · rendered: "Your access" draws exactly two presses — the ⓘ and "Ask the hosts" — the button reads
 *       "Asked · <time>" after a Send, and is not drawn when nothing more could be given;
 *   5 · the notice lands on the helper: the address's `person` reaches the ⚙'s landing, which looks for that seat's
 *       row (`data-person-id`, stamped by People with access), and closing drops the words.
 *
 * 🛡 Sabotage (run 2026-10-31, restored → green): `'access_more_asked'` added to EMAIL_ENABLED_TYPES → test 1 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { askableParts, askedTimeLabel, ownAccessOf } from '@/lib/people-with-access';
import { COORDINATOR_AREAS, DELEGATE_AREAS, DELEGATE_AREA_LABEL, areaChoices, type ModeratorPermissions } from '@/lib/delegate-areas';
import { LIMITED_AREAS } from '@/lib/coordinator-access-level';
import { NOTIFICATION_TYPE_LABEL } from '@/lib/notifications';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '../../../..');
const REPO = join(WEB, '../..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const DOOR = 'supabase/migrations/20271299854365_a_helper_asks_the_hosts_for_more.sql';
const perms = (areas: ModeratorPermissions['areas']): ModeratorPermissions =>
  ({ edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas }) as ModeratorPermissions;
const DAY = { eventDate: '2026-12-18', eventEndDate: null, precision: 'day' } as const;

/** The members of one `new Set([...])` literal in notification-emit.ts, comments stripped. */
function setMembers(name: string): string[] {
  const src = code('lib/notification-emit.ts');
  const at = src.indexOf(`const ${name}`);
  assert.ok(at >= 0, `${name} is gone — this check would pass vacuously`);
  const body = src.slice(at, src.indexOf(']);', at));
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

test('1 · the ask is IN-APP ONLY — its own kind, on neither the email nor the push allowlist', () => {
  assert.equal(NOTIFICATION_TYPE_LABEL.access_more_asked, 'A helper asks for more access');
  const email = setMembers('EMAIL_ENABLED_TYPES');
  const push = setMembers('PUSH_ENABLED_TYPES');
  assert.ok(email.length > 10 && push.length > 2, 'the allowlists did not parse — this check would pass vacuously');
  assert.ok(!email.includes('access_more_asked'), 'an ask emails the hosts — the owner said no new emails without his word');
  assert.ok(!push.includes('access_more_asked'), 'an ask buzzes the hosts’ phones');
  // The kind exists in Postgres (a TS-only member typechecks and is then refused in silence).
  const enumFile = readFileSync(join(REPO, 'supabase/migrations/20271299515167_access_more_asked_notification_type.sql'), 'utf8');
  assert.match(enumFile, /ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'access_more_asked';/);
  // The door writes notices directly — never through emitNotification, which is where email starts.
  const door = readFileSync(join(REPO, DOOR), 'utf8');
  assert.match(door, /INSERT INTO public\.notifications \(user_id, type, title, body, related_url, event_id\)/);
  assert.doesNotMatch(door.replace(/--.*$/gm, ''), /email_deliveries|net\.http|pg_net/, 'the door reaches for email');
});

test('2 · the door accepts exactly the parts a host can set, in the hosts’ own words', () => {
  const door = readFileSync(join(REPO, DOOR), 'utf8');
  const caseAt = door.indexOf('v_part := CASE p_area');
  assert.ok(caseAt >= 0, 'the door’s part list is gone — this check would pass vacuously');
  const block = door.slice(caseAt, door.indexOf('END;', caseAt));
  const inDoor = Object.fromEntries([...block.matchAll(/WHEN '([a-z_]+)'\s+THEN '([^']+)'/g)].map((m) => [m[1]!, m[2]!]));
  const settable = DELEGATE_AREAS.filter((a) => areaChoices(a) !== null);
  assert.deepEqual(Object.keys(inDoor).sort(), [...settable].sort(), 'the door accepts a part a host cannot set, or refuses one they can');
  for (const a of settable) assert.equal(inDoor[a], DELEGATE_AREA_LABEL[a], `the door names ${a} differently from the hosts’ row`);
});

test('3 · the sheet offers only what could be raised, and Send calls the ONE door', () => {
  const limited = ownAccessOf({ roleSubtype: 'viewer', permissions: perms({ ...LIMITED_AREAS }), window: DAY });
  const asked = askableParts(limited.areas).map((c) => c.area);
  assert.ok(!asked.includes('invitations'), 'Event Hub has no setting, yet it is offered');
  assert.ok(asked.includes('guest_list') && asked.includes('seat_plan'), 'a limited helper (every part View) cannot ask about the guest list');
  for (const c of askableParts(limited.areas)) {
    assert.ok(c.choices && c.choices.some((x) => (x === 'edit' ? 2 : x === 'view' ? 1 : 0) > (c.choice === 'edit' ? 2 : c.choice === 'view' ? 1 : 0)), `${c.area} is offered at its highest level`);
  }
  const coordinator = ownAccessOf({ roleSubtype: 'wedding_planner_external', permissions: perms({ ...COORDINATOR_AREAS }), window: DAY });
  assert.ok(!askableParts(coordinator.areas).some((c) => c.choice === 'edit'), 'a part already at Edit is offered');

  const sheet = code('app/dashboard/[eventId]/details/_components/ask-the-hosts.tsx');
  assert.match(sheet, /\.rpc\('ask_hosts_for_more_access', \{\s*p_event_id: eventId,\s*p_area: part,\s*p_note:/, 'Send does not call the door with the event, the part and the note');
  assert.match(sheet, /<Sheet open onClose=\{\(\) => setOpen\(false\)\}/, 'the ask is not the house Sheet');
  assert.match(sheet, /<PickMenu\b[\s\S]*?options=\{options\}/, 'the part is not one PickMenu');
  assert.match(sheet, /const parts = askableParts\(areas\)/, 'the sheet offers its own list of parts');
  // A save never resets the screen: a sent ask closes the sheet in place and keeps the time — no navigation, no refresh.
  const ok = sheet.slice(sheet.indexOf("r.status === 'ok'"), sheet.indexOf("r.status === 'already_asked'"));
  assert.match(ok, /setAskedAt\(r\.asked_at\)[\s\S]*setOpen\(false\)/, 'a sent ask does not close the sheet with its time');
  assert.doesNotMatch(sheet, /router\.(push|replace|refresh)|location\.(assign|reload)|revalidatePath/, 'Send resets the screen');
  assert.doesNotMatch(sheet, /^\s*['"]use server['"]/m);
});

test('4 · rendered: two presses — the ⓘ and Ask the hosts — "Asked · <time>" after a Send, none when nothing is left', async () => {
  const { YourAccess } = await import('../details/_components/your-access');
  const buttons = (html: string) => (html.match(/<button\b/g) ?? []).length;
  const limited = ownAccessOf({ roleSubtype: 'viewer', permissions: perms({ ...LIMITED_AREAS }), window: DAY });

  const fresh = renderToStaticMarkup(createElement(YourAccess, { access: limited, eventId: 'e1' }));
  assert.equal(buttons(fresh), 2, 'Your access draws a press besides the ⓘ and Ask the hosts');
  assert.match(fresh, /data-testid="ask-the-hosts"[^>]*>[\s\S]*?Ask the hosts/, 'the button does not say Ask the hosts');
  assert.doesNotMatch(fresh, /data-ask-the-hosts-sheet/, 'the sheet is drawn before it is pressed');

  const at = '2026-10-31T15:04:00+08:00';
  const sent = renderToStaticMarkup(createElement(YourAccess, { access: limited, eventId: 'e1', askedAt: at }));
  assert.match(sent, /data-testid="ask-the-hosts"[^>]*>[\s\S]*?Asked · /, 'after a Send the button does not say it was asked');
  assert.doesNotMatch(sent, />Ask the hosts</, 'after a Send the button still says Ask the hosts');
  assert.match(askedTimeLabel(at, new Date('2026-10-31T20:00:00+08:00')), /^3:04\s?(PM|pm)$/, 'an ask today does not read as its time');
  assert.match(askedTimeLabel(at, new Date('2026-11-02T09:00:00+08:00')), /^Oct 31$/, 'an older ask does not read as its day');

  // Every part already as high as a host could set it → nothing to ask, no button.
  const full = { ...limited, areas: limited.areas.map((c) => ({ ...c, choice: c.choices ? c.choices[0]! : c.choice })) };
  assert.equal(askableParts(full.areas).length, 0);
  assert.equal(buttons(renderToStaticMarkup(createElement(YourAccess, { access: full, eventId: 'e1' }))), 1, 'Ask the hosts is drawn with nothing to ask for');
});

test('5 · the notice lands on the helper: `person` reaches the ⚙, which finds that seat’s row', () => {
  const page = code('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /person: search\.settings === '1' && isUuid\(search\.person\) \? search\.person : null/, 'Home ignores the notice’s person');
  assert.match(code('app/dashboard/[eventId]/_components/home-cover-band.tsx'), /landPerson=\{settingsLink\?\.person \?\? null\}/);
  const gear = code('app/dashboard/[eventId]/_components/home-settings-gear.tsx');
  assert.match(gear, /const LINK_WORDS = \[[^\]]*'person'[^\]]*'part'[^\]]*\]/, 'closing the sheet leaves the notice’s words on the address');
  assert.match(gear, /\[data-person-id="\$\{CSS\.escape\(person\)\}"\]/, 'the ⚙ does not look for the helper’s row');
  assert.match(code('app/dashboard/[eventId]/details/_components/people-with-access.tsx'), /data-person-id=\{row\.moderatorId \?\? undefined\}/, 'People with access does not stamp a seat on its row');
  // …and the door's link is that shape: the sheet, its access row, the seat.
  const door = readFileSync(join(REPO, DOOR), 'utf8');
  assert.match(door, /'\?settings=1&row=access&person=' \|\| v_seat\.moderator_id::TEXT/);
});

test('6 · the hosts see the ask on that helper’s row — read from their own notices, parsed from the door’s link', async () => {
  const { asksBySeat, askedRowWords } = await import('@/lib/people-with-access');
  const seat = '00000000-0000-4000-8000-0000000b0002';
  const url = (part: string) => `/dashboard/e1?settings=1&row=access&person=${seat}&part=${part}`;
  const asks = asksBySeat([
    { related_url: url('seat_plan'), created_at: '2026-10-31T07:04:00Z' },
    { related_url: url('guest_list'), created_at: '2026-10-30T07:04:00Z' },
    { related_url: url('seat_plan'), created_at: '2026-10-29T07:04:00Z' },
    { related_url: '/dashboard/e1?settings=1&row=access', created_at: '2026-10-31T08:00:00Z' },
    { related_url: url('everything'), created_at: '2026-10-31T09:00:00Z' },
  ]);
  assert.deepEqual([...asks.keys()], [seat], 'a link of another shape was read as an ask');
  assert.deepEqual(asks.get(seat), { areas: ['seat_plan', 'guest_list'], at: '2026-10-31T07:04:00Z' }, 'the newest ask, each part once');
  assert.match(askedRowWords(asks.get(seat)!, new Date('2026-10-31T12:00:00Z')), /^Asked for more · Seat plan, Guest list · 3:04\s?(PM|pm)$/);

  const server = code('lib/people-with-access.server.ts');
  assert.match(
    server,
    /\.from\('notifications'\)\s*\.select\('related_url, created_at'\)\s*\.eq\('event_id', eventId\)\s*\.eq\('user_id', viewerUserId\)\s*\.eq\('type', 'access_more_asked'\)/,
    'the hosts’ rows do not read the viewer’s OWN asks on this event',
  );
  assert.match(server, /if \(asksRes\.error\) logQueryError\(/, 'a refused asks read is dropped in silence');
  const row = code('app/dashboard/[eventId]/details/_components/people-with-access.tsx');
  assert.match(row, /\{row\.asked \? \(\s*<p[^>]*data-person-asked=""[^>]*>\s*\{askedRowWords\(row\.asked\)\}/, 'the helper’s row does not say what they asked for');
});
