/**
 * team-summary-chip.test.ts — guards the mobile team summary chip
 * (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §5, owner-approved 2026-07-29).
 *
 * The chip replaces the ONE takeover dock chip that carried live state (Build),
 * after PR-3 removed the 4-chip mobile dock. Its correctness is almost entirely
 * WIRING — where it docks, what it taps through to, and what it must NOT do —
 * and each of those is a thing a later edit can silently undo.
 *
 * ── WHY SOURCE ASSERTIONS ────────────────────────────────────────────────────
 * Same constraint as `bench-deep-link-anchor.test.ts`: this runner is
 * `tsx --test` with no jsdom and no testing-library in the workspace, and the
 * chip's parent (`build-locked.tsx`) is a server component that reads the whole
 * plan/budget model. So the pure money/copy derivation is tested for real
 * (`your-team.test.ts` already owns `teamMoney`/`bufferTile`), and the wiring
 * facts are pinned against the source. Every assertion below names the specific
 * regression it prevents.
 *
 * MUTATION-CHECKED: swapping the chip's `<button>` for a `<SubNav>` turns
 * "the chip is NOT a SubNav" red; dropping the `lg:hidden` turns
 * "the chip is mobile-only" red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bufferTile, teamMoney } from './your-team';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');

/** Source with comments stripped — the file documents the very things the
 *  "must NOT appear" assertions forbid, so a raw substring check would read the
 *  documentation as the violation. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

const CHIP = 'app/dashboard/[eventId]/vendors/_components/team-summary-chip.tsx';
const TEAM = 'app/dashboard/[eventId]/vendors/_components/build-locked.tsx';
const CSS = 'app/globals.css';

/* ═══════════════════════════════════════════════════════════════════════════
   1 · WHAT THE CHIP SAYS — the numbers come from the shipped derivation
   ═══════════════════════════════════════════════════════════════════════════ */

test('the chip words its buffer exactly like the Buffer tile', () => {
  // The spec's mock reads "₱82,000 buffer", but the shipped tile says "to
  // spare"/"over". The chip must reuse bufferTile() so one number is never
  // worded two ways on one screen.
  const money = teamMoney({
    lockedCentavos: 30_000_00,
    candidateCostsPhp: [48_000, 40_000],
    budgetPhp: 200_000,
  });
  assert.equal(money.bufferPhp, 82_000);
  assert.equal(bufferTile(money.bufferPhp).text, '₱82,000 to spare');
  assert.equal(bufferTile(money.bufferPhp).tone, 'good');
  // Over budget and no-budget-set are the two other states the chip renders.
  assert.equal(bufferTile(-1_500).text, '₱1,500 over');
  assert.equal(bufferTile(-1_500).tone, 'over');
  assert.equal(bufferTile(null).text, 'No budget set');
  assert.equal(bufferTile(null).tone, 'none');

  const src = code(CHIP);
  assert.match(src, /bufferText/, 'the chip takes the already-worded buffer string');
  assert.doesNotMatch(
    src,
    /toLocaleString/,
    'the chip must NOT format pesos itself — that is how the two surfaces drift',
  );
});

test('the parent passes bufferTile()/row counts, not hand-rolled numbers', () => {
  const src = code(TEAM);
  assert.match(
    src,
    /<TeamSummaryChip[\s\S]{0,240}lockedCount=\{lockedRows\.length\}/,
    'locked count is the rendered locked rows',
  );
  assert.match(
    src,
    /<TeamSummaryChip[\s\S]{0,240}inBuildCount=\{toLockRows\.length\}/,
    'in-build count is the rendered candidate rows',
  );
  assert.match(
    src,
    /<TeamSummaryChip[\s\S]{0,320}bufferText=\{buffer\.text\}[\s\S]{0,80}bufferTone=\{buffer\.tone\}/,
    'buffer copy + tone come from the same bufferTile() call as the tile',
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · WHEN IT SHOWS — never on an empty team, never on desktop, never flag-OFF
   ═══════════════════════════════════════════════════════════════════════════ */

test('the chip is suppressed when there is nothing to report', () => {
  // "0 locked · 0 in build" is noise; the section is one scroll away anyway.
  assert.match(
    code(TEAM),
    /lockedRows\.length > 0 \|\| toLockRows\.length > 0 \?\s*\(?\s*<TeamSummaryChip/,
    'the mount is gated on there being a locked row or a candidate',
  );
});

test('the chip only exists on the flag-ON return path', () => {
  const src = code(TEAM);
  const flagOff = src.indexOf('if (!replan)');
  const chip = src.indexOf('<TeamSummaryChip');
  assert.ok(flagOff > 0 && chip > 0, 'both landmarks present');
  assert.ok(
    chip > flagOff,
    'the chip is mounted AFTER the flag-OFF early return — flag OFF must stay byte-identical',
  );
});

test('the chip is mobile-only', () => {
  // Desktop shows the whole rail at once; a floating chip there is clutter.
  assert.match(code(CHIP), /lg:hidden/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · WHAT IT MUST NOT DO — the two regressions that would undo PR-3
   ═══════════════════════════════════════════════════════════════════════════ */

test('the chip is NOT a SubNav — that would re-collapse the bottom nav', () => {
  // <SubNav> increments a module-level docked count and <BottomNav> drops its
  // labels to icons-only while that count is > 0. Rendering the chip through
  // SubNav would put back the two-stacked-bars crowding PR-3 removed.
  const src = code(CHIP);
  assert.doesNotMatch(src, /from '@\/app\/_components\/nav\/sub-nav'/);
  assert.doesNotMatch(src, /<SubNav/);
  assert.doesNotMatch(src, /useSubNavDocked/);
});

test('the chip claims its OWN html clearance class, and globals.css honours it', () => {
  // Sharing `subnav-docked` with a dock means whichever unmounts first strips
  // the bottom clearance the other still needs.
  assert.match(code(CHIP), /classList\.add\('teamchip-docked'\)/);
  assert.match(code(CHIP), /classList\.remove\('teamchip-docked'\)/);
  assert.doesNotMatch(code(CHIP), /classList\.(add|remove)\('subnav-docked'\)/);

  const css = read(CSS);
  // Present in BOTH rules: the mobile padding and the ≥1024px cancel. Without
  // the second, desktop gets 8.5rem of dead space under the page.
  const occurrences = css.match(/html\.teamchip-docked \[data-shell-main\]/g) ?? [];
  assert.equal(occurrences.length, 2, 'clearance rule + its desktop cancel');
});

/* ═══════════════════════════════════════════════════════════════════════════
   4 · WHERE IT GOES — the docking geometry + the tap target
   ═══════════════════════════════════════════════════════════════════════════ */

test('the chip docks off the MEASURED bottom-nav height, not a guess', () => {
  const src = code(CHIP);
  assert.match(
    src,
    /var\(--sn-bottomnav-h, 64px\)/,
    'NavShell publishes the real height; a hardcoded guess drifts when the bar changes',
  );
  assert.match(src, /env\(safe-area-inset-bottom\)/);
  // z-20 sits under the bottom nav (z-30) and far under the category-search
  // overlay (z-120), which must be able to cover it.
  assert.match(src, /z-20/);
});

test('the chip portals to <body> and taps through to Your team', () => {
  const src = code(CHIP);
  assert.match(
    src,
    /createPortal\([\s\S]*document\.body/,
    'a fixed element inside the takeover would be trapped by its backdrop-filter ancestors',
  );
  assert.match(
    src,
    /goToBuildTab\('build'\)/,
    'the tap reuses the shipped section bus — no new navigation mechanism',
  );
});
