/**
 * tab-goes-to-the-next-row.test.ts — ⇥ ON THE GUEST CARD, TAB KEEPS A ROW AND OPENS THE NEXT (owner 2026-10-21: *"pressing tab on
 * keyboard should allow next row on the guest card?"*).
 *
 * THE RULE (`app/_components/form-row.tsx`, the row kit; `lib/form-row.ts`, its pure half):
 *   (1) Tab / Shift+Tab in an open field KEEPS exactly as Enter does — the same `keepOutcome`, the same ONE `send` — and only
 *       then moves on: a typed row opens straight into its field (its words selected), a dropdown / switch / chips row takes the
 *       focus shut and Tab goes on from it. A wrong, an unfinished, or a refused keep stays on its row (it never moves on).
 *   (2) THE ORDER IS THE ROW ORDER: the rows as the card draws them, a shut fold's rows (`inert`) skipped, a row with nothing to
 *       press skipped, hidden inputs never a stop. Painted here from the REAL card (the Guests pages' kit) and walked with the
 *       kit's own rule: Title → First → Middle → Last → Suffix → Shown as → Mobile → the open section's rows.
 *   (3) The card's form is the box Tab walks (`data-form-tab-scope`); a phone's "next" key is its Enter and goes on the same way.
 *
 * No DOM runs in this runner (and the repo has no user-event), so (1) and (3) hold the WIRING and (2) executes the rule on the
 * painted card; the browser run that drove it — Chromium and WebKit, 1280 and 375 with touch — is in the PR
 * (`shots-2026-10-21/card-tab/work/walk.mjs`).
 *
 * SABOTAGE (each seen RED, then restored): Tab left out of `exitKeeps` · `rowToTabTo` ignoring `reachable` (a shut fold's rows
 * join the order) · `rowToTabTo` ignoring `control` · a wrong / unfinished answer allowed to move on (`fine` starting true) ·
 * the move no longer waiting for the keep to land · the Tab branch dropped from the open field · the card's form losing
 * `data-form-tab-scope` · a row's ⓘ counted as its key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GuestRow } from '@/lib/guests';
import * as R from '@/lib/form-row';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_card_tab__.js');
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
const WEB = join(HERE, '../../../../..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

/* ── (1) the pure half: Tab keeps as Enter does, and says which way it goes on ─────────────────────────────────────── */

test('1 · Tab and Shift+Tab KEEP — the very outcome Enter has, in every case — and say which way they go on', () => {
  assert.deepEqual((['tap-out', 'enter', 'x', 'escape', 'tab', 'tab-back'] as const).map(R.exitKeeps), [true, true, false, false, true, true]);
  assert.deepEqual((['tap-out', 'enter', 'x', 'escape', 'tab', 'tab-back'] as const).map(R.exitMoves), [0, 0, 0, 0, 1, -1]);
  const email = (t: string) => (t.includes('@') && !t.split('@')[1] ? 'Not complete.' : null);
  const cases = [
    { typed: 'Maria', before: 'Mara' },
    { typed: 'Mara', before: 'Mara' },
    { typed: '  ', before: 'Mara', required: true },
    { typed: 'm@', before: '', check: email },
    { typed: '', before: 'x' },
  ];
  for (const c of cases) {
    const enter = R.keepOutcome({ exit: 'enter', ...c });
    assert.deepEqual(R.keepOutcome({ exit: 'tab', ...c }), enter, `Tab does not keep as Enter does (${JSON.stringify(c.typed)})`);
    assert.deepEqual(R.keepOutcome({ exit: 'tab-back', ...c }), enter, `Shift+Tab does not keep as Enter does (${JSON.stringify(c.typed)})`);
  }
});

test('1b · the row Tab goes to: the next reachable row with something to press, either way; none at the ends', () => {
  const rows = [
    { reachable: true, control: true }, // 0
    { reachable: false, control: true }, // 1 · a shut fold's row
    { reachable: true, control: false }, // 2 · a fact, nothing to press
    { reachable: true, control: true }, // 3
  ];
  assert.equal(R.rowToTabTo(rows, 0, 1), 3);
  assert.equal(R.rowToTabTo(rows, 3, -1), 0);
  assert.equal(R.rowToTabTo(rows, 3, 1), null);
  assert.equal(R.rowToTabTo(rows, 0, -1), null);
});

