import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(import.meta.dirname, '..');

/**
 * GUARD — every path that DELETES an event must hold its address first.
 *
 * Owner 2026-08-12: *"a retired website address will only be usable again after
 * 1 year."* Deleting an `events` row frees its `slug` the same second, and the
 * word is then handed to the next person who asks — while printed invitations
 * still carry it.
 *
 * 🔑 THIS IS A FORWARD PRIMITIVE WITH NO INVERSE, the failure this repo already
 * has a name for. So the guard is on the SHAPE (a delete), not on the one call
 * site I happened to find — a delete added next month is the whole risk.
 *
 * Exemptions are a BILL, not a decision: each needs a written reason here.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/**
 * Deletes an event and deliberately does NOT hold the address.
 *
 * `anon-draft-sweep.ts` — abandoned ANONYMOUS drafts. Nobody was ever given
 * these addresses: an anonymous draft is never published, never printed, never
 * shared, and the sweep exists to return abandoned words to the pool. Holding
 * them for a year would burn a real couple's natural address to protect a link
 * that never left the browser it was made in.
 */
const EXEMPT = new Map<string, string>([
  ['lib/anon-draft-sweep.ts', 'abandoned anonymous drafts — never published, never printed'],
]);

const DELETES_AN_EVENT = /\.from\(\s*['"]events['"]\s*\)[\s\S]{0,200}?\.delete\(\s*\)/;

test('every event-delete path holds the address, or is exempt with a reason', () => {
  const offenders: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const rel = file.slice(WEB.length + 1);
    const src = readFileSync(file, 'utf8');
    if (!DELETES_AN_EVENT.test(src)) continue;
    if (EXEMPT.has(rel)) continue;
    if (/CLOSED_EVENT_SLUG_ENTITY_TYPE/.test(src)) continue;
    offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    'these delete an event without holding its address — the word is free the same second, ' +
      'and the next person to ask can be handed an address that is printed on somebody’s ' +
      'invitations. Hold it (CLOSED_EVENT_SLUG_ENTITY_TYPE) or add it to EXEMPT with a reason.',
  );
});

test('PRECONDITION: the pattern actually matches the known delete path', () => {
  // Without this the test above passes by matching NOTHING — the shape of a
  // Supabase delete could change and the guard would go quietly blind.
  const known = readFileSync(join(WEB, 'app/admin/events/actions.ts'), 'utf8');
  assert.match(known, DELETES_AN_EVENT, 'the delete pattern no longer matches the known path');
  assert.match(known, /CLOSED_EVENT_SLUG_ENTITY_TYPE/, 'the known path stopped holding the address');
});
