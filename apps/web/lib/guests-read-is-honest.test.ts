/**
 * guests-read-is-honest.test.ts — the couple's half of "reads are honest".
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `fetchGuestsByEvent` carries a five-pass hotfix header ending in the rule
 * "empty page > error page": any refused read — RLS denial, auth expiry, a
 * statement timeout on the wide 40-column select, schema drift — is logged and
 * turned into `[]`. That much is right; crashing a couple's dashboard is worse.
 *
 * It stopped one step short. The page then STATES the absence:
 *
 *   masthead ......... "0 guests"
 *   roster ........... "No guests yet. Start by adding the couple's first invite."
 *   confirmations .... "0 of 0 responded · 0%"
 *
 * to a couple with 180 names and 120 replies, three weeks out — in output
 * BYTE-IDENTICAL to a genuinely new event, so they cannot tell which they are
 * looking at. The supplier's side of this was closed on 2026-08-18
 * (vendor-dashboard/reads-are-honest.test.ts); this is the couple's side, and
 * it follows the same three rules.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. The error was already bound and already
 * sent to Sentry. Rule 2 of the precedent is the one that bites: the
 * measurement has to reach the RENDER, or nothing the person sees improves.
 *
 * 🛡 Behaviour is tested against a stubbed client (not just the source), and
 * every source assertion is mutation-checked by occurrence count.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchGuestsByEventMeasured, fetchGuestsByEvent } from '@/lib/guests';
import { stripComments } from '@/lib/strip-comments';

/** Minimal thenable query builder — every chained filter returns itself. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'is', 'order', 'not', 'in', 'limit']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const ROW = {
  guest_id: 'g1',
  first_name: 'Ana',
  last_name: 'Reyes',
  role: 'guest',
  rsvp_status: 'attending',
};

test('a REFUSED read reports measured:false — not an empty guest list', async () => {
  const refused = stubClient({
    data: null,
    // The shape PostgREST returns for a phantom column / stale enum: it
    // RESOLVES with an error rather than throwing, which is the whole reason
    // this defect is invisible.
    error: { message: 'column guests.nope does not exist', code: '42703' },
  });
  const got = await fetchGuestsByEventMeasured(refused, 'e1');
  assert.equal(got.measured, false, 'a refusal must be reported, not swallowed');
  assert.deepEqual(got.rows, [], 'rows are unknown, and unknown renders as none');
});

test('a SUCCESSFUL empty read reports measured:true — genuinely no guests', async () => {
  const empty = stubClient({ data: [], error: null });
  const got = await fetchGuestsByEventMeasured(empty, 'e1');
  assert.equal(got.measured, true, 'a real empty list is a fact, and may be stated');
  assert.deepEqual(got.rows, []);
});

test('the two cases are DISTINGUISHABLE — which is the entire point', async () => {
  const refused = await fetchGuestsByEventMeasured(
    stubClient({ data: null, error: { message: 'permission denied', code: '42501' } }),
    'e1',
  );
  const genuine = await fetchGuestsByEventMeasured(stubClient({ data: [], error: null }), 'e1');
  assert.deepEqual(refused.rows, genuine.rows, 'the rows really are identical…');
  assert.notEqual(refused.measured, genuine.measured, '…so the flag is the only thing that can tell them apart');
});

test('rows still arrive, and the couple is still marked attending', async () => {
  const ok = stubClient({ data: [{ ...ROW, role: 'bride', rsvp_status: 'pending' }], error: null });
  const got = await fetchGuestsByEventMeasured(ok, 'e1');
  assert.equal(got.measured, true);
  assert.equal(got.rows.length, 1);
  assert.equal(got.rows[0]!.rsvp_status, 'attending', 'coupleAttending still applies');
});

test('the array-only wrapper is the SAME query, not a second one', async () => {
  // If the wrapper ever grows its own copy of the select, the two drift and
  // only one of them gets fixed next time.
  const ok = stubClient({ data: [ROW], error: null });
  const viaWrapper = await fetchGuestsByEvent(ok, 'e1');
  const viaMeasured = await fetchGuestsByEventMeasured(stubClient({ data: [ROW], error: null }), 'e1');
  assert.deepEqual(viaWrapper, viaMeasured.rows);
  const src = stripComments(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'guests.ts'), 'utf8'),
  );
  // NOT "one select in the file" — `fetchGuestById` legitimately runs its own
  // single-row query. What must hold is that the WRAPPER delegates instead of
  // carrying a second copy of the LIST query, which is how two versions of one
  // read start drifting and only one of them gets fixed.
  const wrapper = src.slice(src.indexOf('export async function fetchGuestsByEvent('));
  const body = wrapper.slice(0, wrapper.indexOf('\n}') + 2);
  assert.match(body, /fetchGuestsByEventMeasured\(/, 'the wrapper must delegate');
  assert.doesNotMatch(body, /\.select\(GUEST_FIELDS\)/, 'and must not re-run the list query');
});

// ── the render layer — precedent rule 2: the flag must reach the screen ────

const PAGE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'app/dashboard/[eventId]/guests/page.tsx',
);
// Comments stripped: this file now carries notes naming the very strings the
// defect used to render, so a raw-source guard would read the explanation of
// the fix as the bug itself.
const page = () => stripComments(readFileSync(PAGE, 'utf8'));

test('the guests page asks whether the read happened', () => {
  const src = page();
  assert.match(src, /fetchGuestsByEventMeasured\(/, 'must take the measurement');
  assert.doesNotMatch(
    src,
    /fetchGuestsByEvent\(supabase/,
    'the array-only wrapper cannot tell this page whether its empty list is real',
  );
});

test('every claim on the page is gated on that measurement', () => {
  const src = page();
  // 1 · the zero-state sentence AND the summary bar — anchored to each
  //     component separately. A file-level match cannot say WHICH one still
  //     knows: the flag is passed twice, so sabotaging one left the other and
  //     a bare /measured=\{guestsMeasured\}/ stayed green (measured, 2 -> 1).
  const propOf = (tag: string) => {
    const at = src.indexOf('<' + tag);
    assert.notEqual(at, -1, tag + ' must still be rendered');
    return src.slice(at, src.indexOf('/>', at));
  };
  assert.match(propOf('EmptyState'), /measured=\{guestsMeasured\}/, 'the zero-state must know');
  assert.match(propOf('SummaryFacetBar'), /measured=\{guestsMeasured\}/, 'the summary bar must know');
  assert.match(src, /We couldn&rsquo;t load your guest list/, 'and must say so');
  // 2 · the headcount (precedent rule 3)
  assert.match(
    src,
    /guestsMeasured \? \(\s*<>\s*<span className="font-mono">\{stats\.total\}/,
    'the masthead headcount must be gated',
  );
  // 3 · the confirmations meter
  assert.match(src, /measured \? \(\s*<>\s*\{responded\} of \{stats\.total\}/, 'the RSVP figure must be gated');
  assert.match(src, /: 'Responses could not be loaded'/, 'including for screen readers');
});
