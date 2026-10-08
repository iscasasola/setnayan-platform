/**
 * the-card-posts-the-same-form.test.ts — THE GOLDEN "BEFORE" OF THE GUEST CARD'S FORM (step 4B-0, 2026-10-09; test only).
 *
 * The card is LIVE: `guest-card-autosave.tsx` posts the WHOLE `<form>` to `updateGuest` (quiet=1), and `updateGuest` writes every
 * column it finds — `clean(formData.get('x')) || null` cannot tell "cleared" from "never rendered". So moving the card's fields
 * onto the templates must change NOT ONE posted name or value, and a control that keeps its value in React state and posts
 * nothing would stop saving a column and render exactly like success.
 *
 * This renders the card's form for TWELVE states (a guest and the couple; sides on/off; claimed by an account; unclaimed; +1;
 * every toggle off and every toggle on; empty texts; several "Invited to" blocks ticked and none; a seated guest and a declined one
 * with no table; the tea-ceremony order; Chinese/Tsinoy rite; extra roles and groups ticked) and records the FormData a browser
 * would build from it — NAMES AND VALUES, order-insensitive, a checkbox that is off ABSENT — and compares it with
 * `the-card-posts-the-same-form.golden.json`, committed from the code as it stood BEFORE any field moved. A step that changes the
 * form on purpose must say so by regenerating that file (`UPDATE_GOLDEN=1`) and the review reads the diff; the rest stays red.
 *
 * Serialization is the browser's (HTML "constructing the entry list"): text/hidden/number/tel → value; a checkbox → its value
 * (`on`) only when checked; textarea → its text; a select → the selected option; disabled and unnamed controls are skipped.
 *
 * SABOTAGE (each seen RED, then restored): a hidden carrier dropped (`relation`) · a toggle's name changed · a Toggle that stops
 * posting when on · an Invited-to block renamed · the extractor's checkbox rule inverted (anti-vacuity).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GuestRow } from '@/lib/guests';

(globalThis as unknown as { React: unknown }).React = React;

// `server-only` / `client-only` resolve to an empty module, as in the-live-iphone-test-renders.test.ts.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_card_form__.js');
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
const GOLDEN = join(HERE, 'the-card-posts-the-same-form.golden.json');
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

/* ── the browser's FormData, from the card's static markup ─────────────────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** The attributes of one start tag, entity-decoded; a bare attribute is ''. */
export function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = tag.replace(/^<\w+/, '').replace(/\/?>$/, '');
  for (const m of body.matchAll(/([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1]!] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

/** What `new FormData(form)` holds for the autosave `<form>` inside `html` — name → values, in document order per name. */
export function postedForm(html: string): Record<string, string[]> {
  const at = html.indexOf('name="quiet"');
  assert.ok(at > 0, 'the autosave form (quiet=1) is not on the page');
  const open = html.lastIndexOf('<form', at);
  const close = html.indexOf('</form>', at);
  const form = html.slice(open, close);
  const out: Record<string, string[]> = {};
  const add = (name: string, value: string) => (out[name] ??= []).push(value);
  for (const m of form.matchAll(/<(input|textarea|select)\b[^>]*>/g)) {
    const tag = m[0];
    const a = attrsOf(tag);
    const name = a.name;
    if (!name || 'disabled' in a) continue;
    if (m[1] === 'input') {
      const type = (a.type ?? 'text').toLowerCase();
      if (['submit', 'button', 'reset', 'image', 'file'].includes(type)) continue;
      if (type === 'checkbox' || type === 'radio') {
        if ('checked' in a) add(name, a.value ?? 'on');
        continue;
      }
      add(name, a.value ?? '');
    } else if (m[1] === 'textarea') {
      const rest = form.slice(m.index! + tag.length);
      add(name, decodeEntities(rest.slice(0, rest.indexOf('</textarea>'))));
    } else {
      const rest = form.slice(m.index! + tag.length);
      const sel = rest.slice(0, rest.indexOf('</select>'));
      const opts = [...sel.matchAll(/<option\b[^>]*>/g)].map((o) => attrsOf(o[0]));
      const chosen = opts.find((o) => 'selected' in o) ?? opts[0];
      if (chosen) add(name, chosen.value ?? '');
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([x], [y]) => (x < y ? -1 : 1)));
}

/* ── the twelve states ─────────────────────────────────────────────────────────────────────────────────────────────── */

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-ana',
    event_id: 'e1',
    first_name: 'Ana',
    last_name: 'Cruz',
    name_prefix: null,
    middle_name: null,
    name_suffix: null,
    display_name: null,
    role: 'guest',
    side: 'both',
    rsvp_status: 'attending',
    group_category: 'other',
    meal_preference: 'no_preference',
    dietary_restrictions: null,
    invited_to_blocks: [],
    custom_tags: [],
    extra_roles: [],
    plus_one_allowed: false,
    plus_one_count: 0,
    photo_consent: false,
    faceblock_enabled: false,
    face_recognition_excluded: false,
    passed_away: false,
    attire: 'neutral',
    seniority_rank: null,
    relation: null,
    email: null,
    notes: null,
    guest_note: null,
    qr_token: 'tok',
    mobile: null,
    entry_source: 'host_seeded',
    invitation_sent_at: null,
    ...over,
  } as unknown as GuestRow;
}

