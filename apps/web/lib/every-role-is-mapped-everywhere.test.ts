/**
 * 🗺 EVERY GUEST ROLE IS MAPPED EVERYWHERE — and every honour attendant is dressed the SAME way on every surface.
 *
 * Owner, 2026-10-19, adding the man of honor (DECISION_LOG "A MAN OF HONOR"): *"please add that on the dress code and
 * keep the mapping consistent and don't let me trace it and tell you to map it properly."*
 *
 * A guest role is mapped to something in ~25 places (its words, its group, its colour slot, its Studio row, its person
 * and their designs, its side of the aisle, its seat tier, its invitation blocks, its place in the emcee's billing …).
 * Almost all of them are `Partial<Record<GuestRole, …>>` or plain lists, so the type checker cannot see one go missing:
 * a role added without its mappings compiles, renders, and is quietly a plain guest on half the product.
 *
 * Held here, each as a property of the SHIPPED functions:
 *   A · the roles are the DATABASE's — read from the migrations' own `guest_role` enum, never a hand list — and the
 *       TypeScript words (`ROLE_LABELS`) are exactly those;
 *   B · every role has its universal maps (importance, group, colour slot, a role set that offers it);
 *   C · every role the entourage prints has its printed maps (label, printed group, Studio row, emcee billing);
 *   D · every role that says who it is (a woman, a man) says the same thing in every map that knows;
 *   E · every HONOUR attendant (maid, matron, man of honor · best man, best woman) resolves to the same row, key,
 *       label, designs, person and words in the Studio, on the guest page (Me › What to wear + Arrive by) and on the
 *       prints — and keys exactly as the role its row is named for wherever a role keys anything else.
 *
 * Run from `apps/web`: `npx tsx --test lib/every-role-is-mapped-everywhere.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ROLE_LABELS, defaultInvitedToForRole, resolveGuestAttire, type GuestRole } from './guests';
import { ROLE_IMPORTANCE, roleGroupOf } from './role-groups';
import * as ROLE_SET_MODULE from './role-sets';
import { ENTOURAGE_ROLES, columnOfRole, entourageGroupOfRole, roleLabel } from './entourage';
import { PALETTE_LIMITS, paletteKeyForRole, sanitizeRolePalette } from './mood-board';
import {
  HONOUR_ROW_OF,
  HONOUR_ROW_ROLES,
  PICK_LABEL,
  attireRow,
  isDressableRole,
  pickOptions,
  picksOf,
  readerAttire,
  readerPick,
  shownColumns,
  studioRowOf,
} from './attire-rows';
import { columnRole, designLabel, readerFigureRole, roleDesigns } from './attire-designs';
import { studioAttireRows } from './studio-attire-rows';
import { dressCodeForEveryone, dressCodeLines } from './dress-code-for-everyone';
import { resolveGuestAttireWithGroups, sanitizeGroupAttire } from './role-group-dress-code';
import { ATTIRE_STYLE_LABEL, formatCallTime, sanitizeRoleAttire, type AttireStyle } from './role-dress-code';
import { singleWearerOf } from './role-figure';
import { previewRoleOf } from './preview-role';
import { resolveDisplayPalette } from './room-palette';
import { walkSideOf } from './march-drag';
import { roleSeatingSetOf } from './role-seating';
import { bulkAssignableRolesFor } from './bulk-role-vocabulary';
import { ROLE_ALTERNATIVES } from './role-alternatives';
import { HOST_ROLES_BY_EVENT_TYPE, isRoleSubtype } from './host-roles';
import { SPECIALTY_OPTION_LABELS } from './onboarding/specialty-option-labels';
import { voiceOf, roleLabel as badgeLabel } from '../app/[slug]/_components/editorial/voices';
import { guestMeFacts } from './guest-me-parts';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const APP = join(__dirname, '..');
const MIGRATIONS = join(APP, '..', '..', 'supabase', 'migrations');

/* ── A · the roles are the database's ─────────────────────────────────────── */

