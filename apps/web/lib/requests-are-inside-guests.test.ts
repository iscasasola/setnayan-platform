/**
 * 📥 REQUESTS INSIDE GUESTS (R4 slice 11; HANDOVER "SLICES 9–11": *"Requests inside Guests"*; prototype `SHOW` —
 * "Asking to join" is a Show of the List, with Accept · Decline in place and Undo).
 *
 * Rule 0: nothing is redrawn. The List draws the SHIPPED Requests page in place — `guests/claims/page.tsx` with `maker=1`,
 * the very way the Event Hub Maker draws it (each Accept · Decline · Link revalidates and stays put, with its Undo).
 *
 * The PROPERTIES:
 *   1. The page streams it for the couple only, while someone is asking (or the address asks, `?gshow=requests`).
 *   2. The Total card's door opens it in place (no navigation); without it the door is the Requests page as before.
 *   3. The List's ⇅ offers "Asking to join · N" INSIDE Show (right after its last choice), one ✓ in Show; any other
 *      filter pick goes back to everyone.
 *   4. Rendered: asking → the head "Asking to join · N" + Everyone, then the Requests body, and no guest rows; the couple
 *      with nobody waiting (no body — a MEASURED zero) gets the frame saying so, never the guest rows.
 *   5. 🔒 ACCEPT · DECLINE STAY IN GUESTS (owner 2026-10-31): drawn inside Guests (`maker=guests`) the rows post through
 *      `DecideForm` to ONE in-place door (`decideRequestInPlace`) that ANSWERS — a refusal comes back in words, nothing
 *      redirects; the page's own forms keep their `?error=` / `?done=` exactly as before.
 *   6. Done → the row is kept in Guests ("Accepted · just now"), the toast carries Undo, and Undo takes it back; a refusal
 *      or a failed call is said in the toast and the row stays a request.
 *   7. The ⚙'s Requests row opens Asking to join IN PLACE on the Guests screen (closes the sheet, the List forward).
 *
 * SABOTAGE (each seen RED, then restored): `maker: '1'` dropped · the door's preventDefault dropped · `setAsking(false)`
 * dropped from pickFilter · the splice index at the end of the menu · `back()` redirecting again · the in-place door
 * keeping `from` · `noteDecided` dropped from a success · the Undo's `forgetDecided` dropped · the ⚙ row's preventDefault
 * dropped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { NO_GUESTS_FILTER } from '@/lib/guests-filter';
import { guestsFilterMenu } from '@/app/dashboard/[eventId]/guests/_components/guests-filter-menu';
import { guestRow, renderGuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/render-guests-screen';
import { decideInPlace } from '@/app/dashboard/[eventId]/guests/claims/decide-in-place';
import { clearDecided, DECIDED_LINE, decidedRequests } from '@/app/dashboard/[eventId]/guests/_components/requests-decided';
import { dismissUndo, getUndoToast, runUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import type { RequestInPlace } from '@/app/dashboard/[eventId]/guests/claims/actions';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('1 · the page streams the shipped Requests page, in place, for the couple while someone asks', () => {
  const page = src('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(page, /import RequestsPage from '\.\/claims\/page';/);
  assert.match(page, /requestsInPlace=\{viewer\.isCouple\}/, 'the couple cannot open Asking to join in place');
  // An unread count streams the body (it says so itself); only a MEASURED zero is drawn without it.
  assert.match(page, /requestsBody=\{\s*viewer\.isCouple && \(pendingClaimsCount > 0 \|\| pendingClaims\.error !== null \|\| search\.gshow === 'requests'\) \?/);
  assert.match(page, /<RequestsPage params=\{Promise\.resolve\(\{ eventId \}\)\} searchParams=\{Promise\.resolve\(\{ maker: 'guests' \}\)\} \/>/, 'not drawn in place, answering in Guests (maker=guests)');
  assert.match(page, /initialAsking=\{search\.gshow === 'requests'\}/);
});

test('2 · the Total card’s door opens it in place; without it, the Requests page as before', () => {
  const screen = src('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  // The address stays the Requests page (a new tab or no script still lands there); the tap opens them in place.
  assert.match(screen, /href=\{`\/dashboard\/\$\{eventId\}\/guests\/claims`\}[^>]*data-requests-door=""\s*onClick=\{\s*requestsInPlace/);
  assert.match(screen, /requestsInPlace\s*\? \(e\) => \{\s*e\.preventDefault\(\);\s*openAsking\(\);/, 'the door navigates away');
  assert.match(screen, /const pickFilter = \(next: GuestsFilter\) => \{\s*closeAsking\(\);/, 'a filter pick keeps the requests up');
  assert.match(screen, /const closeAsking = \(\) => \{\s*setAsking\(false\);\s*clearDecided\(\);/, 'leaving Asking to join keeps stale decided rows');
});

test('3 · "Asking to join · N" sits inside Show, with the one ✓', () => {
  const menu = guestsFilterMenu({
    view: 'list',
    filter: NO_GUESTS_FILTER,
    onFilter: () => {},
    hasSides: true,
    showExtras: [{ key: 'asking', label: 'Asking to join · 3', group: 'Show', trail: { text: '✓', tone: 'ok', label: 'shown now' } }],
    extras: [{ key: 'select', label: 'Select…', group: 'List' }],
  }).menu;
  const at = menu.findIndex((o) => o.key === 'asking');
  assert.ok(at > 0 && menu[at - 1]!.group === 'Show' && menu[at + 1]!.group !== 'Show', 'Asking to join is not the end of Show');
  assert.equal(menu.filter((o) => o.group === 'Show' && o.trail).map((o) => o.key).join(), 'asking', 'Show carries two ✓');
  assert.equal(menu.at(-1)!.key, 'select');
});

test('4 · rendered: asking → the head, the Requests body, no guest rows', async () => {
  const body = React.createElement('div', { 'data-requests-page': '' }, 'REQUESTS BODY');
  const on = await renderGuestsScreen({ guests: [guestRow({ guest_id: 'g1' })], requests: 3, requestsBody: body, initialAsking: true });
  assert.match(on, /data-guests-asking=""/);
  assert.match(on, /Asking to join · /);
  assert.match(on, /REQUESTS BODY/);
  assert.doesNotMatch(on, /data-guest-row=""/, 'the guest rows draw under the requests');
  const off = await renderGuestsScreen({ guests: [guestRow({ guest_id: 'g1' })], requests: 3, requestsBody: body });
  assert.doesNotMatch(off, /REQUESTS BODY/);
  assert.match(off, /data-guest-row=""/);
  // No body handed in (not the couple) → never "asking", whatever the address says.
  const none = await renderGuestsScreen({ guests: [guestRow({ guest_id: 'g1' })], requests: 3, initialAsking: true });
  assert.doesNotMatch(none, /data-guests-asking/);
  // The couple, nobody waiting (a measured zero — no body streamed): the frame says so, never the guest rows.
  const zero = await renderGuestsScreen({ guests: [guestRow({ guest_id: 'g1' })], requests: 0, requestsInPlace: true, initialAsking: true });
  assert.match(zero, /data-guests-asking=""/);
  assert.match(zero, /data-requests-none=""[^>]*>Nobody is waiting\./);
  assert.doesNotMatch(zero, /data-guest-row=""/);
});

test('5 · inside Guests the rows answer in place — one door that never redirects; the page keeps its own', () => {
  const actions = src('app/dashboard/[eventId]/guests/claims/actions.ts');
  const body = (sig: string) => {
    const at = actions.indexOf(sig);
    assert.ok(at >= 0, `actions.ts lost ${sig}`);
    const end = actions.indexOf('\n}\n', at);
    return actions.slice(at, end);
  };
  // A refusal is THROWN, never a redirect — so whoever asked answers it.
  assert.match(body('function back('), /throw new RequestRefused\(message\);/);
  assert.doesNotMatch(body('function back('), /redirect\(/, 'a refusal navigates again');
  // The page's forms: a refusal → `?error=` on the Requests page, as before.
  assert.match(body('async function onThePage('), /if \(e instanceof RequestRefused\) redirect\(`\/dashboard\/\$\{eventId\}\/guests\/claims\?error=\$\{encodeURIComponent\(e\.message\)\}`\);/);
  for (const door of ['keepGuestAction', 'removeGuestAction', 'linkGuestAction', 'undoRequestAction']) {
    assert.match(body(`export async function ${door}(`), /await onThePage\(eventId,/, `${door} no longer answers on the page`);
  }
  // In place: the helper gate in words as the door's first line, `from` dropped (no success redirect), every refusal RETURNED.
  const inPlace = body('async function inPlace(');
  assert.match(
    body('export async function decideRequestInPlace('),
    /\{\s*const helperRefusal = await limitedHelperRefusal\(eventId, 'guest_list'\);\s*if \(helperRefusal\) return \{ ok: false, error: helperRefusal \};/,
    'the in-place door does not ask the limited-helper gate first',
  );
  assert.match(inPlace, /formData\.delete\('from'\);/, 'the in-place door can still take the page’s success redirect');
  assert.match(inPlace, /if \(e instanceof RequestRefused\) return \{ ok: false, error: e\.message \};/);
  const door = body('export async function decideRequestInPlace(');
  assert.match(door, /return inPlace\(formData,/);
  for (const b of [inPlace, door]) assert.doesNotMatch(b, /redirect\(/, 'the in-place door redirects');
  assert.match(actions, /const IN_PLACE = \{ keep: keepRequest, decline: declineRequest, link: linkRequest, 'undo-accept': undoAccept, 'undo-decline': undoDecline \} as const;/);
  // The Undos no longer end in a redirect of their own — only the page's door adds it.
  for (const core of ['async function undoAccept(', 'async function undoDecline(']) assert.doesNotMatch(body(core), /redirect\(/, `${core} redirects inside Guests`);

  // The Requests page: drawn inside Guests, all three verbs post through DecideForm, and each row is a DecideRow.
  const page = src('app/dashboard/[eventId]/guests/claims/page.tsx');
  assert.match(page, /const inGuests = maker === 'guests';\s*const inMaker = maker === '1' \|\| inGuests;/);
  assert.match(page, /inGuests \? \(\s*<DecideForm act=\{decideInGuests\} verb=\{verb\} guestId=\{guestId\} name=\{name\} className=\{className\}>/);
  assert.match(page, /const decideInGuests = decideRequestInPlace\.bind\(null, eventId\);/);
  for (const verb of ['keep', 'decline', 'link']) assert.match(page, new RegExp(`\\{rowForm\\(\\s*'${verb}',`), `${verb} is not a row form`);
  assert.doesNotMatch(page, /<form action=\{(?:keepGuestAction|removeGuestAction|linkGuestAction)\.bind/, 'a row form skips the in-place choice');
  assert.match(page, /return inGuests \? \(\s*<DecideRow key=\{g\.guest_id\} guestId=\{g\.guest_id\}>/);
});

test('6 · done → the row is kept in Guests with Undo; refused → said in the toast, the row stays a request', async () => {
  const calls: Record<string, string>[] = [];
  const fake = (answers: RequestInPlace[]) => async (fd: FormData): Promise<RequestInPlace> => {
    calls.push(Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])));
    return answers.shift() ?? { ok: true };
  };
  clearDecided();
  dismissUndo();
  // ACCEPT, done.
  const fd = new FormData();
  fd.set('guest_id', 'g-req-1');
  await decideInPlace(fake([{ ok: true }]), 'keep', 'g-req-1', 'Rowena Dizon', fd);
  assert.equal(calls.at(-1)!.do, 'keep');
  const toast = getUndoToast();
  assert.ok(toast && toast.kind === 'undo', 'Accept dropped no toast with Undo');
  assert.equal(toast.kind === 'undo' && toast.label, 'Accepted Rowena Dizon');
  assert.deepEqual(decidedRequests(), [{ guestId: 'g-req-1', name: 'Rowena Dizon', kind: 'accepted' }], 'the accepted row left Guests');
  // UNDO → the in-place door's undo verb, and the row is a request again.
  await runUndo();
  assert.deepEqual(calls.at(-1), { do: 'undo-accept', guest_id: 'g-req-1' });
  assert.deepEqual(decidedRequests(), [], 'Undo left the row decided');

  // DECLINE, refused → the words in the toast; the row stays a request.
  await decideInPlace(fake([{ ok: false, error: 'We could not close their request — nothing was removed. Try again.' }]), 'decline', 'g-req-2', 'Mark Ignacio', new FormData());
  const said = getUndoToast();
  assert.ok(said && said.kind === 'say' && said.tone === 'bad' && /could not close their request/.test(said.words), 'a refusal was not said in Guests');
  assert.deepEqual(decidedRequests(), [], 'a refused Decline was drawn as decided');

  // A call that throws (the network, a crash) → plain words, nothing decided.
  await decideInPlace(async () => {
    throw new Error('boom');
  }, 'decline', 'g-req-2', 'Mark Ignacio', new FormData());
  const plain = getUndoToast();
  assert.ok(plain && plain.kind === 'say' && plain.words === 'That did not save — nothing changed. Try again.');

  // DECLINE, done → its own Undo verb.
  await decideInPlace(fake([{ ok: true }]), 'decline', 'g-req-2', 'Mark Ignacio', new FormData());
  assert.equal(decidedRequests()[0]!.kind, 'declined');
  assert.match(DECIDED_LINE.declined, /^Declined · just now/);
  await runUndo();
  assert.equal(calls.at(-1)!.do, 'undo-decline');

  // LINK, done → kept, said — no Undo (there is no undo for a merge).
  await decideInPlace(fake([{ ok: true }]), 'link', 'g-req-3', 'Shiela Panganiban', new FormData());
  const linked = getUndoToast();
  assert.ok(linked && linked.kind === 'say' && linked.words === 'Linked Shiela Panganiban');
  assert.equal(decidedRequests()[0]!.kind, 'linked');
  clearDecided();
  dismissUndo();
});

test('7 · the ⚙’s Requests row opens Asking to join in place on the Guests screen', () => {
  const rows = src('app/dashboard/[eventId]/_components/guest-setup/guest-setup-rows.tsx');
  assert.match(rows, /const openRequests = useOpenRequests\(\);/);
  assert.match(rows, /href=\{setupDoorHref\(eventId, 'requests'\)\}\s*onClick=\{\s*openRequests\s*\? \(e(?:: MouseEvent<HTMLAnchorElement>)?\) => \{\s*e\.preventDefault\(\);\s*openRequests\(\);/, 'the ⚙ row still leaves Guests');
  const screen = src('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  const open = screen.match(/const openRequests = \(\) => \{([\s\S]*?)\n {2}\};/)?.[1] ?? '';
  assert.ok(open, 'the screen has no openRequests');
  assert.match(open, /openSettings\(false\)/, 'the ⚙ sheet stays open over the requests');
  assert.match(open, /if \(gview !== 'list'\) pickView\('list'\);/, 'Asking to join opens under another view');
  assert.match(open, /setAsking\(true\)/);
  assert.match(screen, /<OpenRequestsContext\.Provider value=\{requestsInPlace && !writesOff \? openRequests : null\}>\s*<MenuSettingsButton menu="guests"/, 'the ⚙ rows cannot reach openRequests');
});
