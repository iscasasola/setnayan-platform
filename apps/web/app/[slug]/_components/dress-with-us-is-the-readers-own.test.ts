/**
 * 👗 "DRESS WITH US" IS THE READER'S OWN — owner 2026-10-19, DECISION_LOG "DRESS WITH US SHOWS ONLY THE GUEST'S OWN
 * ROLE": *"Dress with us should only show their role. and the do's and dont's"* · *"not both gender to show?"*.
 *
 * Held on the REAL widget's markup, as PROPERTIES over every reader — never one phrasing:
 *   1 · a listed guest with a role (every role whose row the couple dressed) ⇒ EXACTLY their own card — the "You are"
 *       panel — and no other role's row; the Do's & Don'ts still drawn;
 *   2 · their gender known ⇒ ONE column (no "For men" / "For women" pair in their panel); unknown ⇒ both;
 *   3 · a plain guest or a visitor ⇒ the Guests card only (+ Do's & Don'ts);
 *   4 · a role with nothing picked (and no group row) ⇒ the Guests card — never a bare "You are" heading; with no
 *       Guests card and no lists either, the scene is hidden;
 *   5 · the host (every-role view) ⇒ every row the general view lists — more than one;
 *   6 · the dispatchers wire it: a guest view is `readerOnly` unless the host reads their own Event Hub.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const h = React.createElement;
const WORDS = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;

/* The couple dressed: the parents' & family row (men · women), the sponsors (men · women), the groomsmen and the
   bridesmaids (colours picked), the bride, the groom, and the guests. */
const BOARD = {
  reception: ['#7A1F2B', '#C9A24B', '#F4E9DC'],
  bride: ['#F4E9DC'],
  groom: ['#2B1D14'],
  parents_immediate_family: ['#5A3E2B', '#C9A24B'],
  principal_sponsors: ['#C9A24B', '#F4E9DC'],
  bridesmaids: ['#8E3B5B'],
  groomsmen: ['#2B1D14', '#7A1F2B'],
  guest: ['#2B1D14', '#8E3B5B', '#C9A24B'],
  touched_roles: ['bride', 'groom', 'parents_immediate_family', 'principal_sponsors', 'bridesmaids', 'groomsmen', 'guest'],
};
const DOS = ['Wear the colours'];
const DONTS = ['No white'];
const DRESS = {
  groups: { principal_sponsors: { style: 'barong_tagalog' }, vip_family: { style: 'barong_tagalog' } },
  women: { groups: { principal_sponsors: { style: 'long_gown' }, vip_family: { style: 'long_gown' } } },
  dos: DOS,
  donts: DONTS,
};

function render(extra: Record<string, unknown>, config: unknown = DRESS, board: unknown = BOARD): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DressCodeWidget } = require('./dress-code-widget') as typeof import('./dress-code-widget');
  return renderToStaticMarkup(h(DressCodeWidget, { words: WORDS, config, rolePalette: board, hideWhenEmpty: true, ...extra } as never));
}
const rowsOf = (markup: string): string[] => [...markup.matchAll(/data-role-row="([^"]+)"/g)].map((m) => m[1]!);
const hasYou = (markup: string): boolean => markup.includes('data-dress-code="you"');
const hasDos = (markup: string): boolean => markup.includes('No white') && markup.includes('Wear the colours');
/** The "You are" panel, cut at its own close (it is the first `div` with the mark). */
function youPanel(markup: string): string {
  const at = markup.indexOf('data-dress-code="you"');
  if (at < 0) return '';
  const open = markup.lastIndexOf('<', at);
  let depth = 0;
  const re = /<(\/?)div\b[^>]*>/g;
  re.lastIndex = open;
  for (let m = re.exec(markup); m; m = re.exec(markup)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return markup.slice(open, re.lastIndex);
  }
  return markup.slice(open);
}
const bothColumns = (panel: string): boolean => /For men/.test(panel) && /For women/.test(panel);

/* Every role the fixture dresses (through its own row or its group's). */
const DRESSED = [
  'bride', 'groom',
  'bride_parents', 'groom_parents', 'bride_grandparents', 'groom_immediate_family',
  'principal_sponsor', 'principal_sponsor_ninang', 'principal_sponsor_ninong',
  'bridesmaid', 'groomsman', 'maid_of_honor', 'best_man',
] as const;

test('1 · a listed guest with a role sees EXACTLY their own card — no other role — and the Do’s & Don’ts', () => {
  const everyRole = rowsOf(render({}));
  assert.ok(everyRole.length > 3, `the fixture dresses many rows (got ${everyRole.length})`);
  for (const role of DRESSED) {
    const out = render({ guestRole: role, readerOnly: true });
    assert.ok(hasYou(out), `${role}: their own "You are" card is drawn`);
    assert.deepEqual(rowsOf(out), [], `${role}: no other role's card (drew ${rowsOf(out).join(', ')})`);
    assert.ok(hasDos(out), `${role}: the Do's & Don'ts are drawn`);
    assert.equal((out.match(/data-dress-code="you"/g) ?? []).length, 1, `${role}: one card, not two`);
  }
});