/** `public.guest_role`, as the migrations build it: the CREATE TYPE list, then every ADD VALUE, in file order. */
function guestRoleEnum(): string[] {
  const out: string[] = [];
  for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--.*$/gm, '');
    for (const m of sql.matchAll(/CREATE\s+TYPE\s+public\.guest_role\s+AS\s+ENUM\s*\(([^)]*)\)/gi)) {
      for (const v of m[1]!.matchAll(/'([a-z_]+)'/g)) if (!out.includes(v[1]!)) out.push(v[1]!);
    }
    for (const m of sql.matchAll(/ALTER\s+TYPE\s+public\.guest_role\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([a-z_]+)'/gi)) {
      if (!out.includes(m[1]!)) out.push(m[1]!);
    }
  }
  return out;
}
const ROLES = guestRoleEnum() as GuestRole[];

test('A · the roles are the database enum’s, and the TypeScript words are exactly those', () => {
  assert.ok(ROLES.length >= 39, `the enum read back only ${ROLES.length} roles — the parser broke, not the product`);
  assert.ok(ROLES.includes('man_of_honor'), 'the man_of_honor migration does not add the enum value');
  assert.deepEqual([...Object.keys(ROLE_LABELS)].sort(), [...ROLES].sort(), 'ROLE_LABELS and public.guest_role disagree');
});

/* ── B · the universal maps ───────────────────────────────────────────────── */

const ROLE_SETS = Object.values(ROLE_SET_MODULE).filter(
  (v): v is { key: string; offeredRoles: GuestRole[]; selfClaimableRoles: GuestRole[]; tier1Roles: Set<string>; tier2Roles: Set<string> } =>
    Boolean(v && typeof v === 'object' && Array.isArray((v as { offeredRoles?: unknown }).offeredRoles)),
);
/** Kept in the enum, offered by no picker — owner 2026-09-15 retired it (role-sets.ts). The ONLY one. */
const RETIRED: ReadonlySet<string> = new Set(['principal_sponsor']);

test('B · every role has an importance rank, a group, a colour slot and a role set that offers it', () => {
  assert.ok(ROLE_SETS.length >= 5, 'no role sets found');
  for (const role of ROLES) {
    assert.ok(ROLE_IMPORTANCE.includes(role), `${role}: not in ROLE_IMPORTANCE (sorts nowhere)`);
    assert.ok(roleGroupOf(role), `${role}: no group (role-groups.ts)`);
    assert.ok(PALETTE_LIMITS[paletteKeyForRole(role)], `${role}: no colour slot (paletteKeyForRole)`);
    const offered = ROLE_SETS.some((s) => s.offeredRoles.includes(role));
    assert.ok(offered || RETIRED.has(role), `${role}: no role set offers it — nobody can pick it`);
  }
});

/* ── C · the printed maps ─────────────────────────────────────────────────── */

/** The roles the entourage never prints — the couple, the celebrant, a plain guest and the generic party roles. A new
 *  role is printed unless it is added here, on purpose. */
const NOT_PRINTED: ReadonlySet<string> = new Set(['guest', 'celebrant', 'bride', 'groom', 'host', 'vip', 'family', 'helper']);

