import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  resolveExploreScope,
  browseAllVendorsHref,
  BROWSE_ALL_EVENT_TYPES,
} from './explore-event-type-scope';

/**
 * The property: the one link offered to someone looking at an empty
 * marketplace takes them somewhere that is not the same empty marketplace.
 *
 * Measured: a signed-in couple whose celebration is a simple_event saw
 * "COMING SOON — Simple Event vendors are being recruited", zero cards, and
 * `Or browse all vendors instead →` pointing at `/explore`. The auto-apply
 * fires on a MISSING `event_type`, and the escape worked by removing it — so
 * following the only way out reproduced the identical page.
 */

const KNOWN = new Set(['wedding', 'simple_event', 'debut', 'birthday']);

/* ── THE DECISION, EXECUTED ──────────────────────────────────────────────── */

test('THE BUG: nothing chosen scopes a non-wedding couple to their own type', () => {
  // This half was correct and must stay — it is why the page is scoped at all.
  assert.deepEqual(resolveExploreScope(null, 'simple_event', KNOWN), {
    eventType: 'simple_event',
    browseAll: false,
  });
});

test('THE FIX: asking for everything beats the auto-apply', () => {
  // Before, this was expressed by REMOVING the parameter — which is the same
  // input as "I have not chosen", so it re-applied and the page never changed.
  assert.deepEqual(resolveExploreScope('all', 'simple_event', KNOWN), {
    eventType: null,
    browseAll: true,
  });
  // And it holds for every event type, not just the one that was reported.
  for (const t of KNOWN) {
    const s = resolveExploreScope(BROWSE_ALL_EVENT_TYPES, t, KNOWN);
    assert.equal(s.eventType, null, `"all" was overridden for ${t}`);
    assert.equal(s.browseAll, true);
  }
});

test('the escape link can never be a bare /explore again', () => {
  // A bare /explore IS the bug: no event_type, so the auto-apply re-fires.
  for (const focused of [true, false]) {
    const href = browseAllVendorsHref(focused);
    assert.notEqual(href, '/explore');
    assert.notEqual(href, '/explore?from=plan');
    assert.match(href, /event_type=all/, `escape without the sentinel: ${href}`);
  }
  // focusedMode still round-trips, or the plan context is lost on the way out.
  assert.match(browseAllVendorsHref(true), /from=plan/);
  assert.doesNotMatch(browseAllVendorsHref(false), /from=plan/);
});

test('following the escape does NOT re-scope — the loop is closed', () => {
  // The whole defect in one assertion: feed the link's own parameter back in
  // and the page must not scope itself again.
  const href = browseAllVendorsHref(false);
  const param = new URL(href, 'https://x').searchParams.get('event_type');
  const after = resolveExploreScope(param, 'simple_event', KNOWN);
  assert.equal(
    after.eventType,
    null,
    'the escape link re-applies the couple event type — this is the loop, restored',
  );
});

test('a wedding still skips the auto-apply, and an unknown type is not a filter', () => {
  assert.deepEqual(resolveExploreScope(null, 'wedding', KNOWN), {
    eventType: null,
    browseAll: false,
  });
  // A type the admin has retired from the vocab must not silently filter to
  // nothing — same failure with a different cause.
  assert.deepEqual(resolveExploreScope(null, 'seance', KNOWN), {
    eventType: null,
    browseAll: false,
  });
  assert.deepEqual(resolveExploreScope('seance', 'wedding', KNOWN), {
    eventType: null,
    browseAll: false,
  });
});

test('an explicit choice is honoured, case and padding forgiven', () => {
  assert.equal(resolveExploreScope(' DEBUT ', 'wedding', KNOWN).eventType, 'debut');
  assert.equal(resolveExploreScope('debut', 'simple_event', KNOWN).eventType, 'debut');
});

/* ── THE WIRING ──────────────────────────────────────────────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const page = () =>
  stripComments(readFileSync(join(WEB, 'app/(shell)/explore/page.tsx'), 'utf8'));

test('the page uses the resolver rather than re-spelling the rule', () => {
  const s = page();
  assert.match(s, /resolveExploreScope\(/, 'the page stopped using the shared resolver');
  assert.match(s, /browseAllVendorsHref\(/, 'the escape link is hand-written again');
  // The exact condition that WAS the bug.
  assert.doesNotMatch(
    s,
    /if \(!filters\.eventType && coupleEventType/,
    'the old auto-apply is back: it fires on a missing event_type, which is ' +
      'precisely what the escape link produces',
  );
  // ⚠ SCOPED TO THE ESCAPE, not to every bare `/explore` on the page. My first
  // version forbade the string outright and convicted "Clear all filters",
  // which is a DIFFERENT control: clearing filters means "back to the default
  // view", and for a scoped couple the default view IS their own celebration.
  // That is not a loop — the empty state it lands on now carries a working way
  // out. The bug was only ever the link that PROMISED everything and delivered
  // the same page.
  const escapeStart = s.indexOf('Or browse all vendors instead');
  assert.ok(escapeStart > 0, 'the escape CTA copy vanished — find it before asserting on it');
  const escapeLink = s.slice(Math.max(0, escapeStart - 400), escapeStart);
  assert.match(
    escapeLink,
    /browseAllVendorsHref\(/,
    'the "browse all vendors" escape is hand-written again. A bare /explore ' +
      'sends no event_type, which is exactly what re-applies the scope — the ' +
      'loop, restored.',
  );
  assert.doesNotMatch(
    escapeLink,
    /href=\{filters\.focusedMode \? '\/explore\?from=plan' : '\/explore'\}/,
    'the escape link is the bare /explore pair again',
  );
});
