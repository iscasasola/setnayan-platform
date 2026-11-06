/**
 * 👯 THE HONOUR ATTENDANTS HAVE THEIR OWN DRESS-CODE ROWS — two of them, shaped like the sponsors' row.
 *
 * Owner, 2026-10-19, on Studio › Mood Board & Dress Code (rows: Secondary Sponsors · Bridesmaids 14 · Groomsmen 14):
 * *"i cannot see the best man, best woman, maid of honor and matron of honor"* → *"yes please. Best man and best woman
 * share a row like principal sponsors. same goes to maid and matron of honor"* (DECISION_LOG 2026-10-19 "THE HONOUR
 * ATTENDANTS GET THEIR OWN DRESS-CODE ROWS"). Cause: `studioAttireRows` drew only GROUP rows past the couple, and
 * `role-groups.ts` folds the maid / matron of honor into the Bridesmaids and the best man / best woman into the
 * Groomsmen — so they were counted there and had no row.
 *
 * Held here, each as a property of the shipped functions (never a phrasing):
 *   1 · the rows: each honour row only when the guest list has one of its roles, named with the event's own role
 *       names, at the head of the entourage; the Bridesmaids / Groomsmen counts no longer include them;
 *   2 · each column offers its own person's list (the best man = the groom's, Tuxedo included; the best woman and the
 *       maid / matron = the maid of honor's);
 *   3 · a reader is dressed by HER row once her Wear is picked there — and by her group's row until then (the fallback
 *       stays: no event loses what it has); the matron reads the maid's row, the best woman the women's column;
 *   4 · the guest page's Me › What to wear says it — her row's Wear and call time, or the Bridesmaids' look;
 *   5 · the Studio draws the two rows from the same function (one call time, one note, a figure per column).
 *
 * Run from `apps/web`: `npx tsx --test lib/the-honour-attendants-have-their-own-rows.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { attireRow, honourRowSpeaks, pickOptions, readerAttire, studioRowOf } from './attire-rows';
import { roleDesigns } from './attire-designs';
import { studioAttireRows } from './studio-attire-rows';
import { resolveGuestAttireWithGroups, sanitizeGroupAttire } from './role-group-dress-code';
import { ATTIRE_STYLE_LABEL, sanitizeRoleAttire, type AttireStyle } from './role-dress-code';
import { isDressableRole } from './attire-rows';
import { singleWearerOf } from './role-figure';
import { dressCodeForEveryone } from './dress-code-for-everyone';
import { resolveDisplayPalette } from './room-palette';
import { sanitizeRolePalette } from './mood-board';
import type { GuestRole } from './guests';
import { fallbackInspirationParts } from './inspiration-parts';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    /* The Studio is a client component: no app router and no server actions in a unit test (as its sibling guards do). */
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() };
    if (/(?:^|\/)(?:actions|wizard-actions|hub-draft-actions|colour-access-actions)$/.test(request)) {
      return new Proxy({}, { get: () => async () => ({}) });
    }
    return load.call(this, request, ...rest);
  };
}

const t = (pairs: Array<[GuestRole, number]>) => pairs.map(([role, count]) => ({ role, count }));
const PARTY = t([
  ['bride', 1],
  ['groom', 1],
  ['candle_sponsor', 2],
  ['maid_of_honor', 2],
  ['bridesmaid', 12],
  ['best_man', 2],
  ['best_woman', 1],
  ['groomsman', 13],
  ['guest', 20],
]);
const keys = (rows: ReturnType<typeof studioAttireRows>) => rows.map((r) => `${r.tier}:${r.key}`);

/* ── 1 · the rows ─────────────────────────────────────────────────────────── */