test('2 · gender known ⇒ ONE column; unknown ⇒ both', () => {
  /* A parent and a sponsor whose role does not say it (the role-word cases — ninang/ninong — say it themselves). */
  for (const role of ['bride_parents', 'groom_parents', 'principal_sponsor', 'bride_immediate_family'] as const) {
    const unknown = youPanel(render({ guestRole: role, readerOnly: true }));
    assert.ok(bothColumns(unknown), `${role}, gender unknown: both columns`);
    for (const g of ['woman', 'man'] as const) {
      const panel = youPanel(render({ guestRole: role, guestGender: g, readerOnly: true }));
      assert.ok(panel.length > 0, `${role} (${g}): the card is drawn`);
      assert.ok(!bothColumns(panel), `${role} (${g}): one column only`);
      const swatches = (panel.match(/data-your-colours=""/g) ?? []).length;
      assert.equal(swatches, 1, `${role} (${g}): one set of colours`);
    }
    /* The gender beats the clothing: a woman the seat plan put in a suit is still shown the women's column. (The
       "You are …" word is cut: the role word reading gender is rd/me-reads-their-gender's.) */
    const look = (m: string) => m.replace(/You are [^<]*/, '');
    const woman = look(youPanel(render({ guestRole: role, guestGender: 'woman', guestAttire: 'suit', readerOnly: true })));
    const womanOnly = look(youPanel(render({ guestRole: role, guestGender: 'woman', readerOnly: true })));
    assert.equal(woman, womanOnly, `${role}: gender wins over attire`);
  }
});

test('3 · a plain guest or a visitor sees the Guests card only (+ Do’s & Don’ts)', () => {
  for (const role of ['guest', null] as const) {
    const out = render({ guestRole: role, readerOnly: true });
    assert.deepEqual(rowsOf(out), ['guest'], `${role ?? 'visitor'}: the Guests card alone`);
    assert.ok(!hasYou(out), `${role ?? 'visitor'}: no "You are" card`);
    assert.ok(hasDos(out), `${role ?? 'visitor'}: the Do's & Don'ts are drawn`);
  }
});

test('4 · nothing picked for the role ⇒ the Guests card, never a bare heading; nothing at all ⇒ hidden', () => {
  /* The officiant's row is not dressed in the fixture (no colours, no Wear). */
  const out = render({ guestRole: 'officiant', readerOnly: true });
  assert.ok(!hasYou(out), 'no bare "You are Officiant" card');
  assert.deepEqual(rowsOf(out), ['guest'], 'the Guests card instead');
  /* No Guests row either, and no lists: nothing to draw. */
  const bare = { reception: ['#7A1F2B'], touched_roles: [] };
  assert.equal(render({ guestRole: 'officiant', readerOnly: true }, {}, bare), '', 'the scene stays hidden');
  assert.equal(render({ guestRole: null, readerOnly: true }, {}, bare), '', 'a visitor: hidden too');
  /* An honour attendant whose own row has no Wear falls back to their group's card (the Bridesmaids). */
  const maid = render({ guestRole: 'maid_of_honor', readerOnly: true });
  assert.ok(hasYou(maid) && rowsOf(maid).length === 0, 'the maid of honor reads the Bridesmaids card as her own');
});

test('5 · the host (every-role view) still sees every role', () => {
  const host = render({ guestRole: null, readerOnly: false });
  const rows = rowsOf(host);
  assert.ok(rows.length > 3, `every dressed row (got ${rows.join(', ')})`);
  for (const k of ['bride', 'groom', 'principal_sponsors', 'guest']) assert.ok(rows.includes(k), `the host sees ${k}`);
});

const ROOT = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

test('6 · the dispatchers wire it: a guest view is reader-only unless the host reads their own Event Hub', () => {
  const guestPath = read('app/[slug]/_components/hideable-widget-render.tsx');
  const publicPath = read('app/[slug]/_components/public-hideable-widget.tsx');
  for (const [name, src] of [['hideable-widget-render', guestPath], ['public-hideable-widget', publicPath]] as const) {
    const lines = src.split('\n').filter((l) => l.includes('<DressCodeWidget'));
    assert.equal(lines.length, 1, `${name}: one dress-code mount`);
    assert.match(lines[0]!, /readerOnly=\{guestView && !dressCodeEveryRole\}/, `${name}: a guest view is reader-only`);
  }
  assert.match(guestPath.split('\n').find((l) => l.includes('<DressCodeWidget'))!, /guestGender=\{guestView && !dressCodeEveryRole && guest \? guestGenderOf\(guest\) : null\}/);
  const body = read('app/[slug]/_components/site-body.tsx');
  const every = [...body.matchAll(/dressCodeEveryRole=\{([^}]*)\}/g)].map((m) => m[1]!);
  assert.ok(every.length >= 2, 'both doors are told who is reading');
  for (const e of every) assert.match(e, /^viewerIsHost && sampleViewer === null\b/, `only a host, never a sample: ${e}`);
  /* The guest tree: only the host's OWN row — a host who opened another guest's pass sees that guest's card. */
  assert.ok(every.some((e) => /guest\.guest_id === hostOwnGuestId/.test(e)), 'the guest tree checks the host’s own row');
  /* The guest's gender is read with the rest of their row. */
  assert.match(read('app/[slug]/_lib/loaders.ts'), /display_name, role, attire, gender,/);
});
