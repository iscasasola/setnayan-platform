/**
 * the-print-says-the-pages-dress-code.test.ts — 👗 THE PRINTS SAY THE DRESS CODE THE GUEST PAGE SAYS (2026-10-18).
 *
 * Since 2026-10-17 the guest page's Dress code reads the Studio's own rows and people (`dressCodeForEveryone` —
 * `ATTIRE_ROWS` + `picksOf`): a two-pick row's men's and women's Wear, nothing for a row the Studio has no row for. The
 * prints (`lib/print-set.server.ts`) still read the OLD stores (`dress_code_config.groups` / `.roles`), so the card
 * printed "Maid of Honor — Long gown" (a line the page no longer draws) and never the women's pick. Held here:
 *   (1) paper's lines are the page's rows — every row with a Wear, in the page's order, each person named on a row of
 *       two, the couple's note after it; a row the Studio has no row for prints nothing;
 *   (2) the print reads ONLY that — `dressCodeLines(dressCodeForEveryone(…))` on the board the page uses — and reads
 *       the ceremony, which decides the Nikah principals' row on the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { dressCodeForEveryone, dressCodeLines } from '@/lib/dress-code-for-everyone';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { resolveDisplayPalette } from '@/lib/room-palette';
import { ATTIRE_STYLE_LABEL } from '@/lib/role-dress-code';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* A board with the couple's own colours on two rows, and a dress code saved through every store there has been. */
const PALETTE = { principal_sponsors: ['#7a1f2b', '#c9a227'], reception: ['#7a1f2b'], touched_roles: ['principal_sponsors'] };
const CONFIG = {
  groups: { principal_sponsors: { style: 'barong_tagalog', note: 'ivory, not white' }, groomsmen: { style: 'suit' } },
  roles: { maid_of_honor: { style: 'long_gown' }, bride: { style: 'ball_gown' } },
  women: { groups: { principal_sponsors: { style: 'filipiniana' } } },
};
const page = (config: unknown, ceremonyType: string | null = null) => {
  const stored = sanitizeRolePalette(PALETTE);
  return dressCodeForEveryone({ config, stored, board: resolveDisplayPalette(stored), ceremonyType });
};

test("(1) paper's dress code is the page's rows — both picks of a row of two, the note, nothing the Studio has no row for", () => {
  const everyone = page(CONFIG);
  const lines = dressCodeLines(everyone);
  const sponsors = lines.find((l) => /sponsor/i.test(l.label) && /principal/i.test(l.label));
  assert.ok(sponsors, `no Principal Sponsors line: ${JSON.stringify(lines)}`);
  assert.match(sponsors.line, /^For men: [^·]+ · For women: [^,]+, ivory, not white$/, `the row's two picks and its note: ${sponsors.line}`);
  assert.match(sponsors.line, /Filipiniana/, "the women's pick (stored only in `women`) is not on paper");
  assert.ok(!lines.some((l) => /maid of honor/i.test(l.label)), 'a per-role line the page no longer draws is printed');
  /* Every row the page shows with a Wear is on paper, in the page's order, under the page's label. */
  const withWear = everyone.rows.filter((r) => r.picks.some((p) => p.styleLabel));
  assert.deepEqual(lines.map((l) => l.label), withWear.map((r) => r.label));
  assert.ok(lines.length >= 3, `the fixture printed too little to mean anything: ${JSON.stringify(lines)}`);
  /* A row of one says its Wear plainly (no "For …:"), in the page's own word. */
  const bride = lines.find((l) => /bride/i.test(l.label) && !/maid/i.test(l.label));
  assert.ok(bride && !bride.line.includes(':'), `the bride's line: ${JSON.stringify(bride)}`);
  /* Colours only → no line (the card's swatches carry them); nothing said → nothing printed. */
  assert.deepEqual(dressCodeLines(page({})), []);
  assert.deepEqual(dressCodeLines(page(null)), []);
  assert.ok(Object.values(ATTIRE_STYLE_LABEL).length > 5);
});

test('(2) the print reads only the page\'s rows — on the page\'s board — and the ceremony that decides them', () => {
  const src = read('lib/print-set.server.ts');
  assert.match(src, /dressCodeLines\(dressCodeForEveryone\(\{ config: raw, stored, board: resolveDisplayPalette\(stored\), ceremonyType: ceremonyType \?\? null, names: names \?\? null \}\)\)/);
  assert.match(src, /attire: attireLines\(event\.dress_code_config, event\.role_palette, event\.ceremony_type, readRoleNames\(event\.role_names\)\)/);
  assert.doesNotMatch(src, /sanitizeGroupAttire|sanitizeRoleAttire|cfg\.groups|cfg\.roles/, 'the print reads the old dress-code stores again');
  const columns = /const EVENT_COLUMNS =\s*'([^']+)'/.exec(src)?.[1] ?? '';
  assert.match(columns, /\bceremony_type\b/, 'the print does not read the ceremony — a Nikah ceremony would lose its principals’ row on paper');
  /* The page builds the same view from the same three (`dress-code-widget.tsx`). */
  const widget = read('app/[slug]/_components/dress-code-widget.tsx');
  assert.match(widget, /const stored = sanitizeRolePalette\(rolePalette\);\s*const board = resolveDisplayPalette\(stored\);/);
  assert.match(widget, /dressCodeForEveryone\(\{ config, stored, board, ceremonyType, names: roleNames \}\)/);
  /* A Nikah ceremony's principals' row is on paper exactly when it is on the page. */
  const nikah = { ...CONFIG, groups: { ...CONFIG.groups, muslim_principals: { style: 'formal' } } };
  const has = (ceremony: string | null) => dressCodeLines(page(nikah, ceremony)).length;
  assert.ok(has('muslim') > has(null), 'the ceremony does not decide the Nikah row');
});
