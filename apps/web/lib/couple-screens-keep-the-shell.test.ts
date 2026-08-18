/**
 * Owner, 2026-08-18: **"all should keep our shell."**
 *
 * The couple's event layout renders the one `<main class="sn-vt-page">`. No page
 * beneath it may render a second — a frame inside the frame.
 *
 * ⚠ This is not only a design rule. Two `<main>` landmarks on one page is an
 * accessibility fault: a screen reader offers "skip to main content" twice and
 * neither one is the whole page.
 *
 * 🪤 THE COUNT THAT STARTED THIS WAS WRONG BY FIVE. A grep for the string
 * `<main` across these four screens returned five files; FOUR were comments
 * *describing* the layout's `<main>` (". . . the shell supplies the <main>
 * landmark", "-mt-6 cancels the <main py-6>"). Exactly ONE was a real element.
 * 🔑 **A GUARD THAT MATCHES A STRING IS NOT MATCHING THE ACT** — strip comments
 * before counting, or the notes people wrote *about* a rule get reported as
 * breaking it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = join(import.meta.dirname, '..');
const EVENT_TREE = join(WEB, 'app/dashboard/[eventId]');

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

/** Source with every comment form removed — JSX, block and line. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('the event layout still renders exactly one shell main', () => {
  // If this ever reaches zero the rule below becomes vacuous — every page would
  // pass while no shell existed at all.
  const layout = code(join(EVENT_TREE, 'layout.tsx'));
  const found = layout.match(/<main\b/g) ?? [];
  assert.equal(found.length, 1, 'the event layout must render exactly one <main>');
  assert.match(layout, /<main className="sn-vt-page">/, 'the shell main lost its page class');
});

test('the four daily screens render no second main', () => {
  // The screens the owner opens every day — the scope of this change, and the
  // only ground this assertion claims. Strict: zero, no exceptions.
  const FOUR = ['guests', 'vendors', 'budget', 'alaala'];
  const files = FOUR.flatMap((d) => sources(join(EVENT_TREE, d)));
  assert.ok(files.length >= 60, `scanned only ${files.length} files across the four screens`);

  const offenders = files.filter((f) => /<main\b/.test(code(f))).map((f) => relative(WEB, f));
  assert.deepEqual(
    offenders,
    [],
    'These pages render their own <main> inside the layout that already provides one:\n' +
      offenders.join('\n') +
      '\n\nKeep the shared shell. If a page needs a narrower column, wrap it in a <div>' +
      ' with the width classes — the landmark belongs to the layout.',
  );
});

/**
 * The rest of the event tree, measured 2026-08-18 — NOT fixed, and deliberately
 * not pretended away.
 *
 * ⚖ PRINT SHEETS AND ERROR BOUNDARIES ARE EXCLUDED BY RULE, NOT BY NAME. A page
 * that exists to be printed or to replace a crashed screen is not inside the
 * app shell and should own its own document. Excluding them by what the route
 * IS keeps the exclusion honest — a new print route is covered automatically,
 * and a new ordinary screen cannot hide behind the list.
 *
 * ✅ THE BILL IS PAID — the list is EMPTY as of 2026-08-18. All seven were read
 * and fixed in the same change that pinned them:
 *   • five were plain width wrappers → <div>, classes untouched
 *   • manpower painted a full-height surface → <div>, the paint KEPT
 *   • the website editor's was its PREVIEW PANE → <section aria-label="Preview">,
 *     because a two-pane editor's preview is a REGION, and demoting it to a bare
 *     <div> would have destroyed a landmark rather than corrected one
 *
 * ⚠ KEEP THE EMPTY LIST AND ITS RULE. An empty array is not dead code here —
 * it is what makes a NEW offender fail. Deleting the list deletes the guard.
 * If a line is ever added back it must be because somebody read that page and
 * decided it stays. **A bill, not a decision.**
 */
const UNREVIEWED_SECOND_MAINS: string[] = [
];

/** A route that legitimately stands outside the shell — printed, or a crash screen. */
function standsAlone(rel: string): boolean {
  return /\/(print|poster)\//.test(rel) || /\/(error|not-found|global-error)\.tsx$/.test(rel);
}

test('no NEW page grows a second main, and the pinned list only shrinks', () => {
  const files = sources(EVENT_TREE).filter((f) => f !== join(EVENT_TREE, 'layout.tsx'));
  const found = files
    .filter((f) => /<main\b/.test(code(f)))
    .map((f) => relative(WEB, f))
    .filter((rel) => !standsAlone(rel))
    .sort();

  const unexpected = found.filter((f) => !UNREVIEWED_SECOND_MAINS.includes(f));
  assert.deepEqual(
    unexpected,
    [],
    'A new page renders its own <main> inside the event shell:\n' + unexpected.join('\n'),
  );

  const stale = UNREVIEWED_SECOND_MAINS.filter((f) => !found.includes(f));
  assert.deepEqual(
    stale,
    [],
    'These are pinned as debt but no longer offend — delete their lines:\n' + stale.join('\n'),
  );
});

test('the website editor\'s preview stays a NAMED region, not a bare div', () => {
  // 🪤 I CLAIMED THIS LABEL WAS THE POINT AND NOTHING HELD IT. Removing
  // `aria-label="Preview"` left every test green — so the reasoning for
  // choosing <section> over <div> lived only in a comment, which is exactly
  // the shape this repo keeps paying for. A sentence is not a mechanism.
  //
  // The editor's preview WAS a <main>. Demoting it to a bare <div> would have
  // destroyed a landmark rather than corrected one: a two-pane editor's preview
  // is a real region somebody navigates to. <section> keeps that; the label is
  // what makes <section> a landmark at all — an unlabelled <section> is not
  // exposed as one.
  const src = readFileSync(
    join(EVENT_TREE, 'website/editor/_components/editor-shell.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /<section\s+aria-label="Preview"/,
    'the editor preview must stay a labelled <section> — an unlabelled section is not a landmark',
  );
});
