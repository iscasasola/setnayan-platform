/**
 * A MIRRORED RAMP TAKES NO `dark:` OVERRIDE (2026-11-07).
 *
 * THE MECHANISM. Since dark mode PR 1 (2026-10-13) every shade of the success / warn / danger / info /
 * terracotta / mulberry / gold / champagne / sage families in `tailwind.config.ts` reads a
 * `--ramp-<family>-<step>` token, and `globals.css` redeclares each of those tokens under `html.dark`
 * read from the OTHER END of its ladder (50 ↔ 950, 100 ↔ 900 …). So `text-danger-900` is already the
 * light #F4D7C9 on the dark page — the ramp does the flip by itself.
 *
 * THE BUG. A `dark:` override written in the old mental model ("in dark use the pale shade") now flips
 * it BACK: `text-danger-900 dark:text-danger-100` paints dark danger-100 = #5F3021 on the dark page,
 * measured 1.67:1 (PR #7374, booking-ask-panel's LockAnswerLine). Deleting the override lets the mirrored
 * ramp apply alone: 13.31:1. The same shape sat in 38 places on 2026-11-07, every text one between
 * 1.4:1 and 3.0:1 in dark.
 *
 * THE RULE. A `dark:` utility naming a mirrored family is a defect unless it is in ALLOW below with a
 * measured reason (a deliberate step away from the mirror — e.g. keeping a deep fill under white words).
 * Files other open PRs were rewriting when this shipped are in DEBT with their count; the count may only
 * fall.
 *
 * The families are READ from tailwind.config.ts + globals.css, never hand-typed: a family whose shades
 * read `--ramp-<family>-…` AND whose tokens are redeclared under `html.dark` is mirrored.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const THIS = relative(WEB, fileURLToPath(import.meta.url));

/**
 * Deliberate, measured steps away from the mirror. Key = `<file>|<exact dark: class>`, value = how many
 * times it appears in that file + why. Dark values from globals.css `html.dark`, page #17160F.
 */
const ALLOW: Record<string, { count: number; why: string }> = {
  'app/_components/swipe-to-delete.tsx|dark:bg-danger-400': {
    count: 2,
    why:
      'WHITE words on the delete fill. The mirrored bg-danger-600 is #CD7252 in dark → white 3.43:1 (fails AA); ' +
      'dark danger-400 is #B65A3A (= the light danger-600 fill) → white 4.65:1. It un-mirrors on purpose.',
  },
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/colour-access-card.tsx|dark:text-danger-800': {
    count: 1,
    why:
      'Reject chip: words on bg-danger-100 (dark #5F3021). The mirrored text-danger-700 is #DD9477 → 4.44:1 (fails AA); ' +
      'dark danger-800 #EAB8A2 → 6.15:1. A step LIGHTER in dark, added by the dark 3a contrast pass (2026-10-23).',
  },
};

/**
 * Files another open PR was rewriting on 2026-11-07, so they were not edited here. Each count may only
 * FALL; when it reaches 0 the test says so and the line should be deleted. Every listed override is a
 * double inversion (1.4–3.0:1 in dark, except success-700 → 600 at 5.71:1 vs 8.53:1 mirrored).
 */
const DEBT: Record<string, { count: number; pr: number }> = {
  'app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel.tsx': { count: 1, pr: 7374 },
  'app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx': { count: 9, pr: 7365 },
  'app/dashboard/[eventId]/_components/payment-plan-rows.tsx': { count: 2, pr: 7365 },
  'app/vendor-dashboard/on-the-day/_components/crew-panel.tsx': { count: 3, pr: 7308 },
  'app/vendor-dashboard/on-the-day/_components/access-grants.tsx': { count: 1, pr: 7308 },
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/change-the-schedule.tsx': { count: 1, pr: 7307 },
  'app/vendor-dashboard/clients/[eventId]/_components/day-check-line.tsx': { count: 4, pr: 7269 },
  'app/vendor-dashboard/clients/[eventId]/_components/waitlist-form.tsx': { count: 1, pr: 7269 },
};

const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** The mirrored families, read from the real sources. */
function mirroredFamilies(): string[] {
  const config = stripComments(read('tailwind.config.ts'));
  const css = stripComments(read('app/globals.css'));
  const fams = [...new Set([...config.matchAll(/var\(--ramp-([a-z]+)(?:-[a-z0-9]+)?\)/g)].map((m) => m[1]!))];
  // Redeclared under html.dark → mirrored. Collect every html.dark block body.
  const darkBodies = [...css.matchAll(/html\.dark\s*\{([^}]*)\}/g)].map((m) => m[1]!).join('\n');
  return fams.filter((f) => new RegExp(`--ramp-${f}(?:-[a-z0-9]+)?\\s*:`).test(darkBodies));
}

