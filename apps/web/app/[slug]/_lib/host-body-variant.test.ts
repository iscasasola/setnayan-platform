/**
 * THE COUPLE'S OWN WEDDING PAGE SPEAKS TO THEM AS THE HOSTS.
 *
 * ─── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * A signed-in host has an ACCOUNT, not a guest cookie. `app/[slug]/page.tsx`
 * branches on `if (!session)` — `session` being the guest cookie — so the couple
 * opening their own wedding falls into `renderAnonymous` and gets the STRANGER'S
 * body: "This is a Setnayan invitation page. Scan your personal QR or open the
 * link the couple sent you." Addressed to the people who SEND that link, with a
 * read-only ribbon on top saying "your event". The page contradicted itself.
 * (The ribbon went on 2026-10-15 — owner: "Remove it". The host body stays.)
 *
 * The fix (PR #4483) ships: `site-body.tsx` swaps that sentence, and the
 * "Have an invitation? → Open my invitation" card, for host copy.
 *
 * 🚨 AND IT SHIPPED WITH NO TEST AT ALL. Nothing anywhere named `viewerIsHost`
 * or either piece of host copy, so deleting the branch would have gone green —
 * a mechanism never proven reachable, which is the failure this repo has
 * recorded five times. This file is that proof, and the decision it pins is now
 * a real exported function rather than an inline expression, so it can be
 * asserted rather than merely grepped.
 *
 * ─── THE BOUNDARY IT MUST NOT CROSS ─────────────────────────────────────────
 * A host is NOT a guest. Being recognised as the host must not hand them a
 * guest session, a seat, an RSVP, or any per-guest surface — owner-ness is an
 * ADDITIVE capability orthogonal to the identity tier. The negative assertions
 * below are the load-bearing half.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  viewerIsEventHost,
  anonymousIdentity,
  OWNER_CAPABILITY_KEYS,
  type OwnerCapability,
} from './site-identity';

const hostOf = (eventId: string): OwnerCapability => ({
  capability: 'owner',
  ownerUserId: 'user-1',
  ownerEventId: eventId,
  maySiteEdit: true,
});

// ── 1 · WHO IS ADDRESSED AS THE HOST ───────────────────────────────────────

test('a verified host of THIS event is recognised', () => {
  assert.equal(viewerIsEventHost(hostOf('event-A'), 'event-A'), true);
});

test('a stranger, a guest and an anonymous visitor are NOT', () => {
  // `resolveOwnerCapability` returns null for every one of them — no account, a
  // cookie-only guest, a signed-in non-host. Null is the only shape they reach
  // this function in, and it must never be read as "host".
  assert.equal(viewerIsEventHost(null, 'event-A'), false);
});

test('🔒 a host of ANOTHER event is refused — the grant is spendable only where it was minted', () => {
  // Somebody who hosts event A opening event B is an ordinary visitor there.
  // Without this, one hosted wedding would address them as the host of every
  // wedding they can open.
  assert.equal(viewerIsEventHost(hostOf('event-A'), 'event-B'), false);
});

test('a host of a SLUGLESS event still gets the body variant — host-ness reads no URL', () => {
  // The body must never be derived from anything that also needs a slug (the old owner ribbon was null for a
  // missing slug — the strip went 2026-10-15, owner: "Remove it"). Being the host is the capability alone.
  const cap = hostOf('event-A');
  assert.equal(viewerIsEventHost(cap, 'event-A'), true, 'still the host');
});

// ── 2 · WHAT BEING THE HOST MUST NOT HAND THEM ─────────────────────────────

test('🔒 NOT PRESENT: the owner capability carries no guest name, seat or RSVP', () => {
  const cap = hostOf('event-A');
  assert.deepEqual(
    Object.keys(cap).sort(),
    [...OWNER_CAPABILITY_KEYS].sort(),
    'the owner capability grew a key — every new key is a new thing a host reads here',
  );
  for (const forbidden of ['guest', 'guests', 'guestName', 'seat', 'rsvpStatus', 'qrSvg']) {
    assert.equal(forbidden in (cap as object), false, `owner capability carries ${forbidden}`);
  }
});

test('🔒 the body a host renders is the ANONYMOUS one — guest-free by construction', () => {
  // A host takes the anonymous tier and gets owner-ness ADDED on top; they never
  // become a guest. Poison the anonymous input with real guest-shaped data and
  // assert none of it survives — on the exact identity a host is served.
  const identity = anonymousIdentity({
    reason: null,
    publicCandidCameraActive: false,
    publicAlbumHref: null,
    // Smuggled, as a careless edit might:
    guest: { full_name: 'Maria Santos', table: 'Table 4' },
    guestName: 'Maria Santos',
    rsvpStatus: 'attending',
    qrSvg: '<svg/>',
  } as unknown as Parameters<typeof anonymousIdentity>[0]);

  const serialized = JSON.stringify(identity);
  for (const secret of ['Maria Santos', 'Table 4', 'attending', '<svg/>']) {
    assert.equal(serialized.includes(secret), false, `the host's body leaked ${secret}`);
  }
  assert.equal(identity.kind, 'anonymous');
});

// ── 3 · THE CALLER, NOT JUST THE PRIMITIVE ─────────────────────────────────
//
// Everything above proves the DECISION. None of it proves the page asks it, and
// "testing the primitive is not testing the caller" is a defect this repo has
// shipped before. These read the rendered component's source, which is the same
// technique `an-invited-person-is-recognised.test.ts` uses for JSX that cannot
// be rendered in a unit test.

const SITE_BODY = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '_components', 'site-body.tsx'),
  'utf8',
);

test('the body asks the SHARED question, not a re-typed copy of it', () => {
  assert.match(
    SITE_BODY,
    /const viewerIsHost = viewerIsEventHost\(ownerCapability, event\.event_id\)/,
    'site-body re-derives host-ness instead of asking the one shared function — ' +
      'that is how two host reads drift into disagreeing.',
  );
});

test('the stranger sentence is behind the host branch, not shown to a host', () => {
  // The exact copy the couple was being shown about their own wedding.
  assert.ok(
    SITE_BODY.includes('This is a Setnayan invitation page'),
    'the stranger copy vanished — if it was deliberately reworded, update this test',
  );
  assert.match(
    SITE_BODY,
    /\{viewerIsHost \? \(/,
    'the host branch is gone; the couple is back to being told to scan their own QR',
  );
  // 2026-10-03 (owner, "too much going on"): the host's explaining paragraph
  // went; 2026-10-15 ("Remove it") the host strip above it went too. The host
  // branch draws NOTHING, so the host meets no "Get inside".
  assert.match(SITE_BODY, /\{viewerIsHost \? \([\s\S]{0,900}?\bnull\s*\) : \(/, 'the host branch draws something again');
  assert.ok(!SITE_BODY.includes('This is your event page'), 'the host’s explaining paragraph is back');
});

test('the "Have an invitation?" card is not offered to the host', () => {
  assert.match(
    SITE_BODY,
    /\{plan\.openBrowse && viewerIsHost \? \(/,
    'the host no longer gets their own Me-tab panel, so they are offered ' +
      '"Open my invitation" — a door that is not theirs.',
  );
  assert.ok(SITE_BODY.includes('You&rsquo;re the host'), 'the host panel copy is gone');
});

test('🔒 the host branch adds no control — read-only stays read-only', () => {
  // The Event Hub is a place people visit, not a control panel. Every real
  // control lives in /dashboard/[eventId]. If the host branch ever sprouts a
  // form or a mutating action, that boundary moved without a decision.
  const branch = SITE_BODY.slice(
    SITE_BODY.indexOf('{viewerIsHost ? ('),
    SITE_BODY.indexOf(') : reason === '),
  );
  assert.ok(branch.length > 0 && branch.length < 2000, 'host branch not located');
  for (const control of ['<form', '<button', 'onClick', 'action={', '<input']) {
    assert.equal(
      branch.includes(control),
      false,
      `the host body branch grew a control (${control}) — that is a different decision`,
    );
  }
});

test('being the host does not mint a guest session — it is a separate axis', () => {
  // `viewerIsEventHost` answers a question; it hands back a boolean and nothing
  // else. If it ever returns anything session-shaped, a host has been made a
  // guest and the per-guest surfaces open to them.
  const result = viewerIsEventHost(hostOf('event-A'), 'event-A');
  assert.equal(typeof result, 'boolean');
});
