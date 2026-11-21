/**
 * the-guest-card-is-the-20-nov-card.test.ts — THE GUEST CARD THE OWNER APPROVED ON 20 NOV 2026.
 *
 * Drawing `prototypes/guests_redesign_2026-11-20/guests_redesign_2026-11-20_fable.html` § 3 "The guest card" — owner, verbatim:
 * *"Yes, your picks"* then *"Yes, build it"* (DECISION_LOG 2026-11-20 "GUESTS REDESIGN: BUILD IT"). What the drawing rules:
 *
 *   1 · FOUR QUICK ACTIONS WITH WORDS, one row at the top: Send invite · Call · Seat · Note — "No mobile yet, so Call reads
 *       'Add mobile'". Send invite is the one filled step.
 *   2 · THE TICKET IS ONE ROW you tap to view, with its state in words.
 *   3 · THREE SHORT GROUPS — About · For the event · More — in sentence case, with the rows' new words, in the drawn order.
 *   4 · RARE AND HEAVY THINGS SIT UNDER MORE: Not counted for · Passed away · Reset or delete — each with its ⓘ — and
 *       nowhere else on the card. For a guest who passed away More opens by itself.
 *   5 · MISSING THINGS SHOW IN COLOUR ("Add a mobile"); filled things stay grey.
 *   6 · FULL SCREEN, RISING FROM THE BOTTOM on a phone, no blurred list behind it; drag down or ✕ closes. Scoped to a sheet
 *       that holds a guest card — the other quick views keep the side peek, and the side peek's own rules are untouched.
 *
 * It renders the REAL card (`GuestCardBody`, the shipped kit, the shipped Invite · ticket · Delete pieces handed in, as
 * `GuestCard` hands them) and reads the drawn tree; § 6 reads the stylesheet and the card's frame.
 *
 * SABOTAGE (each seen RED, then restored, 2026-11-20): the Note quick action dropped → 1 · Send invite un-filled → 1 · the
 * "For the event" heading dropped → 3 · Seat drawn after Photos again → 3 · Passed away moved back out of More → 4 · the
 * `missing` mark dropped from Name and contact → 5 · the rise rule un-scoped (plain `.sn-inspector-sheet`) → 6.
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
const STUB = join(process.cwd(), '__server_only_stub_20_nov_card__.js');
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

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-dan', event_id: 'e1', first_name: 'Daniel', last_name: 'Ramos', name_prefix: null, middle_name: null, name_suffix: null, display_name: null,
    role: 'best_man', side: 'groom', rsvp_status: 'attending', group_category: 'friends', meal_preference: 'no_preference', dietary_restrictions: null,
    invited_to_blocks: [], custom_tags: [], extra_roles: [], plus_one_allowed: false, plus_one_count: 0, photo_consent: false, faceblock_enabled: false,
    face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null, relation: null, email: null, notes: null, guest_note: null,
    qr_token: 'tok', mobile: null, entry_source: 'host_seeded', invitation_sent_at: null,
    ...over,
  } as unknown as GuestRow;
}
const BASE = {
  isCouple: false, hasSides: true, availableRoles: ['guest', 'best_man'], groupOptions: ['family', 'friends', 'other'], isIncWedding: true, showTeaCeremony: true,
  plusOneLines: [], plusOneGuestId: null, initialInvited: ['ceremony'], seatedAt: 'Entourage', customGroups: [], recordedAt: 'Sep 12', access: null,
  canManageAccess: true, offersThisIsMe: false, nameLinked: false, linkedAccount: null, profileName: null, roleNames: {},
  tables: [{ tableId: 't-1', label: 'Entourage' }], seatTableId: 't-1', groupChoices: { options: [], memberIds: [] },
};

async function paint(over: Partial<GuestRow> = {}, data: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { GuestCardBody } = await import('./guest-card-body');
  const { GuestInviteCell } = await import('./guest-invite-cell');
  const { GuestDeleteControl, GuestMoreMenu, GuestTicketThumb } = await import('./guest-ticket-parts');
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data: { ...BASE, ...data, guest: guest(over) }, invitationBase: 'https://www.setnayan.com/maria-and-jose', photoDisplayUrl: null,
    variant: 'panel', headerShown: true, returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null,
    inviteSetup: { facts: { hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' }, template: null, slug: 'x' },
    SendInvite: GuestInviteCell, TicketThumb: GuestTicketThumb, MoreMenu: GuestMoreMenu, DeleteControl: GuestDeleteControl,
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, React.createElement(ToastProvider as React.FC<{ children: React.ReactNode }>, null, card)));
}

/** The words of every control between two marks, in order (a button's or a link's `.lbl`). */
const words = (html: string) => [...html.matchAll(/<(?:button|a)\b[^>]*class="ab [^"]*"[^>]*>(?:<svg[\s\S]*?<\/svg>)?<span class="lbl">([^<]+)<\/span>/g)].map((m) => m[1]!);

test('1 · four quick actions with words, in one row at the top: Send invite · Add mobile · Seat · Note (Call once there is a mobile)', async () => {
  const html = await paint();
  const at = html.indexOf('data-guest-quick-actions=""');
  assert.ok(at > 0, 'the quick actions are gone');
  const row = html.slice(at, html.indexOf('data-guest-ticket-thumb=', at));
  assert.deepEqual(words(row), ['Send invite', 'Add mobile', 'Seat', 'Note'], 'the four quick actions, in the drawing’s order, each with its word');
  assert.equal((row.match(/\bab-main\b/g) ?? []).length, 1, 'exactly one filled step in the row');
  assert.match(row, /class="ab ab-brand[^"]*ab-main[^"]*"[^>]*>(?:<svg[\s\S]*?<\/svg>)?<span class="lbl">Send invite</, 'Send invite is not the filled one');
  assert.ok(at < html.indexOf('data-guest-card-groups='), 'what you do most is not at the top');
  // With a mobile the second action IS the call — a link to the phone's dialer.
  const withMobile = await paint({ mobile: '+639171234567' });
  const row2 = withMobile.slice(withMobile.indexOf('data-guest-quick-actions=""'), withMobile.indexOf('data-guest-ticket-thumb='));
  assert.deepEqual(words(row2), ['Send invite', 'Call', 'Seat', 'Note']);
  assert.match(row2, /<a\b[^>]*href="tel:/, 'Call does not call');
  // Seat and Note only OPEN the row that holds the field (never a second editor): they name the rows' stable handles.
  const quick = read('guest-card-quick.tsx');
  assert.match(quick, /seat: \{ handle: 'seat-plan'/);
  assert.match(quick, /note: \{ handle: 'note-for-them-private-note'/);
  assert.match(quick, /mobile: \{ handle: 'basic-info', field: 'mobile'/);
  for (const h of ['basic-info', 'seat-plan', 'note-for-them-private-note']) assert.match(html, new RegExp(`data-fold="card-${h}"`), `the row a quick action opens (${h}) is not on the card`);
});

test('2 · the ticket is ONE row you tap to view, with its state in words', async () => {
  const html = await paint();
  const m = /<button\b[^>]*data-guest-ticket-thumb=""[^>]*>([\s\S]*?)<\/button>/.exec(html);
  assert.ok(m, 'the ticket is not one pressable row');
  assert.match(m![0], /aria-haspopup="dialog"/, 'the row does not open the ticket');
  assert.match(m![1]!, />Their ticket</);
  assert.match(m![1]!, /data-guest-invite-status="">Not sent yet · Not linked</, 'its state is not said in words');
  assert.doesNotMatch(html, /Tap to view|Click to view/, 'the old thumbnail caption is back');
});

test('3 · three short groups — About · For the event · More — the rows in the drawn order, in sentence case', async () => {
  const html = await paint();
  const ORDER: Array<[string, string]> = [
    ['About', 'data-card-group="about"'],
    ['Name and contact', 'data-fold="card-basic-info"'],
    ['Role and group', 'data-fold="card-details"'],
    ['Plus-ones', 'data-fold="card-additional-guests"'],
    ['For the event', 'data-card-group="event"'],
    ['Reply', 'data-fold="card-rsvp-status"'],
    ['Seat', 'data-fold="card-seat-plan"'],
    ['Photos', 'data-fold="card-photos"'],
    ['Notes', 'data-fold="card-note-for-them-private-note"'],
    ['More', 'data-fold="card-more"'],
  ];
  let last = 0;
  for (const [word, mark] of ORDER) {
    const at = html.indexOf(mark);
    assert.ok(at > 0, `${word} is not on the card`);
    assert.ok(at > last, `${word} is drawn out of the drawing’s order`);
    last = at;
    const near = html.slice(at, at + 900);
    assert.match(near, new RegExp(`>${word}<`), `the ${mark} row does not read “${word}”`);
  }
  for (const old of ['Basic Info', 'RSVP Status', 'Seat Plan', 'Additional Guests', 'Passed Away', 'Note for them · Private note']) {
    assert.doesNotMatch(html, new RegExp(`>${old}<`), `the old title “${old}” is still drawn`);
  }
  // The role first, then the group — the side is in the head now ("Best man · Friends").
  assert.ok(html.slice(html.indexOf('data-fold="card-details"'), html.indexOf('data-fold="card-details"') + 900).includes('>Best Man · Friends<'), 'Role and group does not read role · group');
});

test('4 · rare and heavy things sit under More — Not counted for · Passed away · Reset or delete — and nowhere else', async () => {
  const html = await paint();
  const at = html.indexOf('data-fold="card-more"');
  const more = html.slice(at);
  for (const [what, mark] of [
    ['Not counted for', /data-card-not-counted(?:-none)?=""/],
    ['Passed away', /data-card-passed-away=""/],
    ['Reset or delete', /data-form-row="card-reset-delete"[\s\S]*?data-guest-reset-or-delete=""/],
  ] as const) {
    assert.ok(mark.test(more), `${what} is not inside More`);
    assert.ok(!mark.test(html.slice(0, at)), `${what} is also drawn outside More`);
  }
  // Inside More's own body (the fold's), not merely after it.
  const body = more.slice(more.indexOf('data-fold-body=""'));
  assert.ok(body.indexOf('data-card-passed-away=""') > 0 && body.indexOf('data-guest-delete-control=""') > body.indexOf('data-card-passed-away=""'));
  assert.match(more.slice(0, 900), />Not counted · Passed away · Delete</, 'More does not say what is inside');
  assert.doesNotMatch(more.slice(0, 600), /data-fold-open=""/, 'More opens by itself for a living guest');
  // Each with its ⓘ: the rows' own (Passed away's note, Reset or delete's explanation).
  assert.ok(more.includes('aria-label="About Passed away"') && more.includes('aria-label="About Reset or delete"'), 'a row of More lost its ⓘ');
  assert.match(read('guest-card-body.tsx'), /name=\{seatWithNoName \? 'Release seat' : canReset \? 'Reset or delete' : 'Delete'\}[\s\S]*?about=\{/, 'Reset or delete lost its ⓘ');
  // 🕯 A guest who passed away: More is open — the switch that brings them back is in reach.
  const away = await paint({ passed_away: true });
  assert.match(away.slice(away.indexOf('data-fold="card-more"') - 200, away.indexOf('data-fold="card-more"') + 200), /data-fold="card-more" data-fold-open=""/, 'More is shut on the card of a guest who passed away');
});

test('5 · missing things show in colour, filled things stay grey', async () => {
  const missing = await paint();
  assert.match(missing, /data-card-row="card-basic-info" data-card-row-missing=""/, 'a missing mobile is not marked');
  assert.ok(missing.slice(missing.indexOf('data-fold="card-basic-info"'), missing.indexOf('data-fold="card-basic-info"') + 900).includes('>Add a mobile<'));
  const filled = await paint({ mobile: '+639171234567' });
  assert.doesNotMatch(filled, /data-card-row-missing=/, 'a filled row is still marked missing');
  const css = read('guest-card.css');
  assert.match(css, /\[data-card-row-missing\] > \[data-fold\] > \[data-fold-pinbox\] \[data-fold-sub\][\s\S]{0,200}?\{\s*color: rgb\(var\(--sn-accent\)\);/, 'the missing mark draws no colour');
});

test('6 · on a phone the card rises full screen from the bottom — scoped to the guest card, the side peek untouched', () => {
  // The card's rules are its own surface stylesheet (2026-11-20: moved out of globals.css, which is at its byte ceiling);
  // the side peek's own rule is still globals.css's.
  const css = read('guest-card.css');
  const globals = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));
  const SCOPE = ".sn-inspector-sheet:has([data-guest-card-avatar='head'], [data-guest-card-sheet])";
  const at = css.indexOf(`${SCOPE} {`);
  assert.ok(at > 0, 'the rise rule is gone, or no longer scoped to a sheet that holds a guest card');
  const media = css.lastIndexOf('@media', at);
  assert.match(css.slice(media, at), /^@media \(max-width: 700\.98px\) \{\s*$/, 'the rise is not a phone-only rule');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /left: 0;/, 'the card is not the whole width');
  assert.match(rule, /animation: sn-guest-card-rise var\(--sn-m-move\) var\(--sn-m-spring\) backwards;/, 'it does not rise (or it holds its transform: no `both` fill)');
  assert.match(css, /@keyframes sn-guest-card-rise \{ from \{ transform: translateY\(100%\); \} \}/);
  assert.match(css, new RegExp(`${SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[data-closing\\] \\{\\s*animation: sn-guest-card-fall `), 'it does not fall back down on close');
  assert.match(css, /\.sn-inspector-peek:has\(\+ \.sn-inspector-sheet \[data-guest-card-avatar='head'\]\),[\s\S]{0,120}?\{\s*background: transparent;\s*backdrop-filter: none;/, 'the list behind it is still dimmed and blurred');
  // The side peek's own rule is exactly as the motion standard holds it (the other quick views).
  assert.match(globals, /\n\.sn-inspector-sheet \{[\s\S]*?animation: sn-side-peek-in var\(--sn-m-move\) var\(--sn-m-spring\) backwards;/);
  // The stylesheet is on every event page the card opens from (the event layout loads it), and in the guests lab.
  assert.match(stripComments(readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'layout.tsx'), 'utf8')), /^import '\.\/guests\/_components\/guest-card\.css';$/m, 'the event layout no longer loads the card’s rules');
  assert.match(stripComments(readFileSync(join(WEB, 'app', 'dev', 'guests-lab', 'page.lab.tsx'), 'utf8')), /^import '@\/app\/dashboard\/\[eventId\]\/guests\/_components\/guest-card\.css';$/m);
  assert.doesNotMatch(globals, /sn-guest-card-rise|data-card-row-missing|sn-guest-side-dot/, 'the card’s rules came back into globals.css');
  // The marks the scope reads are really drawn: the face in the card's head, and the in-place sheet's own.
  const card = read('guest-card.tsx');
  assert.match(card, /<GuestCardAvatar\s+guest=\{guest\}\s+photoDisplayUrl=\{photoDisplayUrl\}\s+size="head"/);
  assert.match(read('guest-card-head.tsx'), /data-guest-card-avatar=\{size\}/);
  assert.match(read('guest-card-sheet.tsx'), /data-guest-card-sheet=\{person\.id\}/);
  // Drag down closes — through the sheet's own close (the one ✕, Escape and Back use), from the head, only on a phone.
  assert.match(card, /<GuestCardRise \/>/, 'the card no longer mounts its drag');
  const rise = read('guest-card-rise.tsx');
  assert.match(rise, /if \(dy >= GUEST_CARD_DRAG_CLOSE_PX && close\.current\) \{[\s\S]*?close\.current\(\);/);
  assert.match(rise, /close\.current = ctx\?\.close;/, 'the drag closes by some other door than the sheet’s own');
  assert.match(rise, /if \(window\.innerWidth > PHONE_MAX \|\| sheet\.scrollTop > 0\) return;/, 'the drag is live off a phone, or while the card is scrolled');
  assert.match(rise, /closest\('button, a, input, \[role="button"\]'\)\) return;/, 'a press on ✕ starts a drag');
});