const PROPS = '(?:text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|outline|from|via|to|fill|stroke|divide|decoration|placeholder|caret|accent|shadow)';

function overridePattern(fams: string[]): RegExp {
  return new RegExp(
    `(?<![\\w-])(?:[\\w-]+:)*dark:(?:[\\w-]+:)*!?${PROPS}-(?:${fams.join('|')})(?:-[a-z0-9]+)*(?:/(?:[\\d.]+|\\[[^\\]]+\\]))?(?![\\w-])`,
    'g',
  );
}

function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const rel = join(dir, name);
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.(tsx|ts|css)$/.test(name) && !/\.test\.tsx?$/.test(name) && rel !== THIS) out.push(rel);
    }
  };
  for (const d of ['app', 'lib', 'components']) walk(d);
  return out;
}

/** file → list of every dark: override of a mirrored family, comments stripped. */
function scan(): Map<string, string[]> {
  const re = overridePattern(mirroredFamilies());
  const hits = new Map<string, string[]>();
  for (const rel of sources()) {
    const src = stripComments(read(rel));
    const found = [...src.matchAll(re)].map((m) => m[0]);
    if (found.length) hits.set(rel, found);
  }
  return hits;
}

test('the mirrored families are read from the sources (and include the semantic three)', () => {
  const fams = mirroredFamilies();
  for (const f of ['danger', 'success', 'warn']) assert.ok(fams.includes(f), `expected "${f}" to be a mirrored ramp; got ${fams.join(', ')}`);
});

test('the pattern catches the #7374 shape and leaves plain classes alone', () => {
  const re = overridePattern(mirroredFamilies());
  const m = (s: string) => [...s.matchAll(re)].map((x) => x[0]);
  assert.deepEqual(m('text-danger-900 dark:text-danger-100'), ['dark:text-danger-100']);
  assert.deepEqual(m('dark:hover:!bg-warn-200/40 border-success-200'), ['dark:hover:!bg-warn-200/40']);
  assert.deepEqual(m('text-danger-800 dark:bg-raised dark:text-[#C24E25] bg-white'), []);
});

test('no dark: override flips a mirrored ramp back (outside ALLOW / DEBT)', (t) => {
  const hits = scan();
  const total = [...hits.values()].reduce((n, l) => n + l.length, 0);
  t.diagnostic(`dark: overrides of a mirrored ramp: ${total} in ${hits.size} files`);

  const problems: string[] = [];
  const allowSeen = new Map<string, number>();
  for (const [file, found] of hits) {
    const debt = DEBT[file];
    const rest: string[] = [];
    for (const cls of found) {
      const key = `${file}|${cls}`;
      if (ALLOW[key]) allowSeen.set(key, (allowSeen.get(key) ?? 0) + 1);
      else rest.push(cls);
    }
    if (debt) {
      if (rest.length > debt.count) {
        problems.push(`${file}: ${rest.length} overrides, DEBT allows ${debt.count} (open PR #${debt.pr}) — the count may only fall: ${rest.join(', ')}`);
      }
      continue;
    }
    for (const cls of rest) {
      problems.push(
        `${file}: \`${cls}\` — under html.dark this ramp is already mirrored (50↔950, 100↔900 …), so a dark: shade flips it BACK ` +
          `(the #7374 bug: text-danger-900 dark:text-danger-100 = 1.67:1). Delete the dark: class; if the step away from the mirror is ` +
          `deliberate, add it to ALLOW in ${THIS} with the measured contrast.`,
      );
    }
  }
  for (const [key, { count }] of Object.entries(ALLOW)) {
    const seen = allowSeen.get(key) ?? 0;
    if (seen > count) problems.push(`${key}: ${seen} uses, ALLOW says ${count} — a new one needs its own measured reason`);
    if (seen < count) problems.push(`${key}: ALLOW says ${count}, found ${seen} — stale; lower or delete the entry`);
  }
  for (const [file, { count, pr }] of Object.entries(DEBT)) {
    const n = (hits.get(file) ?? []).filter((c) => !ALLOW[`${file}|${c}`]).length;
    if (n < count) t.diagnostic(`DEBT ${file} (PR #${pr}) is down to ${n} of ${count} — lower or delete its line`);
  }
  assert.equal(problems.length, 0, `\n${problems.join('\n')}`);
});
