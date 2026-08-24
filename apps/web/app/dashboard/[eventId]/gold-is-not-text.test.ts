/**
 * gold-is-not-text.test.ts — colour that fails AA may not paint words on the
 * four screens a couple lives in, IN ANY SPELLING.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * In this repo the Tailwind slot named `terracotta` is the atelier GOLD
 * #A9834B — 3.37:1 on the white page ground, BELOW the 4.5:1 AA floor for
 * text. It is legal on ICONS and control accents (the 3:1 non-text bar) and
 * illegal on words. The sanctioned text gold is `terracotta-700` (#8C6932).
 *
 * ── ⚠ WHY THIS FILE WAS REWRITTEN — READ BEFORE EXTENDING IT ──────────────
 * Rev 1 of this guard matched CLASS NAMES only. An adversarial audit of the
 * W4-A stream then found that its author had swept for one SPELLING of a
 * colour, found every instance of that spelling, and reported that the colour
 * delta was closed. It was not. What the class-name rule could not see:
 *
 *   · alaala paints EXCLUSIVELY through inline `style={{ color: 'var(--m-…)' }}`,
 *     so this guard listed that screen and its real coverage there was ZERO.
 *     Its 01…06 stage numerals were `--m-orange-3` #CBA766 at 2.03:1 — WORSE
 *     than the 3.37:1 gold this guard exists to remove — in a file the stream
 *     edited the same day.
 *   · A second gold ERROR message (`.plan-err`, #9a6a12) survived one file away
 *     from the one the stream fixed, because it is written as a hex.
 *   · Components that RENDER on these screens but live one directory up in
 *     `_components/` were outside the walk entirely.
 *
 * 🔑 THE LESSON, AND THE REASON FOR THE THREE RULES BELOW: a guard that knows
 * one spelling of a value is a guard against that spelling, not against the
 * value. Colour reaches these screens as a class, as a raw hex, and as a CSS
 * variable — so all three are checked.
 *
 * 🔑 AND THE COVERAGE IS RESOLVED, NOT ENUMERATED. `filesUnderGuard()` follows
 * the four trees' own imports into `_components/`. A hand-written file list is
 * a list of the files somebody thought of; this one is a list of what actually
 * renders. Add a component to a screen and it is guarded automatically.
 *
 * ── What is exempt, and by SHAPE ──────────────────────────────────────────
 * Gold on an ICON, a checkbox accent, a focus ring or a BORDER is legal — the
 * non-text bar is 3:1 and gold clears it. Those are billed, not banned.
 *
 * ── The bill is a BILL, not a decision ────────────────────────────────────
 * Keyed file + count, checked in BOTH directions: a new bare use fails, and so
 * does a fixed one whose bill line was left behind. It only ever gets shorter.
 * Do not add to it to make this test pass; icons only.
 *
 * 🛡 Every rule mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname);
const TREES = ['guests', 'vendors', 'budget', 'alaala'];

/**
 * Colour values MEASURED below the AA text floor on the surface they actually
 * land on. Banned as text in every spelling. Each carries its measurement so a
 * future reader can check the arithmetic rather than trust the table.
 */
const BELOW_AA_AS_TEXT: ReadonlyArray<{
  readonly spellings: readonly string[];
  readonly measured: string;
}> = [
  {
    // The alaala arc numerals wore this. It is the palette's LIGHT decorative
    // gold — fine behind something, never on top of a near-white card.
    spellings: ['#CBA766', 'var(--m-orange-3)'],
    measured: '2.03:1 on the --m-paper-2 card (#F4F2EC) — worse than bare gold',
  },
  {
    // Two gold "error" colours lived here; both are refusals, not accents.
    spellings: ['#9a6a12'],
    measured: '3.88:1 on the .16 gold pills, 4.56:1 on paper — fails either way',
  },
  {
    spellings: ['#8A857B', 'var(--m-slate-3)'],
    measured: '3.67:1 on white — the "coming soon" marker was invisible',
  },
  {
    // Stock Tailwind ambers. Off-palette AND below the floor.
    spellings: ['#D97706', '#B45309', '#F59E0B'],
    measured: 'off-ladder amber, never measured against this ground',
  },
];

