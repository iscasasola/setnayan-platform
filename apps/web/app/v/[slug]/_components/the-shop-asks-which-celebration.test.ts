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
// 13 Nov 2026 (owner, "Yes, only one"): the inline InquiryComposer was retired and deleted; the shop's ONE Inquire
// is the pop-up, so the no-celebration rule is pinned where it now lives.
const INQUIRE_SHEET = join(WEB, 'app/v/[slug]/_components/inquire-sheet.tsx');
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

// 13 Nov 2026 (owner, "Yes, only one"): the inline composer and its "which celebration" picker left the foot of the
// page with the Inquire section. The question is still asked, in the two places a couple acts: "Add to your event"
// (SaveVendorButton's own "Add to your event…" choice) and the Inquire pop-up's event step — both fed by THIS resolver.
test('the picker\'s choices still reach the page — Add to your event and the Inquire pop-up', () => {
  const src = code(PAGE);
  assert.doesNotMatch(src, /<AddToEvent\b/, 'the retired foot picker came back');
  assert.match(src, /const inquireEventState = canMessage && viewerSignedIn \? await resolveAddShopToEvent\(slug\) : null;/);
  const save = src.slice(src.indexOf('<SaveVendorButton'), src.indexOf('<SaveVendorButton') + 700);
  assert.match(
    save,
    /events=\{\s*inquireEventState\?\.signedIn && inquireEventState\.options\.length >= 2/,
    'Add to your event must ask which celebration only when there is a real choice, from the resolver',
  );
  assert.match(src, /events=\{inquireEvents\}/, 'the pop-up lost the resolved events');
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
  const src = code(INQUIRE_SHEET);
  const hardcoded = src.match(/['"`]\/onboarding\/wedding/g) ?? [];
  assert.equal(
    hardcoded.length,
    0,
    `${hardcoded.length} hard-coded wedding onboarding path(s) remain in code`,
  );
  // The retired composer NAVIGATED from two no_event branches (pinned as a count of 2). The pop-up never reaches a
  // no_event send: with no event it offers "Start a new event", a LINK to the create-event picker (which asks the
  // kind) carrying this shop back in `next` — so the claim is that link, once.
  const sends = src.match(/\/dashboard\/create-event\?next=/g) ?? [];
  assert.equal(sends.length, 1, `expected one create-event hand-off in the Inquire pop-up, found ${sends.length}`);
});