test('1 · an honour row for each pair the guest list has, at the head of the entourage, in the couple’s words', () => {
  const rows = studioAttireRows(PARTY, null, { groomsman: { one: "Groom's Crew" }, bridesmaid: { one: "Bride's Crew" } });
  const k = keys(rows);
  const moh = k.indexOf('roles:maid_of_honor');
  const bm = k.indexOf('roles:best_man');
  const maids = k.indexOf('groups:bridesmaids');
  const men = k.indexOf('groups:groomsmen');
  assert.ok(moh > k.indexOf('groups:secondary_sponsors') && moh >= 0, `the maid of honor's row is not after the sponsors: ${k.join(' ')}`);
  assert.deepEqual([moh + 1, bm + 1], [bm, maids], `the honour rows do not stand together just before the Bridesmaids: ${k.join(' ')}`);
  assert.ok(men > maids, 'the Groomsmen moved');
  const at = (key: string) => rows.find((r) => r.key === key)!;
  /* ALWAYS BOTH NAMES (owner 2026-10-19, "maid and matron of honor same row") — no matron on this list, and the row is
     still the pair's */
  assert.equal(at('maid_of_honor').label, 'Maid of Honor & Matron of Honor');
  assert.equal(at('best_man').label, 'Best Man & Best Woman');
  /* the honour attendants are counted in their own row and no longer in their group's */
  assert.equal(at('maid_of_honor').people, 2);
  assert.equal(at('best_man').people, 3);
  assert.equal(at('bridesmaids').people, 12);
  assert.equal(at('groomsmen').people, 13);
  /* the crews keep the couple's names, and the honour row says whose look its people keep until it is dressed */
  assert.equal(at('groomsmen').label, "Groom's Crew");
  assert.equal(at('best_man').fallsBackTo, "Groom's Crew");
  assert.equal(at('maid_of_honor').fallsBackTo, "Bride's Crew");
  assert.deepEqual(at('best_man').honourColumns, [0, 1]);

  /* a renamed honour role is said in the couple's word too */
  const renamed = studioAttireRows(t([['matron_of_honor', 1], ['bridesmaid', 3]]), null, { matron_of_honor: { one: 'Ate Lia' } } as never);
  assert.equal(renamed.find((r) => r.key === 'maid_of_honor')?.label, 'Maid of Honor & Ate Lia');

  /* cale-ice's shape (2 maids of honor, no matron; 2 best men, 1 best woman) — both rows carry both names */
  const cale = studioAttireRows(t([['maid_of_honor', 2], ['best_man', 2], ['best_woman', 1], ['bridesmaid', 12]]), null);
  assert.deepEqual(cale.filter((r) => r.tier === 'roles' && /best_man|maid_of_honor/.test(r.key)).map((r) => r.label), ['Maid of Honor & Matron of Honor', 'Best Man & Best Woman']);

  /* no honour attendant, no honour row; and a group made only of honour attendants is not drawn */
  const none = keys(studioAttireRows(t([['bridesmaid', 3], ['groomsman', 3]]), null));
  assert.ok(!none.includes('roles:maid_of_honor') && !none.includes('roles:best_man'), 'an honour row with nobody in it');
  const only = studioAttireRows(t([['best_woman', 1]]), null);
  assert.deepEqual(keys(only).filter((x) => /groomsmen|best_man/.test(x)), ['roles:best_man'], 'a Groomsmen row of nobody');
  assert.equal(only.find((r) => r.key === 'best_man')?.label, 'Best Man & Best Woman');
  assert.deepEqual(only.find((r) => r.key === 'best_man')?.honourColumns, [1]);
  assert.equal(only.find((r) => r.key === 'best_man')?.fallsBackTo, undefined, 'it points at a Groomsmen row that is not drawn');
});

/* ── 2 · each column, its own list ────────────────────────────────────────── */

test('2 · the best man wears the groom’s list (Tuxedo too); the best woman and the maid / matron the maid of honor’s', () => {
  const bm = attireRow('roles', 'best_man')!;
  const moh = attireRow('roles', 'maid_of_honor')!;
  assert.deepEqual(bm.who, ['m', 'f'], 'the best man’s row is not two columns, men · women');
  /* 🤵‍♂️ 2026-10-19: one woman (the maid AND the matron — "same character. both female") and the man of honor */
  assert.deepEqual(moh.who, ['f', 'm'], 'the maid / matron row is not FOR WOMEN · FOR MEN');
  assert.deepEqual([...pickOptions(moh, 1)], [...roleDesigns('best_man')], 'the man of honor does not wear the best man’s list');
  assert.deepEqual([...pickOptions(bm, 0)], [...roleDesigns('groom')]);
  assert.ok(pickOptions(bm, 0).includes('tuxedo'));
  assert.deepEqual([...pickOptions(bm, 1)], ['long_gown', 'cocktail_dress', 'filipiniana']);
  assert.deepEqual([...pickOptions(moh, 0)], ['long_gown', 'cocktail_dress', 'filipiniana']);
});

/* ── 3 · who reads which row ─────────────────────────────────────────────── */

const BASE = {
  groups: { bridesmaids: { style: 'long_gown', callTime: '14:00' }, groomsmen: { style: 'suit', callTime: '14:00' } },
} as Record<string, unknown>;
const DRESSED = {
  ...BASE,
  roles: { maid_of_honor: { style: 'cocktail_dress', callTime: '13:30', note: 'Dusty rose' }, best_man: { style: 'tuxedo', callTime: '13:00' } },
  women: { roles: { best_man: { style: 'filipiniana' } } },
} as Record<string, unknown>;
const palette = resolveDisplayPalette(sanitizeRolePalette({ maid_of_honor: ['#803236'], bridesmaids: ['#646B38'], best_man: ['#1F3A5F'], groomsmen: ['#2C2A29'] }));

