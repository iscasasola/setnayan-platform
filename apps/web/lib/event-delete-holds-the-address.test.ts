import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const WEB = join(import.meta.dirname, '..');

/**
 * GUARD — a deleted wedding's address is held by the DATABASE, and only one
 * caller may opt out.
 *
 * Owner 2026-08-12: a retired address is unusable for two years. Deleting an
 * `events` row frees its `slug` the same second, while printed invitations
 * still carry it.
 *
 * ⚠ THE FIRST VERSION OF THIS GUARD POLICED THE APP, AND THE APP WAS THE WRONG
 * PLACE. It asserted that each delete CALL SITE wrote a hold — which covered
 * `deleteEvent` and nothing else, while prod's own RLS policy
 * `couple_can_delete_event` lets a couple delete their wedding straight through
 * PostgREST with no server action involved. Removing the button closes the
 * button, not the door; the same lesson the shop-address trigger already cost.
 *
 * So the hold is a BEFORE DELETE trigger, every path is safe by default, and
 * what needs policing flips: any caller that OPTS OUT must be named here with a
 * reason.
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

/** Comments stripped — a guard a paragraph can satisfy is decoration. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => (l.trimStart().startsWith('//') ? '' : l))
    .join('\n');
}

/**
 * Callers allowed to delete an event WITHOUT holding its address.
 *
 * `lib/anon-draft-sweep.ts` — abandoned ANONYMOUS drafts. Never published,
 * never printed, never shared; holding those words would burn a real couple's
 * natural address to protect a link that never left the browser it was made in.
 */
const MAY_OPT_OUT = new Map<string, string>([
  ['lib/anon-draft-sweep.ts', 'abandoned anonymous drafts — never published, never printed'],
]);

test('the DATABASE holds the address — the trigger is installed by a migration', () => {
  // The whole design rests on this. If the trigger is ever dropped, every
  // delete path silently stops holding, and no app-side test would notice.
  const dir = join(ROOT, 'supabase/migrations');
  const installs = readdirSync(dir).filter((f) =>
    /CREATE TRIGGER events_hold_address_on_delete/i.test(readFileSync(join(dir, f), 'utf8')),
  );
  assert.ok(
    installs.length > 0,
    'no migration installs events_hold_address_on_delete — a deleted wedding’s address ' +
      'would be free the same second, for every delete path at once',
  );
});

test('only a named caller may skip the hold', () => {
  const offenders: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const rel = file.slice(WEB.length + 1);
    if (!/setnayan\.skip_slug_hold|sweep_delete_abandoned_events/.test(code(file))) continue;
    if (MAY_OPT_OUT.has(rel)) continue;
    offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    'these skip the address hold when deleting an event. The word is then free immediately ' +
      'and can be handed to somebody else while printed invitations still point at it. ' +
      'Add the caller to MAY_OPT_OUT with a written reason, or stop skipping.',
  );
});

test('PRECONDITION: the exempt caller really does still delete events', () => {
  // Without this the exemption could outlive the code it excuses, and the guard
  // would be quietly protecting nothing.
  const sweep = code(join(WEB, 'lib/anon-draft-sweep.ts'));
  assert.match(
    sweep,
    /sweep_delete_abandoned_events/,
    'the draft sweep no longer opts out — either it stopped deleting events (remove the ' +
      'exemption) or it now holds addresses it should not',
  );
});