type Scenario = { guest?: Partial<GuestRow>; data?: Record<string, unknown> };
const BASE_DATA = {
  isCouple: false,
  hasSides: false,
  availableRoles: ['guest'],
  groupOptions: ['other'],
  isIncWedding: false,
  showTeaCeremony: false,
  plusOneStateLabel: null,
  plusOneGuestId: null,
  initialInvited: [] as string[],
  seatedAt: null,
  customGroups: [] as Array<{ label: string }>,
  recordedAt: null,
  access: null,
  canManageAccess: true,
  offersThisIsMe: false,
  nameLinked: false,
  linkedAccount: null,
  profileName: null,
  roleNames: {},
  tables: null,
  seatTableId: null,
  groupChoices: null,
};
const RICH = {
  hasSides: true,
  availableRoles: ['guest', 'best_man', 'bridesmaid', 'principal_sponsor_ninong', 'groomsman'],
  groupOptions: ['family', 'friends', 'other'],
  tables: [
    { tableId: 't-1', label: 'Table 1' },
    { tableId: 't-2', label: 'Table 2' },
  ],
  seatTableId: 't-2',
  seatedAt: 'Table 2',
  groupChoices: { options: [{ groupId: 'grp-b', label: 'Barkada' }, { groupId: 'grp-c', label: 'Choir' }], memberIds: ['grp-c'] },
};

export const SCENARIOS: Record<string, Scenario> = {
  '01 a plain guest, unclaimed, nothing set': {},
  '02 a guest with sides, a seat, groups, extra roles, +1 of 2': {
    guest: { side: 'groom', group_category: 'friends', role: 'principal_sponsor_ninong', extra_roles: ['groomsman'] as never, plus_one_allowed: true, plus_one_count: 2, mobile: '0917 555 0101', meal_preference: 'beef', dietary_restrictions: 'halal', notes: 'Driver drops him at the side gate', rsvp_status: 'maybe', attire: 'suit' },
    data: { ...RICH, plusOneStateLabel: 'named — Ben', recordedAt: 'Sep 12' },
  },
  '03 every toggle ON': { guest: { photo_consent: true, faceblock_enabled: true, face_recognition_excluded: true, passed_away: true } },
  '04 every toggle OFF': { guest: { photo_consent: false, faceblock_enabled: false, face_recognition_excluded: false, passed_away: false } },
  '05 empty texts (null and empty string)': { guest: { mobile: '', dietary_restrictions: '', notes: '', display_name: '', middle_name: '', name_suffix: '', relation: '', email: '' } },
  '06 several Invited-to blocks ticked': { data: { initialInvited: ['ceremony', 'reception', 'cocktails'] } },
  '07 no Invited-to block ticked': { data: { initialInvited: [] } },
  '08 the couple (bride): locked role, always attending, no passed-away, no extra roles': {
    guest: { role: 'bride', side: 'bride', first_name: 'Maria', last_name: 'Santos', plus_one_count: 0 },
    data: { isCouple: true, hasSides: true },
  },
  '09 claimed by an account: the name is carried, not offered': {
    guest: { first_name: 'Ana', last_name: 'Cruz', name_prefix: 'Dr.', middle_name: 'B.', name_suffix: 'Jr.', display_name: 'Tita Ana' },
    data: { nameLinked: true, linkedAccount: { email: 'ana@example.com' }, profileName: null },
  },
  '10 a declined guest: no table posted; Chinese rite shows the tea-ceremony order': {
    guest: { rsvp_status: 'declined', seniority_rank: 3, relation: 'Lola' },
    data: { ...RICH, showTeaCeremony: true, seatTableId: null, seatedAt: null },
  },
  '11 a rite without a tea ceremony: the rank is carried hidden': {
    guest: { seniority_rank: 7, relation: 'Tito' },
    data: { ...RICH, showTeaCeremony: false },
  },
  '12 quotes, ampersands and a long note survive': {
    guest: { first_name: 'O’Brien "Bo"', last_name: 'Dela Cruz & Sons', display_name: 'The <Dela Cruz> family', notes: 'Line one\nLine two — "quoted" & more', dietary_restrictions: 'no nuts, no "shell"fish' },
  },
};

