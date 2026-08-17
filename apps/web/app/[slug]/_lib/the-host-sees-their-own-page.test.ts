/**
 * the-host-sees-their-own-page.test.ts — a couple opening their own wedding's
 * address must not be told to go and find an invitation they are the ones who
 * send.
 *
 * ── WHAT THIS GUARDS, AND WHY IT IS ONLY A GUARD ────────────────────────────
 * The behaviour ALREADY SHIPS. It landed in `3f0e7fef6`
 * ("fix(event-hub): admit a booked supplier past the private-event gate",
 * PR #4483) alongside the supplier gate, and `site-body.tsx` carries the whole
 * reasoning at its `viewerIsHost` docblock. **Nothing here changes what anybody
 * sees.** What was missing is that NO TEST ANYWHERE named it: not one file in
 * the repo asserted "your event page" or "You're the host", so the entire host
 * body could be deleted and every suite would stay green.
 *
 * That is the shape this repo keeps paying for — a working mechanism with no
 * guard, indistinguishable from one that was never built. A brief was written
 * on 2026-08-17 asking for this feature to be BUILT, because from the outside
 * there was no way to tell it already existed.
 *
 * ── THE MECHANISM IT PROTECTS ───────────────────────────────────────────────
 * A host has an ACCOUNT, not a guest cookie. Hosts are never sent an invitation
 * QR, so a signed-in couple hits `if (!session) return renderAnonymous(...)` in
 * page.tsx and is rendered the STRANGER'S body. What makes that survivable is
 * that `renderAnonymous` spreads `siteProps`, which carries `ownerCapability`,
 * so `site-body.tsx` can still recognise them and swap the copy.
 *
 * Three things therefore have to stay true, and each is asserted below:
 *   1. `ownerCapability` reaches the anonymous render path at all.
 *   2. The host branch WINS over every `reason` variant — a stale or absent
 *      guest cookie says nothing about somebody whose host membership the
 *      database just confirmed.
 *   3. `FindModeCard` — "Have an invitation?" / "Open my invitation" — never
 *      renders for the person who ISSUES the invitations.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
 * ⛔ It does not assert the host acquires no guest data. That is already
 * covered, thoroughly, by `lib/anonymous-zero-guest.test.ts` — ten tests
 * including owner-capability key-poisoning in BOTH identity tiers, reading the
 * forbidden key list from the module's own export so it cannot drift. Restating
 * it here would be a second, weaker copy of a stronger check.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE ANY MATCH, and here that is not a formality:
 * `site-body.tsx`'s own docblock QUOTES the stranger sentence ("Scan your
 * personal QR or open the link the couple sent you") while explaining why a
 * host must never see it. A guard that did not strip comments would find that
 * sentence, conclude the host branch was missing, and be satisfied by prose
 * about the very thing it is checking. Four guards in this repo have already
 * been fooled exactly that way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Strip block and line comments — prose about the mechanism is not the mechanism. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

const BODY = code(readFileSync(join(HERE, '..', '_components', 'site-body.tsx'), 'utf8'));
const PAGE = code(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));

/** The sentence written for a stranger. Addressed to a host it is a dead end. */
const STRANGER_SENTENCE = 'This is a Setnayan invitation page.';

test('META · the sources loaded and comment-stripping did not gut them', () => {
  // Anti-vacuity. If the paths were wrong or the stripper too greedy, every
  // "does not contain" assertion below would pass by inspecting nothing.
  // Floors sit well under the measured sizes (site-body 50.8k, page 16.5k
  // stripped on 2026-08-17) so ordinary editing cannot trip them, while a wrong
  // path (0) or a runaway stripper still does. page.tsx is the smaller of the
  // two AFTER stripping because roughly two-thirds of it is commentary.
  assert.ok(BODY.length > 30_000, `site-body.tsx stripped to ${BODY.length} chars — too small`);
  assert.ok(PAGE.length > 10_000, `page.tsx stripped to ${PAGE.length} chars — too small`);
  assert.ok(
    BODY.includes('viewerIsHost'),
    'viewerIsHost is gone from site-body.tsx entirely — the host body has been removed',
  );
});