function reads(role: GuestRole, config: Record<string, unknown>) {
  const roles = sanitizeRoleAttire(config.roles, isDressableRole);
  const groups = sanitizeGroupAttire(config.groups);
  const r = resolveGuestAttireWithGroups({ role, roles, groups, palette, config });
  const own = r.panel
    ? readerAttire({ role, attire: null, person: null, source: r.source, config, style: r.panel.style, hexes: r.panel.hexes, label: (s: AttireStyle) => ATTIRE_STYLE_LABEL[s], single: singleWearerOf })
    : null;
  return { source: r.source, style: own?.styleLabel ?? null, callTime: r.panel?.callTime ?? null, note: r.panel?.note ?? null };
}

test('3 · her row once her Wear is picked there, her group’s until then — the fallback stays', () => {
  /* unset → the group, exactly as before the rows existed */
  for (const role of ['maid_of_honor', 'matron_of_honor'] as const) {
    assert.equal(studioRowOf(role, BASE)?.key, 'bridesmaids');
    assert.deepEqual(reads(role, BASE), { source: 'group', style: 'Long gown', callTime: '2:00 PM', note: null }, `${role}: lost the Bridesmaids’ look`);
  }
  for (const role of ['best_man', 'best_woman'] as const) assert.equal(studioRowOf(role, BASE)?.key, 'groomsmen');
  assert.deepEqual(reads('best_man', BASE), { source: 'group', style: 'Suit and tie', callTime: '2:00 PM', note: null });
  /* without the config (a caller asking only for the group) — the group row, as before */
  assert.equal(studioRowOf('maid_of_honor')?.key, 'bridesmaids');

  /* dressed → the honour row: its Wear, its one call time and its one note, for both people of the pair */
  for (const role of ['maid_of_honor', 'matron_of_honor'] as const) {
    assert.equal(studioRowOf(role, DRESSED)?.key, 'maid_of_honor');
    assert.deepEqual(reads(role, DRESSED), { source: 'role', style: 'Cocktail dress', callTime: '1:30 PM', note: 'Dusty rose' }, role);
  }
  assert.deepEqual(reads('best_man', DRESSED), { source: 'role', style: 'Tuxedo', callTime: '1:00 PM', note: null });
  assert.deepEqual(reads('best_woman', DRESSED), { source: 'role', style: 'Filipiniana', callTime: '1:00 PM', note: null }, 'the best woman did not read the women’s column');

  /* the best man dressed, the best woman not → she keeps the Groomsmen's row (each column switches on its own Wear) */
  const manOnly = { ...BASE, roles: { best_man: { style: 'tuxedo' } } };
  assert.equal(honourRowSpeaks(manOnly, 'best_man'), true);
  assert.equal(honourRowSpeaks(manOnly, 'best_woman'), false);
  assert.equal(studioRowOf('best_woman', manOnly)?.key, 'groomsmen');

  /* colours alone do not move anyone off their group */
  assert.equal(honourRowSpeaks({ ...BASE }, 'maid_of_honor'), false);
});

/* ── 4 · the guest page says it ───────────────────────────────────────────── */

const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
async function wear(guestRole: GuestRole, config: Record<string, unknown>): Promise<string> {
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const rolePalette = { maid_of_honor: ['#803236'], bridesmaids: ['#646B38'], best_man: ['#1F3A5F'], groomsmen: ['#2C2A29'], touched_roles: ['maid_of_honor', 'bridesmaids', 'best_man', 'groomsmen'] };
  const parts = await Promise.all(
    (['wear', 'arrive'] as const).map((part) => renderToStaticMarkup(React.createElement(DressCodeWidget as never, { words, config, rolePalette, guestRole, part }))),
  );
  return parts.join('\n').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}

