/**
 * first-byte.test.ts — a guest must see something while the server works.
 *
 * There was no loading or streaming boundary anywhere under `app/[slug]` — no
 * root `loading.tsx`, no ancestor one, and zero `Suspense` in the whole tree —
 * while the page runs a dozen-plus sequential awaits, several of them R2
 * presign round-trips, before it can render. With no boundary the entire page
 * is React's shell, so not one byte flushes until the last await resolves.
 *
 * A guest scanning the QR on a crowded venue network got a BLANK WHITE SCREEN:
 * no monogram, no couple's name, not even a spinner, for as long as the server
 * took. Most people tap again, or decide the link is broken. This is the first
 * thing the product does at a wedding and it did nothing at all.
 *
 * ⛔ THE FIX IS NOT A `loading.tsx`, AND THIS FILE EXISTS TO STOP THE NEXT
 * PERSON REACHING FOR ONE. A route-level loading file makes the streaming shell
 * commit HTTP 200 before the body runs, so a notFound() thrown in the body
 * renders the 404 UI with a 200 status — every junk top-level URL an indexable
 * soft-404. One existed here and was deliberately deleted (04c03063d, "real
 * 404s on unknown slugs"). The boundary therefore goes INSIDE page.tsx, AFTER
 * every notFound()/redirect, where the status is already settled.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(HERE, '..');
const PAGE = readFileSync(join(ROUTE, 'page.tsx'), 'utf8');
// The legacy vendor microsite. It is the SAME shop the bare-root dispatcher
// serves — app/[slug]/page.tsx imports renderVendorBySlug straight out of it —
// so the rule this file exists to hold has always applied to both, and was
// only ever enforced on one.
const VENDOR_ROUTE = join(ROUTE, '..', 'v', '[slug]');

test('the invitation flushes something before the slow work', () => {
  assert.match(PAGE, /<Suspense/, 'The streaming boundary is gone — the page is one blocking shell again.');
  assert.match(
    PAGE,
    /fallback=\{\s*<InvitationSkeleton/,
    'The boundary has no fallback, so the guest is back to a blank screen.',
  );
});

test('the boundary sits AFTER the routing decisions, so a bad slug is still a real 404', () => {
  const suspenseAt = PAGE.indexOf('<Suspense');
  assert.notEqual(suspenseAt, -1);
  const afterBoundary = PAGE.slice(suspenseAt);

  // Every status-setting call must already have happened. If one moves below
  // the boundary, the shell has flushed a 200 before it runs and the 404 is a
  // soft-404 — invisible to a person, and exactly what 04c03063d fixed.
  for (const call of ['notFound()', 'redirect(']) {
    const inBody = afterBoundary.includes(`\n  ${call}`) || afterBoundary.includes(`  if (!slug`);
    assert.ok(
      !inBody,
      `A top-level \`${call}\` now sits below the Suspense boundary. The HTTP ` +
        `status must be settled before the first flush, or every unknown slug ` +
        `becomes an indexable 200 that merely looks like a 404.`,
    );
  }
});

test('no route-level loading.tsx comes back', () => {
  // The named reason, not a style preference: a loading file commits the 200.
  for (const sub of ['', 'hub']) {
    const f = join(ROUTE, sub, 'loading.tsx');
    assert.ok(
      !existsSync(f),
      `${sub || '[slug]'}/loading.tsx is back. It makes the streaming shell ` +
        `commit HTTP 200 before the body runs, so every junk URL becomes an ` +
        `indexable soft-404 — the exact bug 04c03063d deleted it to fix. Put ` +
        `the boundary inside page.tsx, after the routing decisions, instead.`,
    );
  }
  // 🚨 THESE TWO WERE EXEMPTED, AND THE EXEMPTION'S REASON WAS FALSE.
  //
  // It read: "these routes resolve no slug-vs-vendor dispatch and cannot
  // soft-404", and the body was `assert.ok(true)` — an exemption that could
  // never fail, justified by a claim nobody had measured. Both pages call
  // notFound() for an event that does not exist, and a loading.tsx commits the
  // 200 long before that line runs. The dispatch was never what caused it.
  //
  // MEASURED IN PROD 2026-08-28, not reasoned about — the same way the vendor
  // route below was caught:
  //   /definitely-not-a-real-event-xyz/find-my-table  → HTTP 200
  //   /definitely-not-a-real-event-xyz/welcome        → HTTP 200
  //   /definitely-not-a-real-event-xyz/find-seat      → HTTP 404  (no loading.tsx)
  //   /definitely-not-a-real-event-xyz/print          → HTTP 404  (no loading.tsx)
  // So every junk URL under those two paths told a crawler it had found a page.
  //
  // 🔑 A GUARD'S EXEMPTION IS A CLAIM WITH AN EXPIRY DATE. This one was written
  // when both routes were younger; `find-my-table` has since grown ten awaits
  // and three notFound() calls. Deleting the files costs a skeleton on two fast
  // lookups (no R2 presigns — the round-trips that made the invitation page
  // need streaming at all). If either ever needs one back, the boundary goes
  // INSIDE page.tsx after the routing decisions, exactly as the docblock says.
  for (const sub of ['welcome', 'find-my-table']) {
    assert.ok(
      !existsSync(join(ROUTE, sub, 'loading.tsx')),
      `${sub}/loading.tsx is back. It commits HTTP 200 before the body runs, ` +
        `so this route's notFound() calls render the 404 UI with a 200 status ` +
        `— measured in prod 2026-08-28. Put the boundary inside page.tsx, ` +
        `after every notFound(), where the status is already settled.`,
    );
  }
});

test('the legacy vendor route does not soft-404 either', () => {
  // MEASURED IN PROD 2026-08-08, not reasoned about: with a loading.tsx here,
  // https://www.setnayan.com/v/definitely-not-a-real-shop-xyz answered
  // HTTP 200 — a shop that has never existed telling Google it was found.
  // Every unapproved vendor's address did the same, because a hidden shop
  // notFound()s in page.tsx (`isPubliclyVisible`) long after the streaming
  // shell has already committed the status.
  //
  // The bare-root twin was fixed in 04c03063d and guarded above; this one was
  // missed for the same reason it is easy to miss now — the bug is invisible
  // to a person, who sees a perfectly good 404 page either way. Only a crawler
  // and a status code can tell.
  assert.ok(
    !existsSync(join(VENDOR_ROUTE, 'loading.tsx')),
    'v/[slug]/loading.tsx is back. It commits HTTP 200 before the body runs, ' +
      'so every unknown or unapproved shop URL becomes an indexable soft-404. ' +
      'The bare-root vendor path (app/[slug] → renderVendorBySlug) blocks with ' +
      'no skeleton for the same reason, so this costs no parity — put any ' +
      'boundary INSIDE page.tsx, after the notFound(), instead.',
  );
});

test('the bare-root 404 speaks to shop visitors too, not only wedding guests', () => {
  // Conditional on the thing that makes it true: app/[slug]/page.tsx falls
  // through to the vendor renderer, so a shop address that is not approved
  // yet — the resting state of EVERY unapproved vendor, per the 2026-07-27
  // owner ruling — lands on this exact not-found. The owner opened their own
  // shop address and was told to check their "invitation link" with "the
  // host". A correct 404 aimed at the wrong person reads as a broken product.
  //
  // Prose in the file was not enough to hold this: the comment explaining the
  // guest-only framing was already there and still described one audience.
  if (!/renderVendorBySlug/.test(PAGE)) return; // vendor fall-through gone → rule moot

  const NOT_FOUND = readFileSync(join(ROUTE, 'not-found.tsx'), 'utf8');
  // ⚠ SCOPE THIS TO THE RENDERED COPY, NOT THE FILE. The first draft matched
  // the whole file and could never fail: the comment block above explaining
  // WHY the shop audience matters says "shop" and "vendor" a dozen times, so
  // the assertion passed on its own justification while the visible sentence
  // could say anything at all. Caught by mutation-testing it — the sabotage
  // ran green, which is the only reason the hole showed.
  const returnAt = NOT_FOUND.indexOf('return (');
  assert.notEqual(returnAt, -1, 'not-found.tsx no longer returns JSX — rewrite this guard');
  const RENDERED = NOT_FOUND.slice(returnAt);

  const headline = RENDERED.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
  assert.notEqual(headline, '', 'no <h1> in the rendered output — rewrite this guard');
  assert.ok(
    !/invitation/i.test(headline),
    'The headline names invitations again, but this page still renders for a ' +
      'vendor shop address that has not been approved. Keep it neutral.',
  );
  assert.match(
    RENDERED,
    /business|shop|vendor/i,
    'The body no longer offers the shop-visitor a recovery path. Someone ' +
      'handed a shop link before approval must learn the page is not open ' +
      'yet, not that they mistyped a wedding invitation.',
  );
});

test('the fallback shows the couple, not a spinner', () => {
  const SKELETON = readFileSync(join(ROUTE, '_components', 'invitation-skeleton.tsx'), 'utf8');
  assert.match(
    SKELETON,
    /\{displayName\}/,
    'The skeleton stopped rendering the couple\'s name. It comes from the event ' +
      'row the page has ALREADY read to make its routing decision, so it costs ' +
      'nothing — and it is the thing that tells a guest standing at a venue they ' +
      'are in the right place. A spinner says "wait"; a name says "you found it".',
  );
  assert.match(
    SKELETON,
    /motion-safe:animate-pulse/,
    'The only movement must respect prefers-reduced-motion — this renders on the ' +
      'worst connection the product ever sees.',
  );
  assert.match(SKELETON, /role="status"/, 'the loading state must be announced, not implied by grey boxes');
  assert.match(
    SKELETON,
    /mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14/,
    'The fallback must use the same column as the real page, or the content ' +
      'jumps sideways the moment the invitation replaces it.',
  );
});