async function paint(s: Scenario, withKit = false): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('./guest-card-body');
  const kit = withKit ? (await import('./guest-card-template-kit')).TEMPLATE_KIT : undefined;
  const g = guest(s.guest);
  const data = { ...BASE_DATA, ...s.data, guest: g };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1',
    data,
    invitationBase: 'https://www.setnayan.com/ana-and-ben',
    photoDisplayUrl: null,
    variant: 'panel',
    headerShown: true,
    returnTo: '/dashboard/e1/guests',
    errorMessage: null,
    inviteFlash: null,
    ...(kit ? { kit } : {}),
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

export async function everyScenario(withKit = false): Promise<Record<string, Record<string, string[]>>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const [name, s] of Object.entries(SCENARIOS)) out[name] = postedForm(await paint(s, withKit));
  return out;
}

/* ── the tests ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

test('the extractor is the browser’s: checked boxes post, unchecked do not; textarea, entities, hidden (fixtures)', () => {
  const html =
    '<form><input type="hidden" name="quiet" value="1"/>' +
    '<input type="checkbox" name="a" checked="" class="sn-switch"/><input type="checkbox" name="b"/><input type="checkbox" name="c" value="yes" checked/>' +
    '<input name="t" value="O&#x27;Brien &quot;Bo&quot; &amp; Sons"/><input name="off" value="x" disabled/><input value="noname"/>' +
    '<textarea name="n">Line one\nLine &lt;two&gt;</textarea><select name="s"><option value="x">X</option><option value="y" selected="">Y</option></select>' +
    '<button name="btn" value="v">go</button></form>';
  assert.deepEqual(postedForm(html), { a: ['on'], c: ['yes'], n: ['Line one\nLine <two>'], quiet: ['1'], s: ['y'], t: ['O\'Brien "Bo" & Sons'] });
});

test('the card’s form, in every state, posts exactly what it posted before any field moved', async () => {
  const now = await everyScenario();
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(now, null, 2)}\n`);
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as typeof now;
  assert.deepEqual(Object.keys(now), Object.keys(golden), 'a state was added or removed');
  for (const name of Object.keys(golden)) assert.deepEqual(now[name], golden[name], `the posted form changed — ${name}`);
});

test('…and the card drawn by the TEMPLATES posts the very same form, in every state, column by column (4B)', async () => {
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Record<string, Record<string, string[]>>;
  const templated = await everyScenario(true);
  assert.deepEqual(Object.keys(templated), Object.keys(golden));
  const wrong: string[] = [];
  for (const name of Object.keys(golden)) {
    const a = golden[name]!;
    const b = templated[name]!;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) wrong.push(`${name} › ${k}: before ${JSON.stringify(a[k] ?? null)} · templates ${JSON.stringify(b[k] ?? null)}`);
    }
  }
  assert.deepEqual(wrong, [], 'the templated card posts a different form');
});

test('anti-vacuity (4B): the templated card really IS drawn by the templates, and the old one is not', async () => {
  const s = SCENARIOS['02 a guest with sides, a seat, groups, extra roles, +1 of 2']!;
  const old = await paint(s, false);
  const tpl = await paint(s, true);
  assert.doesNotMatch(old, /data-form-row=|data-fold=|data-card-field=/, 'the Maker’s card is drawn by templates it cannot afford');
  assert.match(old, /class="input-field"/);
  assert.match(tpl, /data-form-row-kind="typed"/);
  assert.match(tpl, /data-form-row-kind="switch"/);
  assert.match(tpl, /data-chips="invited-to"/);
  assert.match(tpl, /data-fold="card-details"/);
  assert.doesNotMatch(tpl, /class="input-field"|class="sn-switch"|<details\b|<select\b/, 'a hand-made control is left on the templated card');
  for (const f of ['first_name', 'last_name', 'mobile', 'display_name', 'notes', 'dietary_restrictions']) assert.match(tpl, new RegExp(`data-card-field="${f}"`), `${f} is not a typed row`);
  for (const f of ['side', 'group_category', 'role', 'extra_roles', 'group_ids', 'rsvp_status', 'plus_one_count', 'meal_preference', 'table_id', 'attire']) assert.match(tpl, new RegExp(`data-card-field="${f}"`), `${f} is not a dropdown row`);
});

test('one list of fields: every field the card\'s body names is drawn by BOTH kits, in some state (a field added to one path appears in the other)', async () => {
  const { stripComments } = await import('@/lib/strip-comments');
  const body = stripComments(readFileSync(join(HERE, 'guest-card-body.tsx'), 'utf8'));
  const named = new Set<string>([
    ...[...body.matchAll(/<K\.Field\s+id="(\w+)"/g)].map((m) => m[1]!),
    ...[...body.matchAll(/<K\.(?:Pick|Toggle)\s+name="(\w+)"/g)].map((m) => m[1]!),
  ]);
  assert.ok(named.size >= 20, `the body names only ${named.size} fields — the scan is blind`);
  const old: string[] = [];
  const tpl: string[] = [];
  for (const sc of Object.values(SCENARIOS)) {
    old.push(await paint(sc, false));
    tpl.push(await paint(sc, true));
  }
  const oldAll = old.join('\n');
  const tplAll = tpl.join('\n');
  const lacking: string[] = [];
  for (const f of named) {
    if (!new RegExp(`name="${f}"`).test(oldAll)) lacking.push(`${f}: not on the hand-drawn card`);
    if (!new RegExp(`data-card-field="${f}"`).test(tplAll)) lacking.push(`${f}: not on the templated card`);
    if (!new RegExp(`name="${f}"`).test(tplAll)) lacking.push(`${f}: the templated card does not post it`);
  }
  assert.deepEqual(lacking, []);
  /* The kit's two halves implement the same list of leaves (the type says it; this names it so a leaf added to one is read). */
  const rows = stripComments(readFileSync(join(HERE, 'guest-card-template-kit.ts'), 'utf8'));
  const keys = (src: string, re: RegExp) => (re.exec(src)?.[1] ?? '').split(',').map((e) => e.split(':')[0]!.trim()).filter(Boolean).sort();
  assert.deepEqual(keys(rows, /TEMPLATE_KIT: CardKit = \{([^}]*)\}/), keys(body, /const OLD_KIT: CardKit = \{([^}]*)\}/).map((k) => k), 'the two kits draw different leaves');
});

