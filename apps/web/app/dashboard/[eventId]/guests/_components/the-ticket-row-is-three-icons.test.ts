/**
 * the-ticket-row-is-three-icons.test.ts — THE GUEST CARD'S ONE SEND BUTTON, AND ITS TICKET ROW.
 *
 * ⚠ THE NAME IS HISTORY. The 27–28 Oct ruling this file was written for ("GUEST CARD TICKET ROW = THREE ICON BUTTONS: SHARE ·
 * NFC · NEW QR") was replaced by the owner-approved drawing `guests_redesign_2026-11-20_fable.html` § 3 ("Yes, build it",
 * DECISION_LOG 2026-11-20 "GUESTS REDESIGN: BUILD IT"): *"Four quick actions with words: Send invite · Call · Seat · Note"* ·
 * *"The ticket is one row you tap to view, with its state in words"* · *"NFC and New QR icons, ⋯ Unlink account → labelled
 * buttons inside the opened ticket"* · *"Share icon on the ticket → the 'Send invite' quick action"*. What it holds now:
 *
 * The RENDERED card (the real `GuestCardBody` with the real Invite cell, ticket and its buttons handed in):
 *   1. the quick row: Send invite (the ONE filled button) · Add mobile · Seat · Note, in that order; then "Their ticket", one
 *      row wearing "Not sent yet · Not linked"; no NFC / New QR / ⋯ icon outside the ticket; no big "Invite ▾".
 *   2. Send invite is the card's ONE sender (`cardSend`): a phone opens the phone's share sheet at once, message + ticket
 *      (owner 2026-11-26, replacing 2026-11-05's "always our menu"); a computer — or a sheet that refuses — gets our menu.
 *   3. New QR asks first, in the ruled words, and posts the shipped `releaseGuestClaim` › `new_qr` door.
 *   4. NFC · New QR · Unlink are labelled buttons, handed INTO the opened ticket — NFC the shipped writer, Unlink only while linked.
 *
 * SABOTAGE (seen red): a second filled button in the quick row → test 1; drop the Seat quick action → test 1; point Send
 * invite at `invite('body')` → test 2; `iconOnly` back on the NFC writer → test 4; stop handing `tools` to the ticket → test 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import type { GuestRow } from '@/lib/guests';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_ticket_row__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
// The shipped NFC writer is behind its flag; on for this render.
process.env.NEXT_PUBLIC_NFC_WRITE_ENABLED = 'true';

const HERE = dirname(fileURLToPath(import.meta.url));
const CELL = stripComments(readFileSync(join(HERE, 'guest-invite-cell.tsx'), 'utf8'));
const PARTS = stripComments(readFileSync(join(HERE, 'guest-ticket-parts.tsx'), 'utf8'));
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-cita', event_id: 'e1', first_name: 'Cita', last_name: 'Ramos', name_prefix: null, middle_name: null, name_suffix: null, display_name: null,
    role: 'guest', side: 'bride', rsvp_status: 'attending', group_category: 'other', meal_preference: 'no_preference', dietary_restrictions: null,
    invited_to_blocks: [], custom_tags: [], extra_roles: [], plus_one_allowed: false, plus_one_count: 0, photo_consent: false, faceblock_enabled: false,
    face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null, relation: null, email: null, notes: null, guest_note: null,
    qr_token: 'tok', mobile: null, entry_source: 'host_seeded', invitation_sent_at: null,
    ...over,
  } as unknown as GuestRow;
}
const BASE = {
  isCouple: false, hasSides: true, availableRoles: ['guest'], groupOptions: ['family', 'other'], isIncWedding: true, showTeaCeremony: true,
  plusOneLines: [], plusOneGuestId: null, initialInvited: ['ceremony'], seatedAt: null, customGroups: [], recordedAt: 'Sep 12', access: null,
  canManageAccess: true, offersThisIsMe: false, nameLinked: false, linkedAccount: null, profileName: null, roleNames: {},
  tables: [], seatTableId: null, groupChoices: { options: [], memberIds: [] },
};

async function paint(data: Record<string, unknown> = {}, over: Partial<GuestRow> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { GuestCardBody } = await import('./guest-card-body');
  const { GuestInviteCell } = await import('./guest-invite-cell');
  const { GuestMoreMenu, GuestTicketThumb } = await import('./guest-ticket-parts');
  const { TEMPLATE_KIT } = await import('./guest-card-template-kit');
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data: { ...BASE, ...data, guest: guest(over) }, invitationBase: 'https://www.setnayan.com/cale-and-ice', photoDisplayUrl: null,
    variant: 'panel', headerShown: true, returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null,
    inviteSetup: { facts: { hostsName: 'Cale & Ice', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' }, template: null, slug: 'x' },
    SendInvite: GuestInviteCell, TicketThumb: GuestTicketThumb, MoreMenu: GuestMoreMenu, kit: TEMPLATE_KIT,
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, React.createElement(ToastProvider as React.FC<{ children: React.ReactNode }>, null, card)));
}

const BODY = stripComments(readFileSync(join(HERE, 'guest-card-body.tsx'), 'utf8'));

/** The quick row's controls, in order, by their spoken names. */
function quickRow(html: string): string {
  const at = html.indexOf('data-guest-quick-actions=""');
  assert.ok(at > 0, 'the card has no quick actions');
  return html.slice(at, html.indexOf('data-guest-ticket-thumb=', at));
}
const names = (row: string) => [...row.matchAll(/<(?:button|a)\b[^>]*aria-label="([^"]+)"[^>]*>/g)].map((m) => m[1]!);