/** Remaining sanctioned bare `text-terracotta` uses — icons, checkbox accents,
 * decorative arrows. This list only ever gets SHORTER. */
const BILL: ReadonlyArray<readonly [string, number]> = [
  ['budget/_components/budget-live-summary.tsx', 1],
  ['budget/_components/share-budget-band-toggle.tsx', 1],
  ['guests/[guestId]/page.tsx', 4],
  ['guests/_components/guest-list-multiselect.tsx', 4],
  ['guests/_components/mobile-guest-carousel.tsx', 1],
  ['guests/checkin/page.tsx', 1],
  ['guests/claims/page.tsx', 1],
  ['guests/invite/page.tsx', 2],
  ['guests/new/page.tsx', 2],
  ['guests/souvenirs/_components/souvenir-desk.tsx', 1],
  ['guests/souvenirs/page.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/change-order-trail.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/deposit-reservation.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/handover-inbox.tsx', 2],
  ['vendors/[vendorId]/workspace/_components/host-service-details.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/quote-bridge.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/reservation-terms-ack.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/vendor-proposals-card.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/working-folder-notes.tsx', 1],
  ['vendors/[vendorId]/workspace/page.tsx', 6],
  ['vendors/_components/accordion-lock.tsx', 3],
  ['vendors/_components/build-compare.tsx', 2],
  ['vendors/_components/build-locked.tsx', 1],
  ['vendors/_components/lock-milestone.tsx', 1],
  ['vendors/_components/merkado-budget-lens.tsx', 2],
  ['vendors/_components/merkado-guard-banner.tsx', 1],
  ['vendors/_components/pending-lock-proposals.tsx', 1],
  ['vendors/_components/quote-fill.tsx', 1],
  ['vendors/_components/reuse-bookings-panel.tsx', 1],
  ['vendors/_components/services-takeover.tsx', 2],
  ['vendors/_components/team-controls.tsx', 1],
  ['vendors/_components/vendor-quickview-inspector.tsx', 1],
  ['vendors/packages/[bookingId]/page.tsx', 1],
  ['_components/new-manual-vendor-modal.tsx', 1],
  ['_components/vendor-itemization-card.tsx', 1],
  ['_components/vendor-marketplace-info.tsx', 4],
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.'))
      out.push(p);
  }
  return out;
}

/**
 * The four trees, PLUS every `_components/` file they import. Resolved from the
 * imports themselves so coverage follows what renders — see the note above on
 * why a hand-written list is the wrong shape here.
 */
function filesUnderGuard(): string[] {
  const treeFiles = TREES.flatMap((t) => walk(join(ROOT, t)));
  const shared = new Set<string>();
  const importRe = /_components\/([a-z0-9-]+)'/g;
  for (const f of treeFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(importRe)) {
      const candidate = join(ROOT, '_components', `${m[1]}.tsx`);
      if (existsSync(candidate)) shared.add(candidate);
    }
  }
  return [...treeFiles, ...shared];
}

