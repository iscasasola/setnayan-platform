/**
 * GUARD — the screen where a host chooses what their guests see must not tell
 * them about a wedding they are not having.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * Setnayan ships sixteen event types, including a funeral. The GUEST-facing tree
 * was threaded for all of them and holds it with its own guards. **The host's
 * setup screen was not.** Five of the sixteen widget descriptions named a
 * wedding outright, and `website/widgets` prints them verbatim:
 *
 *   "Days to the wedding."  ·  "Your wedding-day run-of-show."
 *   "The wedding's load-bearing form."
 *   "…tagged photos after the wedding."  ·  "…engagement or pre-wedding shots."
 *
 * A family arranging a wake read the word "wedding" five times while deciding
 * what their guests would see. Nothing was broken; it simply spoke to somebody
 * else. That page already resolved the event's own noun and used it in six other
 * sentences — **the words were there and this line did not use them.**
 *
 * 🔑 THE FIX IS A SECOND WORDING, NOT A NEUTERED ONE. "Your wedding-day
 * run-of-show" is the better sentence for a wedding, so it stays the default;
 * `describe(noun)` is consulted first where a second wording exists. A guard that
 * simply banned the word would have forced every type onto the blander sentence.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIDGET_CATALOG } from './invitation-widgets';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHOOSER = readFileSync(
  join(HERE, '..', 'app', 'dashboard', '[eventId]', 'website', 'widgets', 'page.tsx'),
  'utf8',
);

/** Every wording a host can be shown, for a given event noun. */
function wordingsFor(noun: 'wedding' | 'event'): { type: string; text: string }[] {
  return WIDGET_CATALOG.map((c) => ({
    type: c.type,
    text: c.describe?.(noun) ?? c.description,
  }));
}

test('🚨 a non-wedding host is never told about a wedding', () => {
  const offenders = wordingsFor('event').filter((w) => /\bwedding\b/i.test(w.text));
  assert.deepEqual(
    offenders.map((o) => `${o.type}: ${o.text}`),
    [],
    'these describe a WEDDING to a host who is not having one — the funeral case is the one that matters',
  );
});

test('a wedding host still gets the wedding wording', () => {
  // ⚠ THE POINT OF `describe` IS TWO SENTENCES, NOT ONE BLAND ONE. If this goes
  // red because everything was neutered, that is a regression, not a pass.
  const weddingWords = wordingsFor('wedding').filter((w) => /\bwedding\b/i.test(w.text));
  assert.ok(
    weddingWords.length >= 4,
    `only ${weddingWords.length} descriptions still say "wedding" for a wedding — the second wording replaced the first instead of joining it`,
  );
});

test('🚨 the screen actually CONSULTS the second wording', () => {
  // The catalog could carry perfect wording that nothing reads — the shape this
  // repo calls a gate with no handle. This is the line that makes it real.
  assert.match(
    CHOOSER,
    /catalog\.describe\?\.\(noun\)\s*\?\?\s*catalog\.description/,
    'the chooser prints catalog.description directly again — the second wording is stored and unread',
  );
});

test('every describe() actually changes the sentence', () => {
  // A `describe` that ignores its argument is decoration; it would pass rule one
  // by accident only if the base sentence never said "wedding" either.
  const inert = WIDGET_CATALOG.filter(
    (c) => c.describe && c.describe('wedding') === c.describe('event'),
  ).map((c) => c.type);
  assert.deepEqual(inert, [], `these describe() functions ignore the noun: ${inert.join(', ')}`);
});

test('🚨 the base sentence and the wedding wording cannot drift apart', () => {
  // ⚠ WHY THIS RULE EXISTS, FOUND BY MUTATION AND NOT BY READING. Once an entry
  // has `describe`, the chooser never prints its `description` again — for
  // EITHER noun — so that string became a stored value with no reader. Editing
  // it changed nothing on screen and every test stayed green, which is the
  // shape this repo keeps paying for.
  //
  // Rather than delete it (other consumers may read the catalog later, and the
  // type requires it), it is PINNED: for any entry carrying a second wording,
  // the base sentence must be exactly what that wording produces for a wedding.
  // The two can then never say different things, and editing one alone is red.
  const drifted = WIDGET_CATALOG.filter(
    (c) => c.describe && c.describe('wedding') !== c.description,
  ).map((c) => `${c.type}: "${c.description}" vs "${c.describe!('wedding')}"`);
  assert.deepEqual(
    drifted,
    [],
    'the base description no longer matches the wedding wording — nothing prints the base, so this would drift in silence:\n  ' +
      drifted.join('\n  '),
  );
});