/* ── (2) the order, on the painted card ─────────────────────────────────────────────────────────────────────────────── */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
type PaintedRow = { field: string; reachable: boolean; control: boolean };

/** The card's rows in document order, as the row kit sees them in a browser: inside a shut fold (`inert`) or not, and whether
 *  the row has a key of its own — a control that is not a hidden input, not taken out of Tab (`tabindex="-1"`), not disabled,
 *  not in the row's name (its ⓘ), and not in a row nested inside it. */
function paintedRows(html: string): PaintedRow[] {
  const at = html.indexOf('data-form-tab-scope');
  assert.ok(at > 0, 'the card’s form is not the box Tab walks (data-form-tab-scope)');
  const form = html.slice(html.lastIndexOf('<form', at), html.indexOf('</form>', at));
  const rows: PaintedRow[] = [];
  const stack: { tag: string; inert: boolean; row: number | null; name: boolean }[] = [];
  for (const m of form.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, tagRaw, attrs, selfClose] = m as unknown as [string, string, string, string, string];
    const tag = tagRaw.toLowerCase();
    if (close) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.tag === tag) {
        stack.length = i;
        break;
      }
      continue;
    }
    const top = stack[stack.length - 1];
    const inert = (top?.inert ?? false) || /(^|\s)inert(=|\s|$)/.test(attrs);
    const isRow = /\sdata-form-row="/.test(attrs);
    const row = isRow ? rows.length : (top?.row ?? null);
    const name = isRow ? false : (top?.name ?? false) || /\sdata-form-row-name=/.test(attrs);
    if (isRow) rows.push({ field: /data-card-field="([^"]+)"/.exec(attrs)?.[1] ?? /data-form-row="([^"]*)"/.exec(attrs)![1]!, reachable: !inert, control: false });
    const key =
      (tag === 'button' || tag === 'select' || tag === 'textarea' || (tag === 'input' && !/\stype="hidden"/.test(attrs)) || /\stabindex="(?!-1")/.test(attrs)) &&
      !/\sdisabled(=|\s|$)/.test(attrs) &&
      !/\stabindex="-1"/.test(attrs);
    if (key && row !== null && !name) rows[row]!.control = true;
    if (!VOID.has(tag) && !selfClose) stack.push({ tag, inert, row, name });
  }
  return rows;
}

function walk(rows: PaintedRow[], from: string, dir: 1 | -1): string[] {
  let i: number | null = rows.findIndex((r) => r.field === from);
  assert.ok(i >= 0, `${from} is not a row of the card`);
  const out = [from];
  while ((i = R.rowToTabTo(rows, i, dir)) !== null) out.push(rows[i]!.field);
  return out;
}

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-ana', event_id: 'e1', first_name: 'Ana', last_name: 'Cruz', name_prefix: null, middle_name: null, name_suffix: null, display_name: null,
    role: 'guest', side: 'both', rsvp_status: 'attending', group_category: 'other', meal_preference: 'no_preference', dietary_restrictions: null,
    invited_to_blocks: [], custom_tags: [], extra_roles: [], plus_one_allowed: false, plus_one_count: 0, photo_consent: false, faceblock_enabled: false,
    face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null, relation: null, email: null, notes: null,
    guest_note: null, qr_token: 'tok', mobile: null, entry_source: 'host_seeded', invitation_sent_at: null, ...over,
  } as unknown as GuestRow;
}