test('1 · the RENDERED card: Send invite · Add mobile · Seat · Note, then "Their ticket" as one row with its state in words', async () => {
  const unlinked = await paint();
  const row = quickRow(unlinked);
  assert.deepEqual(names(row), ['Send invite to Cita Ramos', 'Add mobile for Cita Ramos', 'Seat — Cita Ramos', 'Note — Cita Ramos']);
  const tags = row.match(/<(?:button|a)\b[^>]*>/g) ?? [];
  assert.match(tags[0]!, /class="ab ab-brand[^"]*\bab-main\b/, 'Send invite is not the filled forward step');
  for (const b of tags.slice(1)) assert.match(b, /class="ab ab-neutral\b/, `a quick action is not the neutral button: ${b.slice(0, 120)}`);
  for (const word of ['Send invite', 'Add mobile', 'Seat', 'Note']) assert.match(row, new RegExp(`<span class="lbl">${word}</span>`), `"${word}" lost its word`);
  // With a saved mobile the second action is the call itself.
  assert.match(quickRow(await paint({}, { mobile: '+639171234567' })), /<a\b[^>]*href="tel:[^"]+"[^>]*aria-label="Call Cita Ramos"|aria-label="Call Cita Ramos"[^>]*href="tel:/, 'a saved mobile does not make it Call');
  // The ticket: ONE row, a button, its state in words.
  const ticket = unlinked.slice(unlinked.indexOf('data-guest-ticket-thumb='), unlinked.indexOf('data-guest-card-groups='));
  assert.match(ticket, />Their ticket</);
  assert.match(ticket, /data-guest-invite-status="">Not sent yet · Not linked</, 'the ticket row does not say its state in words');
  assert.doesNotMatch(unlinked, /aria-label="Invite Cita Ramos|data-caret|data-guest-ticket-row=/, 'the old Invite ▾ / icon row is still on the card');
  assert.doesNotMatch(unlinked, /More for Cita Ramos|aria-label="Make a new QR for|aria-label="Write Cita/, 'an NFC / New QR / ⋯ icon is still outside the ticket');
});