/** The emcee's billing order (lib/emcee-script.ts `ROLE_ORDER`) — a role absent from it is not in the party roster. */
function emceeBilling(): string[] {
  const src = readFileSync(join(APP, 'lib', 'emcee-script.ts'), 'utf8');
  const body = /const ROLE_ORDER: GuestRole\[\] = \[([\s\S]*?)\];/.exec(src)?.[1] ?? '';
  return [...body.replace(/\/\/.*$/gm, '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
}

test('C · every printed role has its words, its printed group, its Studio row and its place in the emcee’s billing', () => {
  const billing = emceeBilling();
  assert.ok(billing.length > 20, 'the emcee billing order could not be read');
  for (const role of ROLES) {
    if (NOT_PRINTED.has(role)) continue;
    assert.ok(ENTOURAGE_ROLES.includes(role), `${role}: never printed (ENTOURAGE_ROLES)`);
    assert.ok(roleLabel(role), `${role}: no printed word (entourage ROLE_LABEL)`);
    assert.ok(entourageGroupOfRole(role), `${role}: no printed group`);
    assert.ok(studioRowOf(role), `${role}: no Studio › Dress Code row dresses them`);
    assert.ok(isDressableRole(role), `${role}: its Wear is dropped on read (isDressableRole)`);
    assert.ok(billing.includes(role), `${role}: not in the emcee's billing order`);
  }
});

/* ── D · who they are, said the same way everywhere ───────────────────────── */

test('D · a role that says who it is says the same in every map that knows', () => {
  for (const role of ROLES) {
    const f = previewRoleOf(`${role}-f`, ROLES);
    const m = previewRoleOf(`${role}-m`, ROLES);
    if (!f === !m) continue; /* both, or not a guest's eyes */
    const who = f ? 'f' : 'm';
    const kind = who === 'f' ? 'gown' : 'suit';
    const single = singleWearerOf(role);
    if (single) assert.equal(single, kind, `${role}: Role ▾ says ${who}, the figure draws a ${single}`);
    const seat = resolveGuestAttire(role, 'neutral');
    if (seat !== 'neutral') assert.equal(seat, kind, `${role}: Role ▾ says ${who}, the 3D seat plan dresses a ${seat}`);
    const reader = readerFigureRole(role, who === 'f' ? 'm' : 'f');
    assert.equal(reader, null, `${role}: Role ▾ says ${who}, the guest page draws the other person (${reader})`);
  }
});

/* ── E · the honour attendants ────────────────────────────────────────────── */

/** Every honour role — from the row map, cross-checked against the picker's either-or sets and the printed group. */
const HONOUR = Object.keys(HONOUR_ROW_OF) as GuestRole[];

test('E · the honour roles are one set in the rows, the pickers and the printed honour line', () => {
  const fromRows = new Set(Object.values(HONOUR_ROW_ROLES).flat());
  const fromPickers = new Set(ROLE_ALTERNATIVES.filter((s) => s.some((r) => HONOUR_ROW_OF[r])).flat());
  const printed = new Set(ROLES.filter((r) => entourageGroupOfRole(r) === 'honour'));
  assert.deepEqual([...fromRows].sort(), [...HONOUR].sort(), 'HONOUR_ROW_ROLES and HONOUR_ROW_OF disagree');
  assert.deepEqual([...fromPickers].sort(), [...HONOUR].sort(), 'the role pickers’ either-or sets and the honour rows disagree');
  assert.deepEqual([...printed].sort(), [...HONOUR].sort(), 'the printed honour line and the honour rows disagree');
  assert.ok(HONOUR.includes('man_of_honor'));
});

/** Every column of both honour rows dressed, each with a different Wear, call time and note. */
const DRESSED = {
  groups: { bridesmaids: { style: 'long_gown', callTime: '14:00' }, groomsmen: { style: 'suit', callTime: '14:00' } },
  roles: {
    maid_of_honor: { style: 'cocktail_dress', callTime: '13:30', note: 'Dusty rose' },
    best_man: { style: 'tuxedo', callTime: '13:00', note: 'Black tie' },
  },
  women: { roles: { best_man: { style: 'filipiniana' }, maid_of_honor: { style: 'barong_tagalog' } } },
} as Record<string, unknown>;
const PALETTE_STORED = { maid_of_honor: ['#803236'], bridesmaids: ['#646B38'], best_man: ['#1F3A5F'], groomsmen: ['#2C2A29'], touched_roles: ['maid_of_honor', 'bridesmaids', 'best_man', 'groomsmen'] };
const BOARD = resolveDisplayPalette(sanitizeRolePalette(PALETTE_STORED));

/** The role a row is named for — the one every other honour role must key exactly as. */
const HEAD = (role: GuestRole): GuestRole => HONOUR_ROW_OF[role]!.key;

test('E · each honour role keys exactly as the role its row is named for — group, side, slot, sets, seats, blocks, words', () => {
  for (const role of HONOUR) {
    const head = HEAD(role);
    const same: Array<[string, (r: GuestRole) => unknown]> = [
      ['role group (roster section)', roleGroupOf],
      ['printed group', entourageGroupOfRole],
      ['printed column', (r) => columnOfRole('honour', r)],
      ['side of the aisle (a guest of the other family)', (r) => walkSideOf({ role: r, side: HEAD(role) === 'best_man' ? 'bride' : 'groom' })],
      ['colour slot (Mood Board)', paletteKeyForRole],
      ['invited-to blocks', (r) => defaultInvitedToForRole(r).join(',')],
      ['seating together/group set', roleSeatingSetOf],
      ['bulk assign (wedding)', (r) => bulkAssignableRolesFor('wedding').includes(r)],
      ['bulk assign (muslim)', (r) => bulkAssignableRolesFor('wedding_muslim').includes(r)],
      ['editorial badge voice', voiceOf],
      ['Studio row (undressed: the crew’s)', (r) => studioRowOf(r)?.key],
      ...ROLE_SETS.flatMap((s): Array<[string, (r: GuestRole) => unknown]> => [
        [`${s.key}: offered`, (r) => s.offeredRoles.includes(r)],
        [`${s.key}: self-claimable`, (r) => s.selfClaimableRoles.includes(r)],
        [`${s.key}: seat tier 1`, (r) => s.tier1Roles.has(r)],
        [`${s.key}: seat tier 2`, (r) => s.tier2Roles.has(r)],
      ]),
    ];
    for (const [name, of] of same) assert.deepEqual(of(role), of(head), `${role} and ${head} disagree about: ${name}`);
    /* its own words, everywhere a role has words */
    assert.ok(roleLabel(role), `${role}: no printed word`);
    assert.ok(badgeLabel(role), `${role}: no editorial badge word`);
    assert.ok(SPECIALTY_OPTION_LABELS[role], `${role}: no onboarding word`);
    assert.ok(ROLE_LABELS[role], `${role}: no guest-list word`);
    /* a host seat: their own, or the one their column shares (the matron, the maid's) */
    const column = HONOUR.filter((r) => HONOUR_ROW_OF[r]!.key === head && HONOUR_ROW_OF[r]!.index === HONOUR_ROW_OF[role]!.index);
    assert.ok(column.some((r) => isRoleSubtype(r) && HOST_ROLES_BY_EVENT_TYPE.wedding!.includes(r)), `${role}: no host seat for their column`);
  }
});

test('E · each honour role’s column: its person, its designs, its gender — the same in every map', () => {
  for (const role of HONOUR) {
    const { key, index } = HONOUR_ROW_OF[role]!;
    const row = attireRow('roles', key)!;
    const who = row.who[index]!;
    const kind = who === 'f' ? 'gown' : 'suit';
    const figure = columnRole(key, index);
    assert.ok(figure, `${role}: their column has no person`);
    assert.equal(readerFigureRole(role, who), figure, `${role}: the guest page draws ${readerFigureRole(role, who)}, the Studio column ${figure}`);
    assert.deepEqual([...pickOptions(row, index)], [...roleDesigns(figure!)], `${role}: the column's Wear ▾ is not their person's list`);
    assert.equal(readerPick(row, role, null), index, `${role}: the guest page reads the other column`);
    assert.equal(singleWearerOf(role), kind, `${role}: the figure is not a ${kind}`);
    assert.equal(resolveGuestAttire(role, 'neutral'), kind, `${role}: the 3D seat plan does not dress a ${kind}`);
    assert.ok(previewRoleOf(`${role}-${who}`, ROLES), `${role}: Role ▾ cannot preview them as ${who}`);
    assert.equal(previewRoleOf(`${role}-${who === 'f' ? 'm' : 'f'}`, ROLES), null, `${role}: Role ▾ previews them as the other person`);
    assert.equal(paletteKeyForRole(role), row.paletteKey, `${role}: their colour slot is not their row's`);
  }
});

/* What each surface tells ONE honour attendant. */
const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
async function guestPage(role: GuestRole): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const parts = await Promise.all(
    (['wear', 'arrive'] as const).map((part) =>
      renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config: DRESSED, rolePalette: PALETTE_STORED, guestRole: role, part })),
    ),
  );
  return parts.join('\n').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}

