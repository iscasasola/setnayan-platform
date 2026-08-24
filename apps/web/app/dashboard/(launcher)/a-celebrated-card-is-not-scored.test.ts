/**
 * A CELEBRATED CARD IS NEVER SCORED, AND A SCORE PRINTS ONCE.
 *
 * Two defects observed live 2026-08-24: a card said "Celebrated" and
 * "0% planned" one line apart, and the ring said "7%" beside a line saying
 * "7% planned" — the D-6 double print W1-A removed from the event dashboard
 * and not from this identical surface. A fix at one site is not a fix; this
 * pins the board's own card. Comments are stripped before matching, because
 * the fixes carry comments naming the strings they removed.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const stripped = (rel: string) =>
  readFileSync(path.join(__dirname, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

// ─── 3 · A CELEBRATED CARD IS NEVER SCORED, AND A SCORE PRINTS ONCE ────────
test('the board card never scores a finished celebration and never prints the figure twice', () => {
  const page = stripped('page.tsx');

  // The ring's gate must test finished — a planning score on a "Celebrated"
  // card is the board contradicting its own badge one line up.
  assert.match(
    page,
    /const showRing = [^;]*!finished/,
    'the progress ring is no longer gated on !finished — a celebrated card will be scored again',
  );
  // What a finished card shows instead is the kept note, not a number.
  assert.ok(
    page.includes("finished ? 'Kept for good' : null"),
    'the finished card lost its "Kept for good" line — it now shows nothing where the score was',
  );
  // The D-6 double print stays dead: no template pairing the pct with the word.
  assert.ok(
    !page.includes('% planned`'),
    'an "N% planned" text label is back beside the ring that already prints N% — the D-6 double print',
  );
  // And the figure still reaches screen readers as a planning number.
  assert.match(
    page,
    /sr-only"> planned</,
    'the ring lost its sr-only "planned" suffix — a screen reader now hears a bare percentage',
  );
});
