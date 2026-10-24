/**
 * GUARD — the guest card's Access: shown everywhere, set from the card only for a LINKED guest, and only through the ONE action.
 *
 * It began (owner 2026-09-28) as a guard on the Guest list's ACCESS column, the
 * roster cell `GuestAccessCell`. That column went (owner 2026-10-07: "remove
 * access column since the access will be inside event details") and the cell
 * went with the retired GuestListMultiselect (2026-10-09).
 * RE-AIMED 2026-10-24 — owner, verbatim: *"Add the Access dropdown on the guest card too."* (superseding, for this case, the
 * 03 Oct "one setter only" rule). What holds now:
 *   1. ONE MECHANISM, TWO DOORS: the card's "Access ▾" (`guest-access-pick.tsx`) and Event Details › People with access call
 *      the SAME action, the SAME way — `setGuestAccess(eventId, guestId, next)` from `guests/[guestId]/access-actions.ts` —
 *      so the same permission check and the same column. No second action anywhere.
 *   2. The dropdown only for a LINKED guest the viewer may manage (never the creator's row); everyone else — an unlinked
 *      guest — sees the word. No "Change in People with access" link on the card line.
 *   3. A refusal puts the pick back and says why; a landed change shows the database's answer, and the action's own
 *      revalidation redraws both doors.
 *   4. The Guest list shows no Access at all.
 * SABOTAGE (each seen RED, then restored): the pick calls a different action · the dropdown offered to an unlinked guest ·
 * the refusal not put back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const CARD_LINE = read('guest-access-control.tsx');
const PAGE = read('..', 'page.tsx');

test('one mechanism, two doors: the card’s Access ▾ and People with access call the SAME action the SAME way', () => {
  const PICK = read('guest-access-pick.tsx');
  const SECTION = read('..', '..', 'details', '_components', 'people-with-access.tsx');
  const ACTION = "import { setGuestAccess } from '";
  // The same action, from the same module.
  assert.match(PICK, /import \{ setGuestAccess \} from '\.\.\/\[guestId\]\/access-actions';/, 'the card’s pick imports a different setter');
  assert.match(SECTION, /import \{ setGuestAccess \} from '@\/app\/dashboard\/\[eventId\]\/guests\/\[guestId\]\/access-actions';/, 'People with access imports a different setter');
  assert.ok(PICK.includes(ACTION) && SECTION.includes(ACTION));
  // The same call.
  for (const [name, src] of [['the card’s pick', PICK], ['People with access', SECTION]] as const) {
    assert.match(src, /await setGuestAccess\(eventId, guestId, next\)/, `${name} calls the setter differently`);
  }
  // The card's pick writes nothing else and defines no action of its own.
  assert.doesNotMatch(PICK, /'use server'|export async function|\.from\(|\.rpc\(/, 'the card’s pick grew its own write');
  // A refusal is put back and said; a landed change shows the database's answer and redraws.
  assert.match(PICK, /if \(!res\.ok\) \{\s*setLevel\(before\);\s*setError\(res\.error\);\s*return;\s*\}/, 'a refused change keeps the look of success');
  assert.match(PICK, /setLevel\(res\.state\.level\);/, 'a landed change does not show the database’s answer');
  // The redraw is the action's own revalidation (the same pages People with access relies on) — never a second render.
  const ACTION_SRC = read('..', '[guestId]', 'access-actions.ts');
  for (const page of ['guests', 'hosts', 'details']) assert.ok(ACTION_SRC.includes(`revalidatePath(\`/dashboard/\${eventId}/${page}\`)`), `the action no longer redraws /${page}`);
  assert.match(PICK, /problem=\{error\}/, 'the refusal is not said on the row');
});

test('the card line: the dropdown only for a LINKED guest the viewer may manage — the word for everyone else, no link out', async () => {
  const CARD = read('guest-access-control.tsx');
  assert.match(CARD, /if \(Pick && linked === true && canManage && initial\.lock !== 'creator'\) \{/, 'the dropdown is offered to an unlinked guest, a viewer, or the creator’s row');
  assert.doesNotMatch(CARD, /setGuestAccess|<PickMenu\b/, 'the card line sets Access itself — only the handed-in pick may');
  assert.doesNotMatch(CARD, /ChangeAccessLink/, 'the card line links out to People with access again');
  assert.match(CARD, /\baccessWordFor\(/, 'the card line lost its words for the three levels');
  assert.match(CARD, /import type \{ GuestAccessPick \} from '\.\/guest-access-pick';/, 'the card line imports the pick for real (the Maker’s first load)');
  // Rendered: a linked guest gets the pick; an unlinked one the word.
  const React = await import('react');
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestAccessControl } = await import('./guest-access-control');
  const Pick = () => React.createElement('span', { 'data-test-pick': '' });
  const base = { eventId: 'e1', guestId: 'g1', firstName: 'Ana', initial: { level: 'none' as const, live: true, lock: null }, canManage: true, Pick };
  assert.match(renderToStaticMarkup(React.createElement(GuestAccessControl, { ...base, linked: true })), /data-test-pick/, 'a linked guest gets no dropdown');
  for (const linked of [false, null]) {
    const html = renderToStaticMarkup(React.createElement(GuestAccessControl, { ...base, linked }));
    assert.doesNotMatch(html, /data-test-pick/, `an unlinked guest (${String(linked)}) is offered the dropdown`);
    assert.match(html, />None</, 'an unlinked guest does not see the word');
  }
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(GuestAccessControl, { ...base, linked: true, canManage: false })), /data-test-pick/, 'a viewer who may not change access is offered it');
  // The pages hand the pick in; the Maker hands none.
  for (const page of [read('..', 'page.tsx'), read('..', '[guestId]', 'page.tsx')]) assert.match(page, /AccessPick=\{GuestAccessPick\}/);
});

test('the Guest list shows NO access at all (owner 2026-10-07: "remove access column since the access will be inside event details")', () => {
  // Maker PR 4f: Access lives in Event Details › People with access, and on the
  // guest's card. The list neither reads it nor draws it.
  assert.doesNotMatch(PAGE, /loadGuestAccessMap\(|accessByGuest/, 'the Guest list page reads Access for the list again');
  const list = PAGE.slice(PAGE.indexOf('<GuestsScreen'), PAGE.indexOf('/>', PAGE.indexOf('<GuestsScreen')));
  assert.doesNotMatch(list, /ccess/, 'the list is handed Access again');
  const SCREEN = read('guests-screen.tsx');
  assert.doesNotMatch(SCREEN, /GuestAccessCell|accessWordFor|GuestAccessState|data-row-access/, 'the list draws an Access word again');
  assert.doesNotMatch(PAGE, /accessTagByGuest/, 'the page still builds the retired tag map');
});
