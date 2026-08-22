#!/usr/bin/env node
/**
 * Guard: do not hand-roll a page masthead.
 *
 * WHY THIS EXISTS. Until 2026-07-21 there was no shared page-header component anywhere in the
 * app, so ~80 dashboard pages each hand-rolled the same block — and a CARD token drifted onto all
 * of them (`.sn-eye`'s own spec comment in globals.css reads "**Tile** eyebrow"). Nothing caught
 * it, because nothing was watching. `<PageMasthead>` is now the single render site; this stops the
 * next one from being pasted in.
 *
 * WHAT IT CHECKS — deliberately narrow: an `.sn-eye` element INSIDE a `<header>`. That is the
 * exact shape that drifted, and it has no false-positive surface: `.sn-eye` on a tile or a section
 * label is correct and untouched.
 *
 * WHAT IT DOES NOT CHECK, on purpose:
 *   • It is NOT a "every page must have an h1" rule. That would red-build ~101 of 278 files on day
 *     one — including surfaces that are deliberately headerless by dated owner directive (Guests
 *     2026-06-03, Seating's sr-only h1 2026-07-15, the Live Studio control room PR #3451) — and a
 *     lint that fails on correct code gets deleted in week two.
 *   • It does not police `.sn-h1` on its own. A bare title is already the target state.
 *
 * SCOPE: the three authenticated trees only. The public marketing tree, guest sites and /u/[slug]
 * keep the full atelier masthead — that IS the product's voice there, and it sits inside the
 * Lighthouse a11y+SEO gate.
 *
 * Run: node scripts/lint-page-masthead.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A RATCHET, not a wall.
 *
 * 115 files carry the drifted shape today. Wiring this as a hard fail on day one would red-build
 * main immediately — and a lint that fails on the existing codebase is a lint someone deletes in
 * week two. So the known set is baselined: this fails only on a NEW hand-roll, and the baseline
 * shrinks as pages migrate to <PageMasthead>. Delete a line from the baseline when you migrate a
 * page; never add one.
 */
const BASELINE_PATH = 'scripts/page-masthead-baseline.json';

const ROOTS = ['app/dashboard', 'app/vendor-dashboard', 'app/admin'];

/**
 * Surfaces with a dated directive behind their current, denser shape.
 *
 * The 2026-08-19 entries are the label-above-an-h1 shape KEPT ON PURPOSE, each
 * because the small line is not a restatement of the title. Reviewed one by one
 * when the h1-anchored half of this guard was added; do not "tidy" them.
 */
const ALLOWED = [
  'studio/panood/broadcast', // 44px status strip — PR #3451
  // Error pages: the small line is the wordmark, and the paragraph IS the page.
  'error.tsx',
  // 敬茶 names the rite; "Your serving order" alone does not say tea ceremony.
  'guests/tea-ceremony',
  // A printed poster a guest reads off a wall, not a page header.
  'studio/papic/crew/poster',
  // "Review blocked" is a red refusal badge with an icon — a state, not a label.
  'vendors/[vendorId]/review',
  // The service's CATEGORY above the service's NAME — classification, not an echo.
  'vendors/[vendorId]/workspace',
  // "Vendor package" above the package's own name — same: it says what kind.
  'vendors/packages/[bookingId]',
  // A contract document header: the line carries the counterparty and the date.
  'vendor-dashboard/contracts',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  let files = [];
  try {
    files = walk(root);
  } catch {
    continue; // tree absent in a partial checkout
  }
  for (const file of files) {
    if (ALLOWED.some((a) => file.includes(a))) continue;
    const src = readFileSync(file, 'utf8');
    // An sn-eye that lives inside a <header> — the drifted shape.
    for (const m of src.matchAll(/<header[^>]*>([\s\S]*?)<\/header>/g)) {
      if (m[1].includes('sn-eye')) {
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${relative(process.cwd(), file)}:${line}`);
        break;
      }
    }

    // ⚠ THE ABOVE KNEW ONE SPELLING AND CALLED ITSELF CLEAN OVER 22 PAGES.
    // The eyebrow has TWO spellings in this codebase — the shared `.sn-eye`
    // class, and a hand-rolled `uppercase tracking-[…]` label — and it does not
    // always sit inside a <header>. The whole 109-file ratchet was built from
    // the first shape only, so the second was never debt and never reported:
    // "My Shop → Packages" over "Your packages", "Add categories" over "Bring
    // more categories on-stage", "Demand Radar" over "Demand Radar".
    //
    // This half is anchored on the H1 instead of the container, so it catches
    // the page header wherever it is written. A `.sn-eye` on a TILE or a
    // SECTION is still correct and still untouched — the h1 is what makes it a
    // page masthead.
    const EYE = String.raw`(?:className="[^"]*sn-eye[^"]*"|className="[^"]*uppercase tracking-\[[^"]*")`;
    const HEADER_SHAPE = new RegExp(
      String.raw`<(p|span|h2)\b[^>]*?${EYE}[^>]*>[\s\S]{0,220}?</\1>\s*(?:\{/\*[\s\S]*?\*/\}\s*)?<h1\b`,
    );
    const m2 = HEADER_SHAPE.exec(src);
    if (m2) {
      const line = src.slice(0, m2.index).split('\n').length;
      const key = `${relative(process.cwd(), file)}:${line}`;
      if (!offenders.some((o) => o.split(':')[0] === key.split(':')[0])) offenders.push(key);
    }
  }
}

const baseline = existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')))
  : new Set();

const fresh = offenders.filter((o) => !baseline.has(o.split(':')[0]));
const fixed = [...baseline].filter(
  (b) => !offenders.some((o) => o.split(':')[0] === b),
);

if (fixed.length) {
  console.log(
    `✓ ${fixed.length} baselined file(s) no longer hand-roll a masthead. Remove them from ` +
      `${BASELINE_PATH} to lock the win in:\n` +
      fixed.map((f) => `    ${f}`).join('\n'),
  );
}

if (fresh.length) {
  console.error(
    `\n✖ Hand-rolled page masthead in ${offenders.length} file(s).\n` +
      `  An .sn-eye inside a <header> is the card token that drifted onto page headers.\n` +
      `  Use <PageMasthead> from @/app/_components/page-masthead instead — it has no eyebrow prop\n` +
      `  by design (24px of layout for 10.5px of type that repeats what the nav already says).\n\n` +
      fresh.map((o) => `    ${o}`).join('\n') +
      '\n',
  );
  process.exit(1);
}

console.log(
  `✓ No NEW hand-rolled page mastheads (${baseline.size} baselined, migrate to shrink).`,
);