/** Strip block and line comments before matching, so a note that merely NAMES a
 * class or a hex cannot fire the guard (the design#6 lint cried wolf on exactly
 * that). Every rule below matches on the stripped source. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function bareGoldCount(src: string): number {
  // NOT followed by `-`: `text-terracotta-700` is the sanctioned text gold, and
  // a prefix match would count the fix as the defect (the `f.event_dateX` trap).
  return (stripComments(src).match(/text-terracotta(?!-)/g) ?? []).length;
}

test('bare gold appears only where the bill sanctions it — both directions', () => {
  const billed = new Map(BILL.map(([f, n]) => [f, n]));
  const failures: string[] = [];
  for (const file of filesUnderGuard()) {
    const rel = relative(ROOT, file);
    const actual = bareGoldCount(readFileSync(file, 'utf8'));
    const expected = billed.get(rel) ?? 0;
    billed.delete(rel);
    if (actual > expected) {
      failures.push(
        `${rel}: ${actual} bare text-terracotta, bill sanctions ${expected}. ` +
          `Gold is 3.37:1 on the page ground — below AA for text. Use ` +
          `text-terracotta-700 for kickers/accents, text-mulberry or text-link ` +
          `for links. Add to the bill ONLY for an icon.`,
      );
    } else if (actual < expected) {
      failures.push(
        `${rel}: ${actual} bare text-terracotta but the bill still says ` +
          `${expected}. A billed use was fixed or removed — shrink its bill ` +
          `entry in the same commit so the bill stays true.`,
      );
    }
  }
  for (const [file, n] of billed) {
    failures.push(
      `${file} is billed for ${n} but is no longer under guard — delete its ` +
        `bill entry.`,
    );
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
});

test('no malformed terracotta shade class survives (the -700-700 typo shape)', () => {
  // `text-terracotta-700-700` is not a class Tailwind generates — it styles
  // NOTHING, so the element silently keeps its inherited colour. One shipped in
  // invited-to-chips.tsx and the checked chip lost its tint.
  const offenders: string[] = [];
  for (const file of filesUnderGuard()) {
    const hits =
      stripComments(readFileSync(file, 'utf8')).match(
        /text-terracotta-\d+-\d+/g,
      ) ?? [];
    if (hits.length > 0)
      offenders.push(`${relative(ROOT, file)}: ${hits.join(', ')}`);
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
});

/**
 * alaala is the one tree that paints ENTIRELY in raw literals and inline vars —
 * it has no Tailwind colour classes at all. So for that tree the literals ARE
 * the styling system, and an inventory is the only way a guard can see them.
 * Every entry carries its MEASURED ratio against the surface it lands on.
 *
 * ⚠ These two golds MUST STAY LITERALS. The themed `terracotta-700` token flips
 * to #A88340 in dark, where the white count on it reads 3.51:1 — an AA fail.
 * "Just tokenize it" is the obvious change here and it is the wrong one.
 */
const ALAALA_LITERAL_INVENTORY: Readonly<Record<string, string>> = {
  '#5C4726': 'density badge, hottest — white 10px bold on it = 8.81:1',
  '#8C6932': 'density badge, warm — white 10px bold on it = 5.02:1',
  '#FFF': 'the badge count itself, on the two golds above',
};

test('alaala grows no unmeasured colour literal', () => {
  // Rev 1 of this guard could not see this screen at all. A banned-values list
  // only catches the failures somebody already knows about; an inventory catches
  // the NEXT one, which is the whole point — the 2.03:1 numerals were nobody's
  // known-bad value until they were measured.
  const offenders: string[] = [];
  for (const file of filesUnderGuard()) {
    const rel = relative(ROOT, file);
    if (!rel.startsWith('alaala/')) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const hit of src.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []) {
      if (!(hit.toUpperCase() in ALAALA_LITERAL_INVENTORY)) {
        offenders.push(
          `${rel}: colour literal \`${hit}\` is not in the alaala inventory. ` +
            `This tree has no colour classes, so a literal here is invisible to ` +
            `every token-reading check. MEASURE it against the surface it lands ` +
            `on and add it with its ratio — or use a token class instead.`,
        );
      }
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
});

test('no measured-below-AA colour paints text, in ANY spelling', () => {
  // The rule rev 1 did not have, and the reason alaala was listed but unguarded.
  // Matches a `color:` position only — the same value behind something, or on a
  // border, is legal under the 3:1 non-text bar and is not this rule's business.
  const offenders: string[] = [];
  for (const file of filesUnderGuard()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const { spellings, measured } of BELOW_AA_AS_TEXT) {
      for (const spelling of spellings) {
        // `color: '#X'` / `color:#X` / `color: 'var(--x)'` / `color:var(--x)`,
        // covering both the JSX style-object and the CSS-in-template forms.
        const re = new RegExp(
          `color:\\s*'?"?${spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'?"?`,
          'gi',
        );
        const hits = (src.match(re) ?? []).length;
        if (hits > 0) {
          offenders.push(
            `${relative(ROOT, file)}: ${hits}× \`${spelling}\` as a text colour ` +
              `— measured ${measured}. Pick a value that clears 4.5:1 against ` +
              `the surface it actually lands on, not against white.`,
          );
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
});
