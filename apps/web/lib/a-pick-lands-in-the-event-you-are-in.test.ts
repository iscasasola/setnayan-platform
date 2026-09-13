/**
 * A pick lands in the event you are standing in.
 *
 * ── THE BUG, MEASURED 2026-09-08 ───────────────────────────────────────────
 * The bench is scoped to ONE event by its own URL. `saveVendorToPicks` ignored
 * that entirely and re-derived a "primary" event, so a supplier saved on event
 * A's bench could land in event B — silently, and correctly as far as every
 * existing test was concerned.
 *
 * It surfaced on a real account holding **two** events flagged
 * `is_primary = true` (nothing enforces one): a wedding, and a "Movie Night".
 * `resolvePrimaryHostEvent` sorts primaries first and takes `sorted[0]` — a
 * stable sort over an unordered query — so which one won was arbitrary per
 * request. The same coin toss pointed `/explore` at a `date` marketplace and
 * announced *"Date vendors are being recruited"* while a verified wedding band
 * sat inside it.
 *
 * 🔑 A CALLER THAT KNOWS ITS EVENT MUST NOT RE-DERIVE ONE — and an id that
 * arrives in a form is a CLAIM until it is checked. Both halves are pinned
 * here, because passing the id without checking it would be a worse bug than
 * the one it replaced.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));

const action = src('../app/(shell)/explore/actions.ts');
const bench = src('../app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
const events = src('../lib/events.ts');

test('the bench sends the event it is standing in', () => {
  const fn = bench.slice(bench.indexOf('const saveFromMore'), bench.indexOf('const saveFromMore') + 900);
  assert.match(
    fn,
    /fd\.set\('event_id', eventId\)/,
    'the bench stopped sending its own eventId, so the save re-derives a ' +
      '"primary" event and a pick can land in a different wedding',
  );
});

test('🔑 a supplied event id is CHECKED before it is written to', () => {
  const i = action.indexOf('requestedEventId');
  assert.ok(i > -1, 'the action no longer reads an event_id from the form');
  // Window ends at the INSERT, not at the first mention of a field name — the
  // `primaryEvent` declaration sits between the read and the gate, so slicing
  // to `display_name` cut the window short and the assertion failed on correct
  // code. A guard's window has to face the thing it is judging.
  const gate = action.slice(i, action.indexOf(".from('event_vendors')", i));
  assert.match(
    gate,
    /userHostsEvent\(/,
    'an event_id from a form is written to WITHOUT checking the caller hosts it — ' +
      'that is worse than the bug it replaced',
  );
  assert.match(
    gate,
    /not_your_event/,
    'a foreign event id is not refused with its own status',
  );
});

test('the check runs BEFORE the id is used', () => {
  const gateIdx = action.search(/userHostsEvent\(/);
  const useIdx = action.search(/resolvedEventId = requestedEventId/);
  assert.ok(gateIdx > -1 && useIdx > -1, 're-point this guard');
  assert.ok(
    gateIdx < useIdx,
    'the host check runs after the id is adopted, so it gates nothing',
  );
});

test('`/explore` keeps the primary fallback — it genuinely has no event', () => {
  assert.match(
    action,
    /resolvePrimaryHostEvent\(/,
    'the primary fallback is gone; /explore has no event on it and could no ' +
      'longer save at all',
  );
});

test('“hosts an event” has ONE definition, shared with the resolver', () => {
  // Two definitions of who hosts an event is the same shape as the two
  // definitions of "this shop is live" that cost seven broken code paths.
  assert.match(events, /export async function userHostsEvent/, 'the shared check is gone');
  const fn = events.slice(events.indexOf('export async function userHostsEvent'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /event_members/, 'it stopped consulting legacy couple membership');
  assert.match(body, /event_moderators/, 'it stopped consulting the iteration-0048 host roles');
  assert.match(body, /PRIMARY_HOST_ROLE_SUBTYPES/, 'it invented its own list of host roles');
  assert.match(body, /archived/, 'an archived event still counts as hosted');
});

test('the refusal names the cause instead of the catch-all', () => {
  assert.match(
    bench,
    /INLINE_MORE_NOT_YOUR_EVENT/,
    'the bench collapsed "not your event" back into "we couldn’t save that vendor", ' +
      'which is how a wrong event looks identical to a database failure',
  );
});
