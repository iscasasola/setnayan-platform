#!/usr/bin/env node
/**
 * lint-no-engineering-notes-in-ui.mjs
 *
 * COPY RULE, MADE MECHANICAL: no "TODO", no "FIXME", no phase codes in text a
 * customer can read. The rule was already written down in two places. Prose is
 * not a safety mechanism — it shipped anyway.
 *
 * WHAT IT CAUGHT (2026-08-06): the Patiktok booth dashboard rendered two literal
 * engineering markers as on-screen text —
 *
 *     "External display dual-view · TODO(0017-phase5.2) · Presentation API…"
 *     "Printable booth QR — TODO(0017-phase4.2): mint per-booth session token…"
 *
 * — inside <p> elements, not comments. A couple who PAID for the Patiktok booth
 * is redirected straight onto that page, so they read unfinished-task notes on a
 * paid product on the day of their party.
 *
 * HOW IT WORKS: comments are stripped first (line, block, and JSX {\/* *\/}), so a
 * TODO in a comment — where it belongs — is fine and always will be. Whatever
 * survives is a string literal or JSX text, and both can reach a screen.
 *
 * ⚠ SCOPED DELIBERATELY. A previous guard in this repo was written too broadly,
 * flagged 16 things of which 15 were fine, and taught its reader to skim. So:
 *   · whole-word UPPERCASE markers only — `todoCount`, `toDoList`, a user-facing
 *     "To-do" label are all untouched;
 *   · `app/**` only (the rendered surface) — lib/, scripts/ and tests are out;
 *   · `.tsx` only — `.ts` server modules render nothing.
 *
 * ESCAPE HATCH: put `ui-note-allow: <reason>` in a comment on the offending
 * line. It shows up in the diff, so an exception can never be added silently.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN = join(ROOT, 'app');

/**
 * Whole-word, uppercase-only engineering markers.
 *
 * ⚠ `XXX` was in this list and had to come out: it matches the phone-number mask
 * `placeholder="09XX XXX XXXX"` in the admin settings form, which is correct UI.
 * A marker that collides with real copy generates exactly the noise this guard
 * exists to avoid, and `XXX` is the least-used marker in this repo anyway.
 */
const MARKERS = /\b(TODO|FIXME|HACK|WIP)\b/;

/**
 * Strip comments so a marker written where it BELONGS never trips the guard.
 * Order matters: JSX comment braces wrap a block comment, so they go first.
 *
 * ⚠ EVERY REPLACEMENT PRESERVES THE NEWLINE COUNT. A first cut collapsed each
 * multi-line comment to a single space, which shifted every subsequent line — so
 * the guard reported a real marker against an innocent line 60 lines away
 * (`name="vendor_validate_email"`). A guard that points at the wrong line is
 * worse than none: the reader looks, sees nothing wrong, and stops believing it.
 */
const blank = (m) => '\n'.repeat((m.match(/\n/g) ?? []).length);

function stripComments(src) {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank) // {/* jsx comment */}
    .replace(/\/\*[\s\S]*?\*\//g, blank) // /* block */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // // line  (the [^:] spares "https://")
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of walk(SCAN)) {
  const raw = readFileSync(file, 'utf8');
  if (!MARKERS.test(raw)) continue; // cheap bail-out

  const rawLines = raw.split('\n');
  const strippedLines = stripComments(raw).split('\n');

  strippedLines.forEach((line, i) => {
    if (!MARKERS.test(line)) return;
    // The allow-marker is read from the ORIGINAL line, because it lives in a
    // comment and the stripped copy no longer has it.
    if ((rawLines[i] ?? '').includes('ui-note-allow:')) return;
    violations.push({
      file: relative(ROOT, file),
      line: i + 1,
      text: (rawLines[i] ?? '').trim().slice(0, 110),
    });
  });
}

if (violations.length > 0) {
  console.error(
    '\n✗ Engineering notes are reachable in rendered UI text.\n' +
      '  A customer can read these. Move them into a comment, or add\n' +
      '  `ui-note-allow: <reason>` on the line if it is genuinely intended.\n',
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}\n      ${v.text}`);
  }
  console.error(`\n  ${violations.length} violation(s).\n`);
  process.exit(1);
}

console.log('✓ no engineering notes in rendered UI text');