async function paintCard(over: Partial<GuestRow>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('./guest-card-body');
  const { TEMPLATE_KIT } = await import('./guest-card-template-kit');
  const data = {
    isCouple: false, hasSides: false, availableRoles: ['guest'], groupOptions: ['other'], isIncWedding: false, showTeaCeremony: false,
    plusOneLines: [], plusOneGuestId: null, initialInvited: [] as string[], seatedAt: null, customGroups: [] as Array<{ label: string }>,
    recordedAt: null, access: null, canManageAccess: true, offersThisIsMe: false, nameLinked: false, linkedAccount: null, profileName: null,
    roleNames: {}, tables: null, seatTableId: null, groupChoices: null, guest: guest(over),
  };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data, invitationBase: 'https://www.setnayan.com/ana-and-ben', photoDisplayUrl: null, variant: 'panel', headerShown: true,
    returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null, kit: TEMPLATE_KIT,
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

const NAME_ROWS = ['first_name', 'middle_name', 'last_name', 'name_suffix', 'display_name', 'mobile'];

test('2 · the card’s Tab order IS its row order: Title → First → … → Mobile, then the open section’s rows; shut sections skipped', async () => {
  /* A guest who left a note: the card opens on RSVP Status (`open={Boolean(guest.guest_note)}`) — every other group is shut,
     Basic Info too (owner 2026-10-23: closed by default, the mobile in its summary). RE-AIMED 2026-10-23: Passed Away left the
     form's box (it sits below Access and posts by `form=`), so the form holds ONE row fewer — the floor moves by one, no more. */
  const rows = paintedRows(await paintCard({ guest_note: 'See you!', mobile: '0917 555 0101' }));
  assert.ok(rows.length >= 19, `only ${rows.length} rows were read — the reader is blind`);
  assert.ok(rows.some((r) => !r.reachable) && rows.some((r) => r.reachable), 'no shut section on the card — nothing proves the skip');
  assert.deepEqual(walk(rows, 'rsvp_status', 1), [
    'rsvp_status', // RSVP Status's Reply dropdown
    'invited_to',
    'meal_preference',
    'dietary_restrictions',
  ]);
  assert.deepEqual(walk(rows, 'rsvp_status', -1), ['rsvp_status'], 'Shift+Tab from Reply reached into a shut group');
  assert.deepEqual(walk(rows, 'dietary_restrictions', -1), ['dietary_restrictions', 'meal_preference', 'invited_to', 'rsvp_status']);
  /* …and Basic Info, opened, is Title → First → Middle → Last → Suffix → Shown as → Mobile: the painted order, walked by the
     kit's own rule with that one group open (every other row as painted). */
  const nameFields = new Set(['name_title', ...NAME_ROWS]);
  const basicOpen = rows.map((r) => (nameFields.has(r.field) ? { ...r, reachable: true } : r));
  assert.deepEqual(walk(basicOpen, 'name_title', 1).slice(0, 7), ['name_title', ...NAME_ROWS], 'Basic Info’s rows are not in the name’s order');
  assert.deepEqual(walk(basicOpen, 'first_name', -1), ['first_name', 'name_title'], 'Shift+Tab from First is not the Title');
  assert.equal(walk(basicOpen, 'mobile', 1)[1], 'rsvp_status', 'from Mobile, Tab does not go on to the open group (shut ones skipped)');
});

test('2b · with every group shut — Basic Info too — nothing in a shut group is ever a stop', async () => {
  const rows = paintedRows(await paintCard({}));
  for (const f of ['first_name', 'mobile', 'rsvp_status', 'meal_preference', 'dietary_restrictions', 'notes', 'photo_consent']) {
    const r = rows.find((x) => x.field === f);
    assert.ok(r, `${f} is not on the card`);
    assert.equal(r.reachable, false, `${f} sits in a shut group and is still a Tab stop`);
  }
});

/* ── (1) and (3): the wiring in the row kit ─────────────────────────────────────────────────────────────────────────── */

const KIT = read('app/_components/form-row.tsx');
const typed = KIT.slice(KIT.indexOf('export function TypedRow('), KIT.indexOf('export function FormRowField('));
const end = typed.slice(typed.indexOf('const end = (exit'), typed.indexOf('const closed = () =>'));
const field = KIT.slice(KIT.indexOf('export function FormRowField('), KIT.indexOf('export function ChosenRow('));

test('3 · the open field hears Tab before anything else and ends through the ONE exit — keeping as Enter does', () => {
  const keys = field.slice(field.indexOf('const onKeys'), field.indexOf('const gone'));
  assert.ok(keys.length > 100, 'the open field’s keys moved — re-read this guard');
  assert.match(keys, /if \(e\.key === 'Tab' && !e\.altKey && !e\.ctrlKey && !e\.metaKey\) \{\s*e\.preventDefault\(\);\s*end\(e\.shiftKey \? 'tab-back' : 'tab'\);/, 'Tab no longer ends the field through its exit');
  assert.ok(keys.indexOf("'Tab'") < keys.indexOf("'Enter'"), 'Tab is heard after Enter');
  /* 📱 The phone's "next" key is its Enter: it goes on only when there IS a next row, and says so on the key. */
  assert.match(keys, /end\(onwards && window\.matchMedia\('\(pointer: coarse\)'\)\.matches \? 'tab' : 'enter'\)/, 'the phone’s next key does not go on');
  assert.match(field, /enterKeyHint=\{onwards \? 'next' : 'done'\}/, 'the one-line field’s key does not say "next"');
});

test('4 · it moves on only from a row that is FINE — after its ONE keep landed; a wrong, unfinished or refused keep stays', () => {
  assert.ok(end.length > 300, 'TypedRow’s end moved — re-read this guard');
  assert.match(end, /const step = exitMoves\(exit\);/);
  /* Nothing changed = fine; only the send outcome may make it fine (by landing); wrong / still-needed never are. */
  assert.match(end, /let fine: boolean \| Promise<boolean> = out\.kind === 'as-it-was';/, 'a wrong or unfinished answer may move on');
  assert.equal([...end.matchAll(/fine = /g)].length, 1, 'fine is set somewhere besides the keep');
  assert.match(end, /fine = send\(out\.text\);/, 'the move does not wait on the one keep');
  assert.match(end, /const next = landed \? tabRowFrom\(root\.current, step\) : null;/, 'it moves on although the keep did not land');
  assert.match(end, /if \(typeof fine === 'boolean'\) go\(fine\);\s*else void fine\.then\(go\);/, 'the move does not follow the keep’s answer');
  /* A keyboard exit brings the focus back to the row's pill — where a refusal is said — unless it moved on. */
  assert.match(end, /refocus\.current = exit === 'enter' \|\| exit === 'escape' \|\| step !== 0;/);
  /* The keep itself answers whether it landed (a refusal or a throw = false). */
  const send = typed.slice(typed.indexOf('const send = useCallback('), typed.indexOf('const end = (exit'));
  assert.match(send, /return false;/, 'a keep that threw reads as landed');
  assert.match(send, /return !\(r && r\.ok === false\);/, 'a refused keep reads as landed');
});

test('5 · going into a row uses the row’s own door — a typed row opens by its pill (the tap’s path), nothing else is opened', () => {
  const into = KIT.slice(KIT.indexOf('function tabInto('), KIT.indexOf('const carrying'));
  assert.match(into, /flushSync\(\(\) => typed\.click\(\)\);/, 'a typed row is not opened by its own pill');
  assert.doesNotMatch(into, /setMode|onKeep|tellTheForm|send\(/, 'going into a row writes or opens by a second path');
  /* The rule the kit hands the screen's rows to is the pure one tested above, with the same two facts. */
  const from = KIT.slice(KIT.indexOf('export function tabRowFrom('), KIT.indexOf('function tabInto('));
  assert.match(from, /reachable: !r\.closest\('\[inert\]'\) && r\.getClientRects\(\)\.length > 0, control: rowKeys\(r\)\.length > 0/);
  assert.match(KIT, /const PRESSABLE = 'button:not\(\[disabled\]\),input:not\(\[type="hidden"\]\):not\(\[disabled\]\):not\(\[tabindex="-1"\]\),select:not\(\[disabled\]\),textarea:not\(\[disabled\]\),\[tabindex\]:not\(\[tabindex="-1"\]\)';/, 'the row kit’s keys are not the ones this guard reads');
  assert.match(KIT, /el\.closest\(ROW\) === row && !el\.closest\('\[data-form-row-name\]'\)/, 'a row’s ⓘ or a nested row’s key counts as the row’s own');
});

test('6 · the card’s form is the box Tab walks, spelled as the row kit spells it', () => {
  assert.match(KIT, /export const FORM_TAB_SCOPE = 'data-form-tab-scope';/);
  const form = read('app/dashboard/[eventId]/guests/_components/guest-card-autosave.tsx');
  assert.match(form, /<form[^>]*?data-form-tab-scope=""/, 'the card’s autosave form is not the box Tab walks');
  assert.doesNotMatch(form, /from '@\/app\/_components\/form-row'/, 'the Maker’s first load would import the templates');
});
