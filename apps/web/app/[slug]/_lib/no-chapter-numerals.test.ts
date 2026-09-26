/**
 * NO GUEST SECTION RENDERS № (owner 2026-09-25 "okay drop the numbers").
 *
 * The guest Event Hub sections used to carry hard-coded "№ 04 / № 05 / № 08"
 * chapter labels (schedule, dress code, entourage, RSVP, our story, our
 * photos, the details, the masthead). When a section is hidden the sequence
 * showed a gap — "№ 04" followed by "№ 08" with nothing in between reads as
 * broken, not as a couple's choice. The fix removed the numeral from every
 * eyebrow, keeping the section's title alone.
 *
 * Checked as a SWEEP over the two trees the owner named ("Find the labels by
 * grepping № in apps/web/app/[slug] and apps/web/lib"), not a fixed list of
 * the eight files known today — a ninth section written tomorrow with its own
 * hard-coded numeral would be invisible to a guard keyed on today's file
 * names (a-sweep-guard-cannot-be-found-by-testing-your-own-neighbourhood).
 *
 * Comments are stripped first — several files carry the numero sign in a
 * DOCBLOCK describing the historical bug (`the-wake-is-not-invited.test.ts`,
 * `invitation-card.ts`) or a CSS comment about the decorative rule that used
 * to sit next to the numeral. Those are history, not a rendered numeral, and
 * `stripComments` (the one string-aware stripper other source-scanning guards
 * in this repo use — a naive `/\/\*.*?\*\//` regex deletes real code whenever
 * a string literal contains `/*`) is what tells the two apart.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB_ROOT = join(import.meta.dirname, '..', '..', '..');
const SLUG_ROOT = join(WEB_ROOT, 'app', '[slug]');
const LIB_ROOT = join(WEB_ROOT, 'lib');
/** This file's own path — excluded from the walk below. Its name and its
 *  assertion messages must SAY the glyph in plain string literals (not a
 *  comment `stripComments` could strip), so a self-scan would always find
 *  itself. Every other file is still swept, including every OTHER test. */
const SELF = join(import.meta.dirname, 'no-chapter-numerals.test.ts');

/** The numero sign, U+2116 — built from its code point rather than typed as a
 *  literal, so this constant's own declaration can never be mistaken for one
 *  more rendered occurrence. Never a plain "No"/"Nº" (ordinal indicator),
 *  which is a different glyph used elsewhere for an unrelated per-guest RSVP
 *  ticket-stub number and is out of scope for this ruling. */
const NUMERO_SIGN = String.fromCharCode(0x2116);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry) && full !== SELF) out.push(full);
  }
  return out;
}

test(`no file under app/[slug] or lib renders the ${NUMERO_SIGN} numero sign outside a comment`, () => {
  const files = [...walk(SLUG_ROOT), ...walk(LIB_ROOT)];
  assert.ok(files.length > 100, `found ${files.length} files — this walk is blind`);

  const offenders: string[] = [];
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    const stripped = /\.css$/.test(f) ? raw : stripComments(raw);
    if (stripped.includes(NUMERO_SIGN)) {
      offenders.push(relative(WEB_ROOT, f));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a chapter numeral (${NUMERO_SIGN}) survives outside comments in: ${offenders.join(', ')} — ` +
      'owner 2026-09-25 "okay drop the numbers": every guest section keeps its title only',
  );
});

test('sanity: the sections the owner named by number render only their title', () => {
  const cases: Array<[file: string, title: string]> = [
    ['schedule-widget.tsx', 'The programme'],
    ['dress-code-widget.tsx', 'Dress code'],
    ['entourage-section.tsx', 'The entourage'],
    ['rsvp-widget.tsx', 'Reply'],
    ['our-story.tsx', 'Our story'],
    ['our-photos-widget.tsx', 'Our photos'],
    ['empty-states.tsx', 'The details'],
  ];
  for (const [file, title] of cases) {
    const src = readFileSync(join(SLUG_ROOT, '_components', file), 'utf8');
    assert.match(src, new RegExp(`<span>${title}</span>`), `${file} no longer renders "${title}" plainly`);
  }
});
