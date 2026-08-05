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
  // The two that legitimately exist do not carry the slug dispatch.
  for (const sub of ['welcome', 'find-my-table']) {
    if (existsSync(join(ROUTE, sub, 'loading.tsx'))) {
      // Fine — these routes resolve no slug-vs-vendor dispatch and cannot
      // soft-404. Asserted here so the sweep above is not read as "no loading
      // file anywhere", which would be wrong.
      assert.ok(true);
    }
  }
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
