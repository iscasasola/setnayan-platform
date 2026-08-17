/**
 * A live flow must be described on /privacy — the "run truthfully" guard.
 *
 * Owner standing rule, 2026-07-30: *"we will do everything on january 2027 but
 * let this run truthfully until then."* The NPC **filing** work (lawful-basis
 * rulings, adopting ROPA rows 21/22/23, the subprocessor line) is deferred to
 * January 2027. What is NOT deferred is the public page telling the truth about
 * processing that is happening today.
 *
 * Two controls went ACTIVE in prod on 2026-07-27 while `/privacy` said nothing
 * about them:
 *   • `papic_pool_gallery` — a guest's captures become visible to the OTHER
 *     signed-in guests of the same event, not just the couple.
 *   • `guest_columns` — a guest's words + roster-name byline are published to the
 *     open web after couple approval.
 *
 * Both disclosures landed 2026-07-30. These tests keep them there. They are
 * deliberately assertions about the PUBLIC PAGE, not about the coverage map: the
 * map's `declaredIn` stays empty until the filing itself carries the rows, so the
 * admin drift tab must keep showing red — see `privacy-coverage.ts`. Silencing
 * that alarm was explicitly rejected; disclosing to users was not.
 *
 * Also pinned: the calls section used to claim the media "never reaches our
 * servers at all", three paragraphs below its own accurate description of the
 * Cloudflare relay. On a relayed call the media does traverse that relay. The
 * over-claim is corrected and must not come back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const privacySrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'app', '(shell)', 'privacy', 'page.tsx'),
  'utf8',
);

test('/privacy discloses that the shared pool exposes captures to other guests', () => {
  assert.match(
    privacySrc,
    /shared pool/i,
    'the shared pool is live in prod — the page must name it',
  );
  assert.match(
    privacySrc,
    /other signed-in guests of that same event|other guests at the same event/i,
    'the page must say WHO can see the shots, not merely that a pool exists',
  );
  // The honest scope limits must survive too — they are what makes the
  // disclosure accurate rather than alarming.
  assert.match(privacySrc, /never crosses\s*\n?\s*events|scoped to the one celebration/i);
});

test('/privacy discloses guest-written columns as OPEN-WEB publication', () => {
  assert.match(privacySrc, /Guest-written columns/i);
  assert.match(
    privacySrc,
    /published on the open web/i,
    'a guest must be told the audience is the public, not the couple',
  );
  assert.match(
    privacySrc,
    /byline/i,
    'the roster-name byline is the part a guest would not expect — say it',
  );
  // The two truthful mitigations: approval gate + withdrawal.
  assert.match(privacySrc, /Nothing is published automatically/i);
  assert.match(privacySrc, /take it down|Withdraw your own column/i);
});

test('/privacy does NOT re-claim that call media never reaches our servers', () => {
  assert.ok(
    !/media never\s*\n?\s*reaches our servers at all/i.test(privacySrc),
    'that clause contradicts the Cloudflare-relay paragraph three above it',
  );
  // …and the accurate replacement is present.
  assert.match(
    privacySrc,
    /relayed connection it passes through the Cloudflare relay/i,
    'the relay transit must be stated in the never-recorded paragraph itself',
  );
});

test('the policy states its own last-updated date as the day it last changed', () => {
  // A policy that changes without moving its date misrepresents its currency.
  assert.match(privacySrc, /last updated 2026-08-04/);
});

test('the coverage map still shows the filing gap — the alarm is not silenced', async () => {
  const { CONTROL_COVERAGE } = await import('./privacy-coverage');
  for (const key of ['papic_pool_gallery', 'guest_columns'] as const) {
    assert.deepEqual(
      CONTROL_COVERAGE[key].declaredIn,
      [],
      `${key}: shipping the /privacy disclosure must NOT mark it declared to the NPC — ` +
        'the filing lands January 2027, and the drift tab has to keep saying so',
    );
    assert.equal(CONTROL_COVERAGE[key].privacySensitive, true);
  }
});
