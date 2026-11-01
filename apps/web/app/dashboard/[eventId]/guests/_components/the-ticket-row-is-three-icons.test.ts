/**
 * the-ticket-row-is-three-icons.test.ts — THE GUEST CARD'S ONE SHARE BUTTON (owner 2026-10-28: "guest card still does not
 * ahve that one share button"; DECISION_LOG "GUEST CARD TICKET ROW = THREE ICON BUTTONS: SHARE · NFC · NEW QR" + "APPROVED —
 * ONE SEND BUTTON FOR EVERY INVITE"; prototype `send_run_simple_2026-10-27` frames card · newqr).
 *
 * The RENDERED card (the real `GuestCardBody` with the real Invite cell and ⋯ handed in, as the Guests pages draw it):
 *   1. beside the ticket: Share · (NFC) · New QR — neutral icon buttons, in that order, then ⋯ only while an account holds
 *      the invitation (Unlink is all the ⋯ has left); no big "Invite ▾" anywhere on the card; "Not sent yet · Not linked".
 *   2. Share is the ROW's one sender (`rowShare` → `shareInvite`), never a second share path.
 *   3. New QR asks first, in the ruled words, and posts the shipped `releaseGuestClaim` › `new_qr` door.
 *   4. NFC is the shipped writer (`NfcWriteButton`) as an icon — same sheet, same flag.
 *
 * SABOTAGE (seen red): draw the old brand "Invite" with caret in the card layout → test 1; drop the New QR icon → test 1;
 * point the card's Share at `invite('body')` → test 2.
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
// The shipped NFC writer is behind its flag; on for this render so its icon can be seen in the row.
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

async function paint(data: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { GuestCardBody } = await import('./guest-card-body');
  const { GuestInviteCell } = await import('./guest-invite-cell');
  const { GuestMoreMenu, GuestTicketThumb } = await import('./guest-ticket-parts');
  const { TEMPLATE_KIT } = await import('./guest-card-template-kit');
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data: { ...BASE, ...data, guest: guest() }, invitationBase: 'https://www.setnayan.com/cale-and-ice', photoDisplayUrl: null,
    variant: 'panel', headerShown: true, returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null,
    inviteSetup: { facts: { hostsName: 'Cale & Ice', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' }, template: null, slug: 'x' },
    SendInvite: GuestInviteCell, TicketThumb: GuestTicketThumb, MoreMenu: GuestMoreMenu, kit: TEMPLATE_KIT,
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, React.createElement(ToastProvider as React.FC<{ children: React.ReactNode }>, null, card)));
}

/** The ticket row's controls, in order, by their spoken names. */
function rowNames(html: string): string[] {
  const at = html.indexOf('data-guest-ticket-row=""');
  assert.ok(at > 0, 'the card has no ticket row');
  const row = html.slice(at, html.indexOf('data-guest-invite-status=', at));
  return [...row.matchAll(/<button\b[^>]*aria-label="([^"]+)"[^>]*>/g)].map((m) => m[1]!);
}

test('1 · the RENDERED card: Share · NFC · New QR beside the ticket, ⋯ only while linked, no Invite ▾', async () => {
  const unlinked = await paint();
  assert.deepEqual(rowNames(unlinked), ['Share Cita Ramos’s invitation', 'Write Cita Ramos’s link to NFC', 'Make a new QR for Cita Ramos']);
  const row = unlinked.slice(unlinked.indexOf('data-guest-ticket-row=""'), unlinked.indexOf('data-guest-invite-status='));
  for (const b of row.match(/<button\b[^>]*>/g) ?? []) assert.match(b, /class="ab ab-neutral\b/, `a ticket-row button is not the neutral icon button: ${b.slice(0, 120)}`);
  assert.doesNotMatch(unlinked, /aria-label="Invite Cita Ramos|data-caret/, 'the big "Invite ▾" is still on the card');
  assert.doesNotMatch(unlinked, /More for Cita Ramos/, 'an empty ⋯ is drawn');
  assert.match(unlinked, /Not sent yet · Not linked/);

  const linked = await paint({ linkedAccount: { email: 'c@x.com', memberType: 'guest' } });
  assert.deepEqual(rowNames(linked).slice(-1), ['More for Cita Ramos'], 'the ⋯ (Unlink) is not last in the row once linked');
});

test('2 · Share is the row’s ONE sender — `rowShare` → `shareInvite`, a computer gets the shipped app rows + Copy', () => {
  const card = CELL.slice(CELL.indexOf("if (layout === 'card') {"));
  const body = card.slice(0, card.indexOf('\n  }\n'));
  assert.match(body, /icon=\{Share\}[\s\S]*?onClick=\{\(\) => void rowShare\('body'\)\}/, 'the card’s Share does not run the row’s share');
  assert.doesNotMatch(body, /invite\('body'\)|tone="brand"/, 'the card still opens the old Invite sheet / draws a filled Invite');
  const fn = CELL.slice(CELL.indexOf('async function rowShare('));
  assert.match(fn.slice(0, fn.indexOf('\n  }\n')), /await shareInvite\(null, message\)/);
  assert.match(CELL, /data-invite-apps=""/, 'the computer’s app rows are gone');
});

test('3 · New QR asks first, in the ruled words, and posts the shipped new_qr door', () => {
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('));
  assert.match(menu, /icon=\{RotateCw\}\s*label="New QR"[\s\S]*?onClick=\{\(\) => setConfirm\('new_qr'\)\}/, 'New QR does not ask first');
  assert.match(menu, /Their old QR and link will stop working\. Anyone holding the old one — a printed pass, a forwarded\s+message — won&rsquo;t get in\./);
  assert.match(menu, /<input type="hidden" name="new_qr" value="1" \/>/);
  assert.match(menu, /const release = releaseGuestClaim\.bind\(null, eventId, guestId\);/, 'New QR left the shipped token-rotation door');
});

test('4 · NFC is the shipped writer, as an icon', () => {
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('));
  assert.match(menu, /<NfcWriteButton url=\{nfcUrl\} iconOnly name=/);
  assert.doesNotMatch(menu.slice(menu.indexOf('role="menu"')), /NfcWriteButton|data-guest-new-qr=""/, 'NFC / New QR are still ⋯ lines too');
});