test('4 · Me › What to wear: her row’s Wear and time once set; the Bridesmaids’ until then', async () => {
  const unset = await wear('maid_of_honor', BASE);
  assert.match(unset, /data-me-part="wear"/, 'precondition: What to wear is drawn');
  assert.match(unset, /Long gown/, 'an unset maid of honor lost the Bridesmaids’ Wear');
  assert.match(unset, /From your hosts’ note for Bridesmaids|From your hosts&rsquo; note for Bridesmaids|note for Bridesmaids/, 'she is not told the answer is her group’s');
  assert.match(unset, /2:00 PM/);

  const set = await wear('maid_of_honor', DRESSED);
  assert.match(set, /Cocktail dress/, 'her own row’s Wear is not what she is told');
  assert.doesNotMatch(set, /Long gown/, 'she is still told the Bridesmaids’ Wear');
  assert.doesNotMatch(set, /note for Bridesmaids/, 'her own row’s answer is credited to the Bridesmaids');
  assert.match(set, /1:30 PM/, 'her row’s call time is not her Arrive by');
  assert.match(set, /#803236/i, 'she does not wear her row’s colour');

  const bestWoman = await wear('best_woman', DRESSED);
  assert.match(bestWoman, /Filipiniana/);
  assert.doesNotMatch(bestWoman, /Tuxedo/, 'the best woman was told the best man’s Wear');
});

/* ── 5 · the Studio draws them, the general view lists them ───────────────── */

test('5 · the Studio draws the honour rows: a figure per column, one Wear ▾ each, one call time, one note', async () => {
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const R = require('react') as { useState: (init: unknown) => unknown };
  const real = R.useState;
  let answered = false;
  R.useState = (init: unknown) => {
    if (init === 'colours' && !answered) {
      answered = true;
      return ['attire', () => {}];
    }
    return real(init);
  };
  const draw = (config: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(MoodBoardStudio as never, {
        eventId: 'e',
        inspirationParts: fallbackInspirationParts(),
        palette: { reception: ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'] },
        fallbackFive: ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'],
        frozenDressing: [],
        changes: [],
        attire: studioAttireRows(PARTY, config),
        dressConfig: config,
        attireStyles: [],
        inspirations: [],
        autoThemes: [],
        regions: [],
        dosLists: null,
        dosLookCanvas: null,
      }),
    );
  let html: string;
  let dressed: string;
  try {
    html = draw(BASE);
    answered = false;
    dressed = draw(DRESSED);
  } finally {
    R.useState = real;
  }
  const section = (h: string, key: string) => {
    const at = h.indexOf(`data-mood-board-role="${key}"`);
    assert.ok(at >= 0, `no ${key} row is drawn`);
    const end = h.indexOf('data-mood-board-role="', at + 10);
    return end < 0 ? h.slice(at) : h.slice(at, end);
  };
  const bm = section(dressed, 'best_man');
  assert.match(bm, /data-mood-board-picks="2"/, 'the best man’s row is not two columns');
  assert.equal((bm.match(/data-mood-board-figure=/g) ?? []).length, 2, 'not a figure per column');
  assert.equal((bm.match(/data-mood-board-wear-for=/g) ?? []).length, 2, 'not one Wear ▾ per column');
  assert.equal((bm.match(/data-mood-board-call-time=/g) ?? []).length > 0, true, 'no call time on the row');
  assert.match(bm, /data-mood-board-role-note="best_man"/, 'no note on the row');
  const moh = section(dressed, 'maid_of_honor');
  assert.match(moh, /data-mood-board-picks="1"/);
  assert.match(moh, /Cocktail dress/);
  /* undressed, the row says whose look its people keep */
  assert.match(section(html, 'maid_of_honor'), /data-mood-board-falls-back="maid_of_honor"[^>]*>[^<]*Bridesmaids/);
  assert.doesNotMatch(moh, /data-mood-board-falls-back=/, 'a dressed row still says they dress as the Bridesmaids');
});

test('5 · the general view (the Event Hub, the prints) lists an honour row like every other, named for both of its pair', () => {
  const stored = sanitizeRolePalette({});
  const everyone = dressCodeForEveryone({ config: DRESSED, stored, board: resolveDisplayPalette(stored) });
  const row = (k: string) => everyone.rows.find((r) => r.rowKey === k);
  assert.equal(row('best_man')?.label, 'Best Man & Best Woman');
  assert.deepEqual(row('best_man')?.picks.map((p) => p.styleLabel), ['Tuxedo', 'Filipiniana']);
  assert.equal(row('maid_of_honor')?.label, 'Maid of Honor & Matron of Honor');
  const manOnly = dressCodeForEveryone({ config: { roles: { best_man: { style: 'tuxedo' } } }, stored, board: resolveDisplayPalette(stored) });
  assert.equal(manOnly.rows.find((r) => r.rowKey === 'best_man')?.label, 'Best Man & Best Woman');
  assert.equal(dressCodeForEveryone({ config: BASE, stored, board: resolveDisplayPalette(stored) }).rows.some((r) => r.rowKey === 'maid_of_honor' || r.rowKey === 'best_man'), false, 'an honour row nobody dressed');
});