/**
 * ⚠ THIS ASSERTION CRIED WOLF ON ITS FIRST DAY, and the rewrite is the lesson.
 *
 * It originally pinned the exact inline expression
 * `ownerCapability !== null && ownerCapability.ownerEventId === event.event_id`.
 * Within hours that was extracted, unchanged, into a shared
 * `viewerIsEventHost()` in `_lib/site-identity.ts` — a strict improvement, since
 * `lib/owner-ribbon.ts` now asks the same question through the same function
 * instead of restating it. Behaviour identical; my guard went red.
 *
 * Worse, it went red ON MAIN rather than on the PR: the PR was cut before the
 * extraction landed and branch protection here is non-strict, so CI never ran
 * the combined tree. A guard pinned to one SPELLING converts somebody else's
 * clean refactor into a broken build.
 *
 * 🔑 ASSERT THE RULE, NOT THE PHRASING. Host-ness must come from a capability
 * that exists AND was minted for THIS event — wherever that comparison lives.
 * Both spellings are accepted, and the shared helper is then held to the rule
 * itself, so moving the check into one place cannot hollow it out.
 */
test('the host is recognised from the server-verified capability, not from a request', () => {
  // `ownerCapability` is produced only by resolveOwnerCapability, which requires
  // a real auth user whose host membership of THIS event the database confirmed.
  const inline =
    /const viewerIsHost\s*=\s*\n?\s*ownerCapability !== null && ownerCapability\.ownerEventId === event\.event_id;/;
  const viaHelper = /const viewerIsHost\s*=\s*viewerIsEventHost\(\s*ownerCapability,\s*event\.event_id\s*\)/;

  assert.ok(
    inline.test(BODY) || viaHelper.test(BODY),
    'viewerIsHost is no longer derived from `ownerCapability` AND `event.event_id` — neither ' +
      'inline nor through viewerIsEventHost(ownerCapability, event.event_id). If it now keys on ' +
      'a prop, a param or the ribbon model, the host body is reachable by something other than ' +
      'verified host membership, or silently unreachable for a host of a slugless event.',
  );

  // The event check is the half that stops a capability minted for event A being
  // spent on event B. When the rule lives in a shared helper, THAT is where it
  // has to be enforced — and two callers now depend on it.
  if (viaHelper.test(BODY)) {
    const IDENTITY = code(readFileSync(join(HERE, 'site-identity.ts'), 'utf8'));
    assert.match(
      IDENTITY,
      /export function viewerIsEventHost\([\s\S]{0,240}?if \(!ownerCapability\) return false;[\s\S]{0,160}?ownerCapability\.ownerEventId === eventId/,
      'viewerIsEventHost no longer requires BOTH a non-null capability and an ownerEventId ' +
        'match. It is the single home of that rule for the body AND the ribbon, so weakening it ' +
        'here would let a host of one event be addressed as the host of another.',
    );
  }
});

test('ownerCapability reaches the anonymous render path — the wiring the whole thing rests on', () => {
  // A host falls into renderAnonymous. If that call stopped carrying siteProps,
  // or siteProps stopped carrying ownerCapability, site-body could no longer
  // recognise a host and the copy would silently revert to the stranger's.
  // ⚠ SCOPED TO THE OBJECT, NOT A WINDOW. The first cut of this assertion was
  // `/const siteProps[\s\S]{0,4000}?ownerCapability,/` and it stayed GREEN when
  // `ownerCapability` was deleted from siteProps — because the very next thing
  // in the file is `shouldSimulateRepliedGuest({ ownerCapability, … })`, which
  // sits inside that window and satisfied the pattern. A guard can match a
  // string instead of the act. So the object literal is sliced out and the
  // membership checked inside it.
  const propsStart = PAGE.indexOf('const siteProps');
  assert.ok(propsStart > -1, 'the siteProps object is gone from page.tsx');
  const propsEnd = PAGE.indexOf('\n  };', propsStart);
  assert.ok(propsEnd > propsStart, 'could not find the end of the siteProps object literal');
  const sitePropsLiteral = PAGE.slice(propsStart, propsEnd);
  assert.match(
    sitePropsLiteral,
    /\n\s*ownerCapability,/,
    'siteProps no longer includes ownerCapability, so site-body can never recognise a host and ' +
      'the couple is handed the stranger body on their own wedding page.',
  );
  assert.match(
    PAGE,
    /const renderAnonymous = \(reason: AnonymousReason\) => \(\s*<SiteBody\s*\{\.\.\.siteProps\}/,
    'renderAnonymous no longer spreads siteProps into SiteBody. A signed-in host with no guest ' +
      'cookie takes this exact path, so dropping the spread hands them the stranger body again.',
  );
});

test('the host branch WINS over every reason variant', () => {
  // Order matters, not mere presence. `wrong_event` and `invalid_invite` are
  // both statements about a guest cookie, and a host has none — so if a reason
  // variant were tested first, a host arriving with a stale cookie for another
  // event would be told to "open your own QR or invite link".
  // Anchored WITHOUT the leading brace so the host test can be located anywhere
  // in the chain, not only at its head. That separation matters: in a ternary
  // chain only the head carries `{`, so anchoring on `{viewerIsHost` would make
  // "is present" and "is first" the same assertion, and a swap of two branch
  // CONDITIONS — the realistic way this ordering regresses — could not be
  // distinguished from a deletion.
  const hostAt = BODY.indexOf('viewerIsHost ? (');
  const strangerAt = BODY.indexOf(STRANGER_SENTENCE);
  const invalidAt = BODY.indexOf("reason === 'invalid_invite' ?");
  const wrongAt = BODY.indexOf("reason === 'wrong_event' ?");

  assert.ok(hostAt > -1, 'the `viewerIsHost ? (` masthead branch is gone');
  assert.match(
    BODY,
    /\{viewerIsHost \? \(/,
    'viewerIsHost is no longer the HEAD of the masthead chain. It still appears, so some other ' +
      'condition is now tested first — and every other condition in that chain is a statement ' +
      'about a guest cookie the host does not have.',
  );
  assert.ok(strangerAt > -1, `the stranger sentence "${STRANGER_SENTENCE}" is gone — chain changed`);
  assert.ok(invalidAt > -1 && wrongAt > -1, 'the reason variants are gone — chain changed');

  assert.ok(
    hostAt < invalidAt && hostAt < wrongAt && hostAt < strangerAt,
    'the host branch no longer comes FIRST in the masthead chain. A host has no guest cookie, ' +
      'so any reason variant tested before it will catch them and address them as a guest with ' +
      'a broken link.',
  );
});

test('the stranger sentence exists exactly once, so there is no unguarded second copy', () => {
  // The host branch only protects the chain it sits in. A duplicate of this
  // sentence anywhere else in the body would reach a host untouched.
  const occurrences = BODY.split(STRANGER_SENTENCE).length - 1;
  assert.equal(
    occurrences,
    1,
    `"${STRANGER_SENTENCE}" appears ${occurrences} times in the rendered body. Exactly one ` +
      'occurrence is expected, inside the chain whose first test is viewerIsHost. A second copy ' +
      'is reachable by a host and tells the couple to go and find their own invitation.',
  );
});

test('the "Open my invitation" dead end never renders for the host', () => {
  // FindModeCard asks "Have an invitation?" and offers "Open my invitation" —
  // the one door that is not the host's. It must stay behind a viewerIsHost
  // test, and it must have only one render site to keep behind one.
  const cardRenders = BODY.split('<FindModeCard').length - 1;
  assert.equal(
    cardRenders,
    1,
    `<FindModeCard> renders from ${cardRenders} places. Each one needs its own host guard; the ` +
      'guard below only proves the first.',
  );

  const guardAt = BODY.indexOf('plan.openBrowse && viewerIsHost ? (');
  const cardAt = BODY.indexOf('<FindModeCard');
  assert.ok(
    guardAt > -1 && guardAt < cardAt,
    'the Me-tab chain no longer tests `plan.openBrowse && viewerIsHost` before rendering ' +
      '<FindModeCard>, so the host is offered "Open my invitation" — a door that is not theirs, ' +
      'on their own wedding page.',
  );
});

test('the ?as=replied host preview is still gated on the capability, and is still separate', () => {
  // A pre-existing feature the host body must not break or duplicate: it
  // substitutes a FABRICATED guest so a host can preview the RSVP'd view. It is
  // a preview mode; the host body is not.
  assert.match(
    PAGE,
    /shouldSimulateRepliedGuest\(\{\s*\n?\s*ownerCapability,/,
    'the ?as=replied preview no longer keys on ownerCapability — either it is ungated (any ' +
      'visitor could fabricate a guest view) or it is unreachable for the host it exists for.',
  );
  assert.match(
    PAGE,
    /buildSimulatedGuestIdentity\(/,
    'the fabricated-guest identity builder is gone; the ?as=replied preview cannot work.',
  );
});
