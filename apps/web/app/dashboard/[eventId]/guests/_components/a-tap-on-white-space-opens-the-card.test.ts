/**
 * a-tap-on-white-space-opens-the-card.test.ts — A TAP ON A GUEST CARD'S WHITE
 * SPACE OPENS THE GUEST CARD; EVERY CONTROL ON THE CARD KEEPS ITS OWN TAP.
 *
 * ⚖ Owner 2026-10-03: tapping the card's white space opens the guest card (the
 * same as tapping the name) without stealing taps from the side dot, role,
 * + group, Invite, ⋯ and the reply pill. The computer row already did this
 * (frame F, "Open · click anywhere on the row") with its own inline selector;
 * both now share ONE rule, `isWhiteSpaceTap` (row-tap.ts).
 *
 * 🛡 Sabotaged (see the PR): dropping `'button'` from ROW_OWN_TAPS turns the
 * first test red (the reply pill would open the card); removing the phone row's
 * `onClick` turns the third red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { isWhiteSpaceTap, ROW_OWN_TAPS } from './row-tap';

(globalThis as unknown as { React: unknown }).React = React;

// ── A tiny element tree: enough `closest` / `contains` to ask the real question ──
class El {
  constructor(
    readonly tag: string,
    readonly attrs: Record<string, string> = {},
    readonly parent: El | null = null,
  ) {}
  private matches(sel: string): boolean {
    const s = sel.trim();
    const attr = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(s);
    if (attr) return attr[2] === undefined ? attr[1]! in this.attrs : this.attrs[attr[1]!] === attr[2];
    return s === this.tag;
  }
  closest(selector: string): El | null {
    for (let n: El | null = this; n; n = n.parent) if (selector.split(',').some((s) => n!.matches(s))) return n;
    return null;
  }
  contains(other: unknown): boolean {
    for (let n = other as El | null; n; n = n.parent) if (n === this) return true;
    return false;
  }
}

test('white space opens the card; every control on the card keeps its tap', () => {
  const li = new El('li');
  const row = new El('div', { 'data-guest-row': '' }, li);
  const body = new El('div', {}, row);
  const meta = new El('span', {}, body); // "· Table 9" — words, not a control
  // White space and plain words open the card.
  assert.equal(isWhiteSpaceTap(row, row), true, 'a tap on the card itself did not open it');
  assert.equal(isWhiteSpaceTap(body, row), true);
  assert.equal(isWhiteSpaceTap(meta, row), true, 'a tap on the card’s plain words did not open it');
  // Each control the owner named keeps its own tap — and what is drawn INSIDE it.
  const controls: [string, El][] = [
    ['side dot', new El('button', { 'aria-label': 'Change Ana’s side' }, body)],
    ['role', new El('button', { 'aria-label': 'Change Ana’s role' }, body)],
    ['+ group', new El('button', { 'aria-label': 'Add Ana to a group' }, body)],
    ['reply pill', new El('button', { 'aria-label': 'Change Ana’s RSVP' }, body)],
    ['Invite', new El('button', { 'aria-label': 'Invite Ana' }, body)],
    ['⋯', new El('button', { 'aria-label': 'More for Ana' }, body)],
    ['the name', new El('a', { href: '/dashboard/e1/guests/a' }, body)],
    ['a menu drawn in place', new El('div', { role: 'menu' }, body)],
    ['a checkbox', new El('input', { type: 'checkbox' }, body)],
  ];
  for (const [name, control] of controls) {
    const inner = new El('span', {}, control);
    assert.equal(isWhiteSpaceTap(control, row), false, `a tap on the ${name} opened the card instead`);
    assert.equal(isWhiteSpaceTap(inner, row), false, `a tap inside the ${name} opened the card instead`);
  }
  // A menu or sheet the row opened is drawn on the PAGE (portalled) — never white space.
  const page = new El('body');
  const portalled = new El('span', {}, new El('div', {}, page));
  assert.equal(isWhiteSpaceTap(portalled, row), false, 'a tap in a portalled menu opened the card');
  assert.equal(isWhiteSpaceTap(null, row), false);
  assert.ok(ROW_OWN_TAPS.includes('[data-sheet]'), 'a sheet drawn inside the row lost its own tap');
});

// ── The render: one name trigger, and every named control is a real button ──
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_white_space__.js');
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

test('the phone card draws ONE name trigger and real buttons for every control', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { GuestListMultiselect } = await import('./guest-list-multiselect');
  const ana = {
    guest_id: 'g-ana',
    event_id: 'e1',
    first_name: 'Ana',
    last_name: 'Cruz',
    role: 'guest',
    side: 'bride',
    rsvp_status: 'attending',
    group_category: 'other',
    meal_preference: null,
    invited_to_blocks: [],
    custom_tags: [],
    extra_roles: [],
    qr_token: 'tok',
    mobile: null,
    entry_source: 'host_seeded',
    plus_one_count: 0,
  };
  const html = renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        ToastProvider as React.FC<{ children: React.ReactNode }>,
        null,
        React.createElement(GuestListMultiselect as unknown as React.FC<Record<string, unknown>>, {
          eventId: 'e1',
          guests: [ana],
          palette: {},
          groups: [],
          groupMemberships: {},
          currentGroupId: null,
          selfJoinIds: [],
          seatByGuest: {},
          photoDisplayUrls: {},
          accountFaceByGuest: {},
          grouping: ['role'],
          sort: 'importance',
          invite: { base: 'https://www.setnayan.com/ana-and-ben', facts: {}, template: null },
        }),
      ),
    ),
  );
  const at = html.indexOf('data-guest-row=""');
  assert.ok(at > -1, 'the phone card is not drawn');
  const card = html.slice(at, html.indexOf('</li>', at));
  const names = card.match(/<a [^>]*data-row-name=""[^>]*>/g) ?? [];
  assert.equal(names.length, 1, 'the card must carry exactly ONE name trigger for white space to open');
  assert.match(names[0]!, /href="\/dashboard\/e1\/guests\/g-ana"/, 'the name trigger does not open THIS guest');
  for (const label of ['Change Ana Cruz’s side', 'Change Ana Cruz’s role', 'Add Ana Cruz to a group', 'Change Ana Cruz’s RSVP', 'Invite Ana Cruz', 'More for Ana Cruz']) {
    assert.match(card, new RegExp(`<button [^>]*aria-label="${label}"`), `"${label}" is not a button on the card — white space would steal its tap`);
  }
});

test('both rows use the ONE white-space rule, through the name’s own trigger', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-list-multiselect.tsx'), 'utf8'));
  const phone = src.slice(src.indexOf('function MobileListRow('), src.indexOf('function SwipeToDelete('));
  assert.match(phone, /onClick=\{\(e\) => \{\s*if \(!isWhiteSpaceTap\(e\.target, e\.currentTarget\)\) return;/, 'the phone card’s white space no longer opens it');
  assert.match(phone, /querySelector<HTMLElement>\('\[data-row-name\]'\)\?\.click\(\)/, 'the phone card opens something other than the name’s own trigger');
  assert.match(phone, /if \(selectMode\) onToggle\(\);/, 'while picking, white space must tick the row');
  const desk = src.slice(src.indexOf('function DesktopRow('), src.indexOf('function RosterCell('));
  assert.match(desk, /if \(!isWhiteSpaceTap\(e\.target, e\.currentTarget\)\) return;/, 'the computer row keeps a second, private white-space rule');
});
