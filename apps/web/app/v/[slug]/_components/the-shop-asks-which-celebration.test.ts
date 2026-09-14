import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * D1 · THE PAGE ASKS, AND THE ANSWER IS USED.
 *
 * A picker that EXISTS and a picker that is USED look identical from a
 * file-level grep, so each assertion here parses the construct it is about.
 *
 * What it does NOT claim: that `events[0]` was random. It is not — the query
 * carries no `ORDER BY` but the function sorts in JS (`is_primary` first, then
 * soonest date), so it means "your primary celebration, otherwise the soonest".
 * A real rule; just an invisible one the couple never chose. It is undecided
 * only among ties, where the comparator returns 0 and the sort is stable.
 */

const WEB = process.cwd();
const PAGE = join(WEB, 'app/v/[slug]/page.tsx');
const COMPOSER = join(WEB, 'app/v/[slug]/_components/inquiry-composer.tsx');
const RESOLVER = join(WEB, 'app/v/[slug]/_components/add-shop-to-event-data.ts');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(
    stripped.length > raw.length * 0.15,
    `stripping ${path} removed too much (${raw.length} -> ${stripped.length})`,
  );
  return stripped;
}

test('the chosen celebration OUTRANKS the default, and the default survives', () => {
  const src = code(PAGE);
  // The choice must win, and `events[0]` must still be there behind it — a
  // couple with exactly one celebration is never made to choose.
  assert.match(
    src,
    /coupleEventId = chosen\?\.event_id \?\? events\[0\]\?\.event_id \?\? null/,
    'the chosen event is no longer preferred over the default, or the default was dropped',
  );
  assert.match(
    src,
    /coupleEventDate = chosen\?\.event_date \?\? events\[0\]\?\.event_date \?\? null/,
    'the date must follow the same event as the id, or the two describe different celebrations',
  );
});

test('the URL claim is CHECKED against the viewer’s own memberships', () => {
  // `?event=` is a claim from a URL. It is validated against the list of this
  // user's own organiser memberships that was already read — so a forged or
  // mistyped id can never scope the page to somebody else's celebration.
  const src = code(PAGE);
  assert.match(
    src,
    /events\.some\(\(e\) => e\.event_id === requestedEventId\)/,
    'the ?event= claim is no longer checked against the viewer’s own events',
  );
});

test('the picker is MOUNTED, and only when there is a real choice', () => {
  const src = code(PAGE);
  const mounts = src.match(/<AddToEvent\b/g) ?? [];
  assert.equal(mounts.length, 1, `expected exactly one picker mount, found ${mounts.length}`);
  assert.match(
    src,
    /shopEventPicker\?\.signedIn && shopEventPicker\.options\.length > 1/,
    'the picker must be offered only when more than one celebration qualifies',
  );
  // And what it renders must be the resolved options, not a literal.
  assert.match(src, /options=\{shopEventOptions\}/);

  /*
    ⚠ THE GATE IT SITS BEHIND, NOT JUST ITS PRESENCE. A mutation run caught this
    version of the guard passing while the mount was gated on `{false ? (`: the
    component was still in the file, still had its props, and was unreachable.
    A picker that exists and a picker that is used are identical to a grep, so
    read the CONDITION of the JSX conditional the mount is inside.
  */
  const at = src.indexOf('<AddToEvent');
  const open = src.lastIndexOf('{', at);
  assert.ok(open > -1 && open < at, 'the picker is no longer inside a JSX expression');
  const condition = src.slice(open + 1, src.indexOf('?', open));
  assert.match(
    condition,
    /shopEventOptions\.length > 0/,
    `the picker's mount gate is not the resolved options — gate was: ${condition.trim()}`,
  );
  assert.doesNotMatch(
    condition,
    /\bfalse\b|\btrue\b/,
    `the picker's gate was replaced by a constant — gate was: ${condition.trim()}`,
  );
});

test('the resolver reuses the shipped filtering rule, surfaceless', () => {
  // The rule may not be edited or copied. A shop is universal, so it passes a
  // gate with no `surface` and `eventsForStudioApp` skips its compatibility
  // check while still applying "yours to change" and "ongoing and upcoming".
  const src = code(RESOLVER);
  assert.match(src, /eventsForStudioApp\(SHOP_IS_UNIVERSAL, pickable, manilaTodayISO\(\)\)/);
  assert.doesNotMatch(
    src,
    /surface:/,
    'a surface would re-enable the compatibility gate a shop does not have',
  );
  assert.doesNotMatch(
    src,
    /isFinishedEvent|eventStance|surfaceEnabled/,
    'the filtering predicates were copied instead of reused',
  );
});

test('choosing writes NOTHING — every row is a link', () => {
  const src = code(RESOLVER);
  assert.match(src, /href: shopEventHref\(slug, e\.eventId\)/);
  assert.doesNotMatch(
    src,
    /\.insert\(|\.update\(|\.upsert\(|'use server'/,
    'the picker started writing; it is navigation, and that is why it needs no action',
  );
});

test('a person with no celebration is ASKED which kind, never marched into a wedding', () => {
  const src = code(COMPOSER);
  const hardcoded = src.match(/['"`]\/onboarding\/wedding/g) ?? [];
  assert.equal(
    hardcoded.length,
    0,
    `${hardcoded.length} hard-coded wedding onboarding path(s) remain in code`,
  );
  // Both no_event branches NAVIGATE there. Counting bare `noEventDestination()`
  // would also match its own declaration — `function noEventDestination(): string`
  // — and report 3, so this counts the assignment that actually leaves the page.
  const sends = src.match(/window\.location\.href = noEventDestination\(\)/g) ?? [];
  assert.equal(
    sends.length,
    2,
    `expected both no_event branches to navigate, found ${sends.length}`,
  );
  assert.match(src, /\/dashboard\/create-event\?next=/);
});
