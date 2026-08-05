/**
 * site-reachability.test.ts — "Live" must mean a guest can open the page.
 *
 * A couple prints this link on invitations. Two surfaces claimed the site was
 * live on evidence that had nothing to do with whether anyone could open it:
 *
 *   • the website home showed a green tick and "Live — this link is yours" as
 *     soon as `event.slug` was non-null. A slug is a NAME. Every event gets one
 *     at creation, months before launch, and a page set to Private has one too.
 *   • the privacy page computed `launched = std_launched_at || visibility ===
 *     'public'`, so a couple who launched and later chose Private saw "Your page
 *     is live — anyone with your link can view your page" sitting directly above
 *     a radio button reading Private. Two claims, one screen, and the confident
 *     one was wrong: guests were getting the locked screen.
 *
 * Both now derive from `resolveSiteReachability`, which is built on the same
 * `resolveEffectiveVisibility` the guest page renders from — so the couple's
 * screen and the guest's screen cannot disagree about the same event.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSiteReachability, resolveEffectiveVisibility } from './launch-save-the-date';

const NOW = Date.parse('2026-08-05T12:00:00+08:00');
const hour = (n: number) => new Date(NOW + n * 3_600_000).toISOString();

test('the case that started this: launched, then set to Private', () => {
  const event = {
    slug: 'cale-ice',
    landing_page_visibility: 'private' as const,
    std_launched_at: hour(-72),
    scheduled_launch_at: null,
  };
  const reach = resolveSiteReachability(event, NOW);

  assert.equal(reach.reachable, false, 'A private page is NOT live, however it got that way.');
  assert.equal(
    reach.launchedButHidden,
    true,
    'This flag is the whole point. Telling them only "not live" sends them ' +
      'looking for a launch button they already pressed — the screen has to say ' +
      'that the Private setting is what is overriding it.',
  );
  // And it must agree with what the guest page will do.
  assert.equal(resolveEffectiveVisibility(event, NOW), 'private');
});

test('a slug alone is not live — the bug the green tick had', () => {
  const reach = resolveSiteReachability(
    { slug: 'cale-ice', landing_page_visibility: 'private', std_launched_at: null },
    NOW,
  );
  assert.equal(reach.reachable, false, 'Having an address is not the same as being open.');
  assert.equal(
    reach.launchedButHidden,
    false,
    'They never launched, so do not tell them something is overriding a launch.',
  );
});

test('public and unlisted are both live — a link-only page still opens', () => {
  for (const visibility of ['public', 'unlisted'] as const) {
    const reach = resolveSiteReachability(
      { slug: 'cale-ice', landing_page_visibility: visibility, std_launched_at: hour(-1) },
      NOW,
    );
    assert.equal(reach.reachable, true, `${visibility} must read as live`);
    assert.equal(reach.visibility, visibility, 'the distinction is kept, so the copy can differ');
    assert.equal(reach.launchedButHidden, false);
  }
});

test('no slug is not live, whatever the visibility says', () => {
  const reach = resolveSiteReachability(
    { slug: null, landing_page_visibility: 'public', std_launched_at: hour(-1) },
    NOW,
  );
  assert.equal(reach.reachable, false, 'There is no address for anyone to open.');
});

test('a scheduled launch reads as not-live BEFORE, live AFTER — with no write', () => {
  const event = {
    slug: 'cale-ice',
    landing_page_visibility: 'private' as const,
    scheduled_launch_at: hour(6),
    std_launched_at: null,
  };
  const before = resolveSiteReachability(event, NOW);
  assert.equal(before.reachable, false);
  assert.equal(before.scheduled, true, 'so the copy can say WHEN rather than just "no"');

  // The launch is cron-free — evaluated at read time. The same row, six hours on.
  const after = resolveSiteReachability(event, NOW + 7 * 3_600_000);
  assert.equal(after.reachable, true, 'the due schedule opens the page with nothing written');
  assert.equal(after.scheduled, false, 'and it stops being "upcoming" once it has happened');
});

test('scheduled and launched-but-hidden are told apart', () => {
  // Both are private. A couple who launched and then hid needs different words
  // from a couple who has never launched and has a date set.
  const relaunchedThenHidden = resolveSiteReachability(
    {
      slug: 'cale-ice',
      landing_page_visibility: 'private',
      std_launched_at: hour(-48),
      scheduled_launch_at: hour(6),
    },
    NOW,
  );
  assert.equal(relaunchedThenHidden.launchedButHidden, true);
  assert.equal(
    relaunchedThenHidden.reachable,
    false,
    'a future schedule does not make a page live now',
  );
});