test('anti-vacuity: the states really differ, and the form is not trivially small', async () => {
  const g = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Record<string, Record<string, string[]>>;
  const all = Object.values(g);
  for (const form of all) assert.ok(Object.keys(form).length >= 20, 'a state posts suspiciously few controls');
  const s = (k: string) => g[Object.keys(g).find((n) => n.startsWith(k))!]!;
  assert.deepEqual(s('03').photo_consent, ['on']);
  assert.equal('photo_consent' in s('04'), false, 'an OFF toggle must post nothing');
  assert.ok(s('02').invited_ceremony === undefined, 'the rich state invites by role defaults?');
  assert.deepEqual(['invited_ceremony', 'invited_reception', 'invited_cocktails'].map((k) => k in s('06')), [true, true, true]);
  assert.equal(Object.keys(s('07')).some((k) => k.startsWith('invited_')), false, 'no block ticked must post no invited_*');
  assert.equal('table_id' in s('10'), false, 'a declined guest posts no table');
  assert.ok('table_id' in s('02') && s('02').table_id![0] === 't-2');
  assert.deepEqual(s('02').extra_roles, ['groomsman']);
  assert.deepEqual(s('02').group_ids, ['grp-c']);
  assert.deepEqual(s('08').role, ['bride']);
  assert.equal('passed_away' in s('08'), false, 'the couple is never offered Passed away');
  assert.deepEqual(s('09').first_name, ['Ana']);
  assert.deepEqual(s('12').first_name, ['O’Brien "Bo"']);
  /* 01 · 04 · 05 · 07 are the same form on purpose (defaults off, nothing ticked, empty = absent-or-empty); the other eight differ. */
  assert.ok(new Set(all.map((f) => JSON.stringify(f))).size >= 9, 'the states are not different enough to mean anything');
});
