/**
 * the-templated-card-holds-no-hand-made-control.test.ts — STEP 4D: THE AUDIT OF THE GUEST CARD, LIKE SETUP'S (2026-10-09).
 *
 * Renders the card the way the Guests pages draw it (the kit handed in; the real Invite pair, ticket and ⋯ handed in too) over its
 * states — a guest and the couple · unclaimed and claimed by an account · a guest who has not replied (the Give-this-spot form) ·
 * +1 · "This is me" offered · a finalized list's guest who passed away · a refused save (`errorMessage`) and a flash — and asserts
 * that every control on it is one the templates draw:
 *   · every `<button>` is an ActionButton (`.ab`), the ⓘ (Explain), a dropdown, a Form row pill, a switch, a chip, the fold's head,
 *     or the ticket thumbnail — nothing else;
 *   · no native `<select>`, no `<textarea>`, no `<details>` accordion, no `sn-switch`, no `input-field`, no `button-primary`;
 *     the ONE native text box left is the Give-this-spot name (`swap_name`) — its `required` is what stops an empty swap from
 *     falling through to "take the seat back" (a template row posts a hidden value, which `required` cannot guard);
 *   · at most ONE filled forward step per form / per row (the top "Invite", "Give the spot", "This is me"…);
 *   · no hand colour on a control (terracotta/gold fills, ink fills);
 *   · the form still posts every name the autosave expects (the 4B-0 golden holds that; here we assert the form is there).
 *
 * SABOTAGE (each seen RED, then restored): a bare <button> in the body · a native <select> · a second filled button in one form · a
 * `button-primary` on the Give-the-spot button · the old terracotta banner back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { GuestRow } from '@/lib/guests';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_card_audit__.js');
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
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-ana', event_id: 'e1', first_name: 'Ana', last_name: 'Cruz', name_prefix: null, middle_name: null, name_suffix: null, display_name: null,
    role: 'guest', side: 'both', rsvp_status: 'attending', group_category: 'other', meal_preference: 'no_preference', dietary_restrictions: null,
    invited_to_blocks: [], custom_tags: [], extra_roles: [], plus_one_allowed: false, plus_one_count: 0, photo_consent: false, faceblock_enabled: false,
    face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null, relation: null, email: null, notes: null, guest_note: null,
    qr_token: 'tok', mobile: null, entry_source: 'host_seeded', invitation_sent_at: null,
    ...over,
  } as unknown as GuestRow;
}
const BASE = {
  isCouple: false, hasSides: true, availableRoles: ['guest', 'best_man'], groupOptions: ['family', 'other'], isIncWedding: true, showTeaCeremony: true,
  plusOneStateLabel: null, plusOneGuestId: null, initialInvited: ['ceremony'], seatedAt: 'Table 1', customGroups: [], recordedAt: 'Sep 12', access: null,
  canManageAccess: true, offersThisIsMe: false, nameLinked: false, linkedAccount: null, profileName: null, roleNames: {},
  tables: [{ tableId: 't-1', label: 'Table 1' }], seatTableId: 't-1', groupChoices: { options: [{ groupId: 'g1', label: 'Barkada' }], memberIds: [] },
};
type State = { guest?: Partial<GuestRow>; data?: Record<string, unknown>; error?: string; flash?: { ok: boolean; msg: string }; noInvite?: boolean };
export const STATES: Record<string, State> = {
  'a guest who has not replied (Give-this-spot form), unclaimed': { guest: { rsvp_status: 'pending' } },
  'a guest, +1, claimed by an account': { guest: { plus_one_count: 2, plus_one_allowed: true }, data: { nameLinked: true, linkedAccount: { email: 'a@x.com', memberType: 'guest' }, plusOneStateLabel: 'named — Ben' } },
  'the couple (bride), partner sign-in offered': { guest: { role: 'bride', side: 'bride', email: 'maria@x.com' }, data: { isCouple: true } },
  'the couple, "This is me" offered': { guest: { role: 'groom', side: 'groom' }, data: { isCouple: true, offersThisIsMe: true } },
  'a guest who passed away (finalized list)': { guest: { passed_away: true, rsvp_status: 'declined' }, data: { seatedAt: null, seatTableId: null } },
  'a refused save and a flash': { error: 'new row violates row-level security policy for table "guests"', flash: { ok: false, msg: 'We couldn’t send that.' } },
};

async function paint(s: State): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { GuestCardBody } = await import('./guest-card-body');
  const { GuestInviteCell } = await import('./guest-invite-cell');
  const { GuestMoreMenu, GuestTicketThumb } = await import('./guest-ticket-parts');
  const { TEMPLATE_KIT } = await import('./guest-card-template-kit');
  const { guestCardErrorCopy } = await import('./guest-card-error-copy');
  const g = guest(s.guest);
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data: { ...BASE, ...s.data, guest: g }, invitationBase: 'https://www.setnayan.com/ana-and-ben', photoDisplayUrl: null, variant: 'panel', headerShown: true,
    returnTo: '/dashboard/e1/guests', errorMessage: s.error ? guestCardErrorCopy(s.error) : null, inviteFlash: s.flash ?? null,
    inviteSetup: { facts: { hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' }, template: null, slug: 'x' },
    SendInvite: GuestInviteCell, TicketThumb: GuestTicketThumb, MoreMenu: GuestMoreMenu, kit: TEMPLATE_KIT,
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, React.createElement(ToastProvider as React.FC<{ children: React.ReactNode }>, null, card)));
}

/** The opening tags of every <button>, with the class and the marks that say what drew it. */
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
/* A row of the ⋯ MENU (`role="menuitem"`) is the menu's own kind (§ 14), not a button; its colour is still held below. */
const DRAWN_BY_A_TEMPLATE = /role="menuitem"|\sclass="[^"]*\bab\b[^"]*"|data-explain=|aria-haspopup="listbox"|data-form-row-pill=|role="switch"|data-chip=|data-fold-head=|data-guest-ticket-thumb=|data-form-row-retry=/;

for (const [name, state] of Object.entries(STATES)) {
  test(`the card — ${name}: every control is a template’s`, async () => {
    const html = await paint(state);
    const bad = buttons(html).filter((b) => !DRAWN_BY_A_TEMPLATE.test(b));
    assert.deepEqual(bad, [], 'a button the templates do not draw');
    /* (`sn-switch` is also the template's own TRACK — a <span> — so only an <input> wearing it is the old native switch; the Give-this-spot name is the documented exception.) */
    const handMade = [...html.matchAll(/<(?:select|textarea|details)\b[^>]*>|<input\b[^>]*class="(?:[^"]*\s)?sn-switch(?:\s[^"]*)?"[^>]*>|<(?!input[^>]*name="swap_name")[a-z]+\b[^>]*class="(?:[^"]*\s)?(?:input-field|button-primary|button-secondary)(?:\s[^"]*)?"[^>]*>/g)].map((m) => m[0].slice(0, 140));
    assert.deepEqual(handMade, [], 'a hand-made control is on the card');
    /* A hand colour on an element: a terracotta/gold or mulberry utility, or a SOLID ink fill (a hairline `bg-ink/5` hover or skeleton tint is not a fill). */
    const colours = [...html.matchAll(/<[a-z]+\b[^>]*class="([^"]*)"[^>]*>/g)]
      .filter((m) => m[1]!.split(/\s+/).some((t) => /(?:^|:)(?:bg|text|border|ring)-terracotta(?:-\d+)?(?:\/\d+)?$/.test(t) || /(?:^|:)bg-mulberry/.test(t) || t === 'bg-ink'))
      .map((m) => m[0].slice(0, 160));
    assert.deepEqual(colours, [], 'a hand colour is on the card');
    /* Native inputs: hidden carriers, the posted checkboxes, and — where the swap form is — its one required name box. */
    for (const m of html.matchAll(/<input\b[^>]*>/g)) {
      const tag = m[0];
      const ok = /type="hidden"/.test(tag) || /type="checkbox"[^>]*class="sr-only"|class="sr-only"[^>]*type="checkbox"/.test(tag) || /name="swap_name"/.test(tag);
      assert.ok(ok, `a native input the templates do not draw: ${tag.slice(0, 160)}`);
    }
    /* One filled forward step per form, and per row of the card. */
    for (const chunk of html.split(/<form\b/).slice(1)) {
      const form = chunk.slice(0, chunk.indexOf('</form>'));
      assert.ok(((form.match(/\bab-main\b/g) ?? []).length) <= 1, `a form has two filled steps: ${form.slice(0, 120)}`);
    }
    for (const row of html.split('data-form-row=').slice(1)) assert.ok((row.slice(0, row.indexOf('data-form-row=') > 0 ? row.indexOf('data-form-row=') : undefined).match(/\bab-main\b/g) ?? []).length <= 1, 'a row has two filled steps');
    assert.doesNotMatch(html, /new row violates|row-level security/, 'the database’s words reached the card');
  });
}

test('the states really cover the buttons: Invite, ⋯, give-the-spot, take-back, this-is-me, partner link, the save line', async () => {
  const all = (await Promise.all(Object.values(STATES).map(paint))).join('\n');
  for (const [what, re] of [
    ['Invite (brand, filled)', /class="ab ab-brand ab-main[^"]*"[^>]*aria-label="Invite|aria-label="Invite[^>]*class="ab ab-brand ab-main/],
    ['the ⋯', /aria-label="More for Ana Cruz"/],
    ['Give the spot (brand, filled)', /<button[^>]*class="ab ab-brand ab-main[^"]*"[^>]*>Give the spot|<button[^>]*>[^<]*Give the spot/],
    ['Take this seat back', /Take this seat back/],
    ['This is me', /This is me/],
    ['the partner sign-in link', /their sign-in link/],
    ['the Passed away switch', /data-card-field="passed_away"/],
    ['the Invited-to chips', /data-chips="invited-to"/],
    ['the refused save, in the card’s words', /That didn’t go through — nothing was changed\. Please try again\./],
  ] as const) assert.match(all, re, `${what} is not on any audited state`);
  assert.match(all, /role="alert" class="text-sm font-semibold text-danger-700"/, 'the refused save is not the danger line');
});