test('E · the Studio, the guest page and the prints dress each honour attendant from the same row, key, label and Wear', async () => {
  const everyone = dressCodeForEveryone({ config: DRESSED, stored: sanitizeRolePalette(PALETTE_STORED), board: BOARD });
  const printed = dressCodeLines(everyone);
  for (const role of HONOUR) {
    const { key, index } = HONOUR_ROW_OF[role]!;
    const row = attireRow('roles', key)!;
    const pick = picksOf(DRESSED, row)[index]!;
    assert.ok(pick.style, `precondition: ${role}'s column is dressed`);
    const said = designLabel(pick.role, pick.style as AttireStyle);

    /* the Studio — the row, its column drawn, its name */
    const studio = studioAttireRows([{ role, count: 1 }], DRESSED).find((r) => r.tier === 'roles' && r.key === key);
    assert.ok(studio, `${role}: the Studio draws no ${key} row`);
    assert.ok(studio!.honourColumns?.includes(index), `${role}: the Studio does not count them in their column`);
    assert.ok((studio!.columns ?? shownColumns(DRESSED, row)).includes(index), `${role}: the Studio does not draw their column`);

    /* the guest page — the same row, the same Wear, the same call time */
    assert.equal(studioRowOf(role, DRESSED)?.key, key, `${role}: the guest page reads another row`);
    const roles = sanitizeRoleAttire(DRESSED.roles, isDressableRole);
    const groups = sanitizeGroupAttire(DRESSED.groups);
    const r = resolveGuestAttireWithGroups({ role, roles, groups, palette: BOARD, config: DRESSED });
    assert.equal(r.source, 'role', `${role}: the guest page answers from their group, not their row`);
    assert.equal(r.panel?.callTime, studio!.arrives, `${role}: Arrive by is not the Studio row's call time`);
    assert.equal(r.panel?.callTime, formatCallTime(((DRESSED.roles as Record<string, { callTime: string }>)[key]!).callTime));
    const own = readerAttire({ role, attire: null, source: r.source, config: DRESSED, style: r.panel!.style, hexes: r.panel!.hexes, label: (s) => ATTIRE_STYLE_LABEL[s], single: singleWearerOf });
    assert.equal(own.styleLabel, said, `${role}: the guest page says "${own.styleLabel}", the Studio "${said}"`);
    assert.equal(own.picks.length, 1);
    assert.equal(own.picks[0]!.role, pick.role, `${role}: the guest page draws another person`);
    const html = await guestPage(role);
    assert.match(html, /data-me-part="wear"/, `precondition: ${role}'s What to wear is drawn`);
    assert.ok(html.includes(said), `${role}: Me › What to wear does not say "${said}"`);
    for (const other of picksOf(DRESSED, row)) {
      if (other.style && other !== pick) {
        const not = designLabel(other.role, other.style as AttireStyle);
        if (not !== said) assert.ok(!html.includes(not), `${role}: Me › What to wear also says the other column's "${not}"`);
      }
    }
    assert.ok(html.includes(studio!.arrives!), `${role}: Arrive by does not say ${studio!.arrives}`);
    assert.equal(guestMeFacts({ role, dressCodeConfig: DRESSED, rolePalette: PALETTE_STORED }).arriveBy, studio!.arrives, `${role}: the Me tile's Arrive by`);

    /* the prints and the Event Hub's general view — the same row, named as the Studio names it, with their line */
    const line = printed.find((l) => l.label === studio!.label);
    assert.ok(line, `${role}: the prints have no "${studio!.label}" line (lines: ${JSON.stringify(printed.map((l) => l.label))})`);
    const shownOnPaper = everyone.rows.find((x) => x.rowKey === key)!.picks.length;
    assert.ok(line!.line.includes(shownOnPaper === 2 ? `${PICK_LABEL[pick.who]}: ${said}` : said), `${role}: the prints say "${line!.line}", not their "${said}"`);
  }
});

test('E · undressed, every honour attendant keeps their crew’s look — the same fallback on every surface', () => {
  const BASE = { groups: DRESSED.groups } as Record<string, unknown>;
  for (const role of HONOUR) {
    const head = HEAD(role);
    assert.equal(studioRowOf(role, BASE)?.key, studioRowOf(head, BASE)?.key, `${role}: falls back to another row than ${head}`);
    const studio = studioAttireRows([{ role, count: 1 }, { role: head === 'best_man' ? 'groomsman' : 'bridesmaid', count: 2 }], BASE).find((r) => r.key === head);
    assert.ok(studio?.fallsBackTo, `${role}: the Studio does not say whose look they keep`);
    const r = resolveGuestAttireWithGroups({ role, roles: {}, groups: sanitizeGroupAttire(BASE.groups), palette: BOARD, config: BASE });
    assert.equal(r.source, 'group', `${role}: undressed, the guest page does not answer from their crew`);
    assert.equal(r.panel?.callTime, '2:00 PM', `${role}: undressed, Arrive by is not their crew's`);
  }
});
