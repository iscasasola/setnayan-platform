/**
 * gold-is-not-text.test.ts — the gold slot may not paint words in the four
 * screens a couple lives in.
 *
 * ── The defect this pins (W4-A, 2026-08-24) ────────────────────────────────
 * In this repo the Tailwind slot named `terracotta` is the atelier GOLD
 * #A9834B — 3.37:1 on the white page ground, BELOW the 4.5:1 AA floor for
 * text. It is legal on ICONS and control accents (the 3:1 non-text bar) and
 * illegal on words. The sanctioned text gold is `terracotta-700` (#8C6932,
 * 5.02:1 light / 5.17:1 dark — the W1-B eyebrow fix); links may also use
 * `mulberry` (the action colour) or `link`.
 *
 * Sixteen kickers, links and hover states across the guests tree wore the
 * bare slot when this guard was written — plus one class that was not a
 * class at all: `has-[:checked]:text-terracotta-700-700`, a typo Tailwind
 * generates nothing for, so the checked chip silently kept ink text.
 *
 * ── How it polices ─────────────────────────────────────────────────────────
 * Comments are stripped before matching (a note that merely NAMES the class
 * must not fire — the design#6 lint cried wolf on exactly that). The match is
 * `text-terracotta` NOT followed by `-`: `text-terracotta-700` is the fix,
 * not the defect, and a prefix match would count it (the `f.event_dateX`
 * trap).
 *
 * ── The bill is a BILL, not a decision ─────────────────────────────────────
 * Every entry below is a REMAINING bare use — an icon, a checkbox accent, a
 * decorative arrow — where the 3:1 non-text bar makes the bare gold legal.
 * Keyed file + count and checked in BOTH directions: a new bare use fails,
 * and so does a fixed one whose line was left behind. Vendors' and budget's
 * text defects are still IN this bill on purpose — the W4-A follow-up PRs
 * shrink it, and shrinking it is what proves the second direction fires.
 * Do not add to it to make this test pass; icons only.
 *
 * 🛡 Mutation-checked by occurrence count, before → after, both directions RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname);
const TREES = ['guests', 'vendors', 'budget', 'alaala'];

/** Remaining sanctioned bare `text-terracotta` uses (icons, checkbox accents,
 * decorative arrows) — plus, in vendors/budget, the text sites the W4-A
 * follow-up PRs retire. This list only ever gets SHORTER. */
const BILL: ReadonlyArray<readonly [string, number]> = [
  ['guests/page.tsx', 1],
  ['guests/[guestId]/page.tsx', 4],
  ['guests/souvenirs/page.tsx', 1],
  ['guests/invite/page.tsx', 2],
  ['guests/_components/guest-list-multiselect.tsx', 4],
  ['guests/_components/mobile-guest-carousel.tsx', 1],
  ['guests/new/page.tsx', 2],
  ['guests/checkin/page.tsx', 1],
  ['guests/claims/page.tsx', 1],
  ['guests/souvenirs/_components/souvenir-desk.tsx', 1],
  ['vendors/_components/build-compare.tsx', 8],
  ['vendors/_components/vendor-quickview-inspector.tsx', 1],
  ['vendors/_components/lock-milestone.tsx', 5],
  ['vendors/_components/accordion-lock.tsx', 3],
  ['vendors/_components/team-controls.tsx', 1],
  ['vendors/_components/quote-fill.tsx', 3],
  ['vendors/_components/merkado-budget-lens.tsx', 3],
  ['vendors/_components/pending-lock-proposals.tsx', 2],
  ['vendors/_components/reuse-bookings-panel.tsx', 1],
  ['vendors/_components/services-takeover.tsx', 2],
  ['vendors/_components/merkado-guard-banner.tsx', 1],
  ['vendors/_components/build-locked.tsx', 2],
  ['vendors/[vendorId]/workspace/page.tsx', 8],
  ['vendors/[vendorId]/review/page.tsx', 7],
  ['vendors/packages/[bookingId]/page.tsx', 2],
  ['vendors/[vendorId]/workspace/_components/host-service-details.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/deposit-reservation.tsx', 2],
  ['vendors/[vendorId]/workspace/_components/working-folder-notes.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/reservation-terms-ack.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/change-order-trail.tsx', 1],
  ['vendors/[vendorId]/workspace/_components/quote-bridge.tsx', 2],
  ['vendors/[vendorId]/workspace/_components/vendor-proposals-card.tsx', 2],
  ['vendors/[vendorId]/workspace/_components/handover-inbox.tsx', 4],
  ['budget/page.tsx', 1],
  ['budget/_components/budget-live-summary.tsx', 1],
  ['budget/_components/share-budget-band-toggle.tsx', 1],
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.'))
      out.push(p);
  }
  return out;
}

/** Strip /* *\/ blocks, // line tails and JSX {/* *\/} before matching, so a
 * comment that merely names the class cannot fire the guard. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function bareGoldCount(src: string): number {
  // NOT followed by `-`: `text-terracotta-700` is the sanctioned text gold,
  // and a prefix match would count the fix as the defect.
  return (stripComments(src).match(/text-terracotta(?!-)/g) ?? []).length;
}

test('bare gold appears only where the bill sanctions it — both directions', () => {
  const billed = new Map(BILL.map(([f, n]) => [f, n]));
  const failures: string[] = [];
  for (const tree of TREES) {
    for (const file of walk(join(ROOT, tree))) {
      const rel = relative(ROOT, file);
      const actual = bareGoldCount(readFileSync(file, 'utf8'));
      const expected = billed.get(rel) ?? 0;
      billed.delete(rel);
      if (actual > expected) {
        failures.push(
          `${rel}: ${actual} bare text-terracotta, bill sanctions ${expected}. ` +
            `Gold is 3.37:1 on the page ground — below AA for text. Use ` +
            `text-terracotta-700 for kickers/accents, text-mulberry or ` +
            `text-link for links. Add to the bill ONLY for an icon.`,
        );
      } else if (actual < expected) {
        failures.push(
          `${rel}: ${actual} bare text-terracotta but the bill still says ` +
            `${expected}. A billed use was fixed or removed — shrink its ` +
            `bill entry in the same commit so the bill stays true.`,
        );
      }
    }
  }
  for (const [file, n] of billed) {
    failures.push(
      `${file} is billed for ${n} but no longer exists under the four trees — ` +
        `delete its bill entry.`,
    );
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
});

test('no malformed terracotta shade class survives (the -700-700 typo shape)', () => {
  // `text-terracotta-700-700` is not a class Tailwind generates — it styles
  // NOTHING, so the element silently keeps its inherited colour. One shipped
  // in invited-to-chips.tsx and the checked chip lost its tint.
  const offenders: string[] = [];
  for (const tree of TREES) {
    for (const file of walk(join(ROOT, tree))) {
      const hits =
        stripComments(readFileSync(file, 'utf8')).match(
          /text-terracotta-\d+-\d+/g,
        ) ?? [];
      if (hits.length > 0)
        offenders.push(`${relative(ROOT, file)}: ${hits.join(', ')}`);
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
});