test('2 · Send invite is the card’s ONE sender — a phone’s share sheet at once (owner 2026-11-26), else our menu', () => {
  const card = CELL.slice(CELL.lastIndexOf("if (layout === 'card') {"));
  const body = card.slice(0, card.indexOf('\n  }\n'));
  assert.match(body, /label="Send invite"[\s\S]*?onClick=\{\(\) => cardSend\('body'\)\}/, 'the card’s Send invite does not run cardSend');
  assert.equal((body.match(/\bmain\b/g) ?? []).length, 1, 'the quick row has more than one filled step');
  assert.doesNotMatch(body, /invite\('body'\)|caret/, 'the card still opens the old Invite sheet / draws the Invite ▾');
  const fn = CELL.slice(CELL.indexOf('async function cardSend('));
  const send = fn.slice(0, fn.indexOf('\n  }\n'));
  // A phone: the ONE share (message + ticket), at once — and an app taking it is the send.
  assert.match(send, /if \(!isTouchDevice\(\) \|\| file === undefined\) return rowShare\(at\);/, 'a computer (or a ticket still on its way) does not get our menu');
  assert.match(send, /await shareInvite\(file, message\)/, 'a phone’s Send invite does not open the phone’s share sheet');
  assert.match(send, /if \(out === 'shared'\) return mark\(true\);/, 'an app taking it does not stamp Sent ✓');
  assert.match(send, /if \(out === 'closed'\) return;\s*rowShare\(at\);/, 'a refused sheet is a dead tap — it must fall back to our menu');
  assert.doesNotMatch(send, /navigator\.share|nav\.share/, 'a second share path — `shareInvite` is the one share');
  // The ticket must be in hand BEFORE the tap on the one open card — a share sheet opens only inside the tap.
  assert.match(CELL, /if \(layout === 'card'\) setCardPhone\(isTouchDevice\(\)\);/, 'the card does not know it is on a phone until the tap');
  assert.match(CELL, /\(\(open && touch\) \|\| cardPhone\) && Boolean\(guest\.inviteUrl\)/, 'the card’s ticket is not fetched ahead of the tap');
  const fn2 = CELL.slice(CELL.indexOf('function rowShare('));
  const share = fn2.slice(0, fn2.indexOf('\n  }\n'));
  assert.match(share, /invite\(at\);\s*setTouch\(false\);/, 'our menu no longer draws the app rows');
  assert.match(CELL, /data-invite-apps=""/, 'the computer’s app rows are gone');
});

test('3 · New QR asks first, in the ruled words, and posts the shipped new_qr door', () => {
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('));
  assert.match(menu, /icon=\{RotateCw\}\s*label="New QR"[\s\S]*?onClick=\{\(\) => setConfirm\('new_qr'\)\}/, 'New QR does not ask first');
  assert.match(menu, /Their old QR and link will stop working\. Anyone holding the old one — a printed pass, a forwarded\s+message — won&rsquo;t get in\./);
  assert.match(menu, /<input type="hidden" name="new_qr" value="1" \/>/);
  assert.match(menu, /const release = releaseGuestClaim\.bind\(null, eventId, guestId\);/, 'New QR left the shipped token-rotation door');
});

test('4 · NFC · New QR · Unlink are labelled buttons inside the opened ticket', () => {
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('), PARTS.indexOf('export function GuestDeleteControl('));
  assert.match(menu, /<NfcWriteButton url=\{nfcUrl\} worded name=/, 'NFC is not the shipped writer with its word');
  assert.doesNotMatch(menu, /iconOnly|role="menu"|MoreHorizontal/, 'an icon-only button or the ⋯ list is back');
  assert.match(menu, /\{linked \? \([\s\S]*?label="Unlink account"[\s\S]*?onClick=\{\(\) => setConfirm\('unlink'\)\}/, 'Unlink is not a labelled button drawn only while linked');
  // …and they are INSIDE the opened ticket: the card hands them to the ticket, which draws them in its view.
  assert.match(BODY, /<TicketThumb[\s\S]*?tools=\{more\}/, 'the card does not hand the buttons to the ticket');
  const thumb = PARTS.slice(PARTS.indexOf('export function GuestTicketThumb('), PARTS.indexOf('export function GuestMoreMenu('));
  const view = thumb.slice(thumb.indexOf('<GuestPopup'));
  assert.match(view, /data-guest-ticket-tools="">\s*\{tools\}/, 'the opened ticket does not draw the buttons');
  assert.doesNotMatch(thumb.slice(0, thumb.indexOf('<GuestPopup')), /\{tools\}/, 'the buttons are drawn on the row, outside the opened ticket');
});
