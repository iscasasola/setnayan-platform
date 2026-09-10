/**
 * A FAILED RENDER LOOKS LIKE A FAILURE, ON THE BOX (MB8).
 *
 * This is the guard MB8 exists to leave behind. The defect it watches for is
 * the one this repo keeps burying: a failure that renders identically to
 * success or to emptiness. An upload that stopped and fired no event, so the
 * chip sat at 0% forever and "still working" looked exactly like "dead". A
 * refused guest read that returned `[]`, so a couple with 180 names was told
 * "No guests yet". Both had error handling. Neither reached a pixel.
 *
 * 🔑 THE LESSON, VERBATIM FROM THE HANDOFF: **A LOG LINE NEVER CHANGED A
 * PIXEL.** The guest error was already bound and already in Sentry, and the
 * couple was still told their wedding was empty. So a test that only proves
 * "the failure is captured" would pass on the broken version. These prove the
 * failure is CAPTURED, TURNED INTO WORDS, and PRINTED.
 *
 * ── FOUR LAYERS, BECAUSE ANY ONE OF THEM ALONE PASSES ON A BROKEN BUILD ───
 *   1. every provider failure code has couple-facing copy (exhaustive by TYPE)
 *   2. `buildTileViewModel` surfaces `failure` exactly when the state has one
 *   3. the component INTERPOLATES `failure.headline` and `failure.detail` into
 *      JSX — not merely destructures them
 *   4. the failure OVERLAY is mounted on BOTH surfaces (tile + gallery), and
 *      the count is asserted, because a file-level match cannot say WHICH
 *      component still has it. Sabotage on this repo has landed 2 → 1 and
 *      stayed green.
 *
 * ── AND THE MONEY HALF ────────────────────────────────────────────────────
 *   5. every failure message tells the couple the credit came back — which is
 *      a true statement only because `moodboard_fail_render` refunds in the
 *      same transaction that records the failure (proven separately in
 *      tests/db/a-render-and-its-debit-are-one-transaction.db.test.ts).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTileViewModel, EMPTY_PART_STATE } from './moodboard-make-it-real';
import { RENDER_FAILURE_COPY, renderFailureCopy, isStalledRender, RENDER_STALL_AFTER_MS } from './moodboard-render-failure';
import { stripComments } from './strip-comments';

const WEB_DIR = process.cwd();
const MAKE_IT_REAL_COMPONENT = join(
  WEB_DIR,
  'app/dashboard/[eventId]/studio/mood-board/_components/make-it-real.tsx',
);
const RENDER_ACTIONS = join(
  WEB_DIR,
  'app/dashboard/[eventId]/studio/mood-board/render-actions.ts',
);
const PROVIDER = join(WEB_DIR, 'lib/gemini-image.ts');

/**
 * Comments out, before any assertion about CODE SHAPE.
 *
 * 🪤 EARNED TWICE IN ONE SESSION. The "no empty catch" assertion below first
 * went red against the phrase `catch {}` written in `render-actions.ts`'s own
 * docblock — explaining that it has no empty catch. And the refused-read guard
 * below first aimed at a docblock rather than the `if`. A source guard that
 * reads prose is measuring the wrong thing in both directions: it can fail on
 * correct code, and it can PASS on broken code whose comments still describe
 * the behaviour that was deleted. Comments are the one part of a file that
 * keeps claiming the thing after the thing is gone.
 *
 * 🔑 AND IT USES THE SHIPPED `stripComments`, NOT A LOCAL REGEX PAIR. This
 * file first hand-rolled a two-replace version, which
 * `lint-one-comment-stripper.mjs` refuses — for a reason worth repeating: a
 * regex that strips BLOCK comments first turns a LINE comment containing
 * `video/*` into an opening comment that closes at the next real `*​/`,
 * blanking everything between. The guard then asserts against a blank and
 * PASSES. A comment stripper that quietly eats the code is the same disease
 * this whole file is about, one level up.
 */

const GATE = { ok: true, needColor: false, needPhoto: false };
const baseTile = {
  id: 'room:ceiling',
  label: 'Ceiling',
  cost: 1,
  hexes: ['#8b1e3f'],
  gate: GATE,
  briefLines: [],
  currentRevisionKey: 'v1',
};

/* ── 1. every code has words ─────────────────────────────────────────────── */

test('every provider failure code carries couple-facing copy', () => {
  // The provider's failure union, read from its source rather than re-typed —
  // a re-typed list would go stale exactly when a new code is added, which is
  // the moment this test matters.
  const src = readFileSync(PROVIDER, 'utf8');
  const unionBlock = src.slice(
    src.indexOf('export type RenderFailureCode'),
    src.indexOf('export type RenderImageResult'),
  );
  const codes = [...unionBlock.matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1]!);
  assert.ok(codes.length >= 7, `expected the provider's failure codes, found ${codes.length}`);

  for (const code of codes) {
    const copy = RENDER_FAILURE_COPY[code as keyof typeof RENDER_FAILURE_COPY];
    assert.ok(copy, `RenderFailureCode "${code}" has no entry in RENDER_FAILURE_COPY`);
    assert.ok(copy.headline.trim().length > 0, `"${code}" has an empty headline`);
    assert.ok(copy.detail.trim().length > 0, `"${code}" has an empty detail`);
  }
});

test('every failure message tells the couple the credit came back', () => {
  for (const [code, copy] of Object.entries(RENDER_FAILURE_COPY)) {
    const text = `${copy.headline} ${copy.detail}`.toLowerCase();
    assert.match(
      text,
      /credit/,
      `"${code}" never mentions the credit. A couple who cannot tell whether they were charged ` +
        `will assume they were — and moodboard_fail_render really did refund them.`,
    );
  }
});

test('failure copy states costs in credits, never pesos', () => {
  for (const [code, copy] of Object.entries(RENDER_FAILURE_COPY)) {
    assert.ok(
      !`${copy.headline}${copy.detail}`.includes('₱'),
      `"${code}" states a peso figure. Section 04 speaks in credits only.`,
    );
  }
});

test('an unrecognised code read back from the database still fails LOUDLY', () => {
  // `failure_reason` is a plain string by the time it comes back out of
  // Postgres, so this path takes untrusted input. It must never resolve to
  // silence, to an empty string, or to anything a reader could mistake for a
  // success.
  const copy = renderFailureCopy('something_nobody_wrote_yet');
  assert.ok(copy.headline.trim().length > 0);
  assert.match(`${copy.headline} ${copy.detail}`.toLowerCase(), /credit/);
  assert.match(`${copy.headline} ${copy.detail}`.toLowerCase(), /did not|nothing|stopped/);

  const nulled = renderFailureCopy(null);
  assert.ok(nulled.headline.trim().length > 0, 'a null code must still produce a real failure');
});

/* ── 2. the view model surfaces it ───────────────────────────────────────── */

test('buildTileViewModel exposes `failure` exactly when the state carries one', () => {
  const clean = buildTileViewModel({ ...baseTile, state: EMPTY_PART_STATE });
  assert.equal(clean.failure, null, 'a tile with no failure must not claim one');

  const failed = buildTileViewModel({
    ...baseTile,
    state: { ...EMPTY_PART_STATE, failure: { code: 'timeout' } },
  });
  assert.ok(failed.failure, 'a failed attempt must surface a failure on the view model');
  assert.equal(failed.failure!.headline, RENDER_FAILURE_COPY.timeout.headline);
});

test('a failed tile is NOT tagged as a photograph', () => {
  // The precise substitution this whole session guards against: a tile that
  // failed must not wear the success tag.
  const failed = buildTileViewModel({
    ...baseTile,
    state: {
      ...EMPTY_PART_STATE,
      // Even with a PREVIOUS successful render in state, the freshest fact is
      // that the latest attempt failed.
      generated: { revisionKey: 'v1', hexes: ['#8b1e3f'] },
      failure: { code: 'http_error' },
    },
  });
  assert.notEqual(failed.tag, '✦ Photoreal');
  assert.match(failed.tag, /not rendered/i);
});

test('a pending tile does not look idle, and is not tagged as done', () => {
  const pending = buildTileViewModel({
    ...baseTile,
    state: { ...EMPTY_PART_STATE, pending: true },
  });
  assert.equal(pending.pending, true);
  assert.notEqual(pending.tag, 'Free preview', 'an in-flight tile must not look untouched');
  assert.notEqual(pending.tag, '✦ Photoreal');
});

test('insufficient credits is its OWN state, not a failure', () => {
  // "Buy a pack" and "our provider broke" are different sentences. Collapsing
  // them shows a couple an error about our infrastructure when the answer is
  // that they have no credits.
  const vm = buildTileViewModel({
    ...baseTile,
    state: { ...EMPTY_PART_STATE, insufficient: true },
  });
  assert.equal(vm.insufficient, true);
  assert.equal(vm.failure, null, 'an unaffordable render is not a failed render');
});

test('a render with no viewing URL is not reported as a failure', () => {
  // The photograph exists and is stored; only the presigned link failed.
  // Treating that as a failure would tell a couple their photo does not exist
  // while it sits in R2 — and, worse, invite a refund of a delivered render.
  const vm = buildTileViewModel({
    ...baseTile,
    state: {
      ...EMPTY_PART_STATE,
      generated: { revisionKey: 'v1', hexes: ['#8b1e3f'], renderId: 'r1', imageUrl: null },
    },
  });
  assert.equal(vm.failure, null);
  assert.equal(vm.imageUrl, null);
  assert.equal(vm.tag, '✦ Photoreal', 'a delivered render keeps its tag without a live URL');
});

/* ── 3 + 4. it reaches the RENDER, on every surface ──────────────────────── */

test('SABOTAGE-PROVED GUARD: make-it-real.tsx PRINTS the failure, not merely reads it', () => {
  const src = stripComments(readFileSync(MAKE_IT_REAL_COMPONENT, 'utf8'));

  // Interpolated into JSX. A destructure-and-drop would satisfy a bare-name
  // match, which is why the bare-name match is not what is asserted.
  assert.match(
    src,
    /\{vm\.failure\.headline\}/,
    'the tile must interpolate vm.failure.headline into its output',
  );
  assert.match(
    src,
    /\{vm\.failure\.detail\}/,
    'the tile must interpolate vm.failure.detail — a headline alone does not say what to do',
  );
});

test('SABOTAGE-PROVED GUARD: the failure overlay is mounted on BOTH surfaces, and the count says so', () => {
  // Comments stripped: a docblock naming the attribute would inflate the count
  // and keep this green through the deletion of a real overlay.
  const src = stripComments(readFileSync(MAKE_IT_REAL_COMPONENT, 'utf8'));
  const mounts = [...src.matchAll(/data-render-failure/g)].length;

  // 🔑 THE COUNT IS THE ASSERTION. A bare `assert.match(src, /data-render-
  // failure/)` passes with one of the three deleted — this repo has watched a
  // sabotage land 2 → 1 and stay green, because a file-level match cannot say
  // WHICH component still carries the thing.
  //
  // Three, deliberately:
  //   · the tile's failed overlay
  //   · the gallery's STALLED overlay (the killed-process case)
  //   · the gallery's FAILED overlay (read back from the database)
  // If a surface is legitimately added or removed, update this number and say
  // why in the commit — never widen it to `>= 1`, which is the same as having
  // no count at all.
  assert.equal(
    mounts,
    3,
    `expected 3 data-render-failure overlays in make-it-real.tsx (tile · gallery-stalled · ` +
      `gallery-failed), found ${mounts}. A missing one is a surface where a failed render ` +
      `renders as something else.`,
  );
});

test('SABOTAGE-PROVED GUARD: the gallery distinguishes a REFUSED read from an empty one', () => {
  const src = stripComments(readFileSync(MAKE_IT_REAL_COMPONENT, 'utf8'));

  // 🪤 ANCHORED ON THE `if`, NOT ON THE BARE PHRASE. The first occurrence of
  // `renders === null` in this file is inside RenderGallery's own docblock
  // explaining the rule — a window opened there faces prose, not code, and
  // would pass on a component whose actual branch had been deleted. (This
  // guard failed exactly that way on its first run, which is the only reason
  // it is written this way.)
  const branch = /if \(renders === null\)/.exec(src);
  assert.ok(
    branch,
    'the gallery must branch on a null (refused) read before checking for length',
  );
  const fromBranch = src.slice(branch!.index);
  const emptyIdx = fromBranch.indexOf('renders.length === 0');
  assert.ok(emptyIdx > 0, 'the empty case must be reachable and distinct from the refused one');
  assert.match(
    fromBranch.slice(0, emptyIdx),
    /couldn&rsquo;t|could not|not the same as having none/i,
    'a refused read must say it FAILED — never render the "no renders yet" copy',
  );
});

/* ── 5. the action can never exit without one of three outcomes ──────────── */

test('SABOTAGE-PROVED GUARD: every exit from requestRender is rendered, and the failure path refunds', () => {
  const src = stripComments(readFileSync(RENDER_ACTIONS, 'utf8'));

  // The refund is the same call that records the failure — that is what makes
  // "your credit is back" a true sentence rather than a hope.
  assert.match(
    src,
    /moodboard_fail_render/,
    'the failure path must call moodboard_fail_render, which refunds and records together',
  );

  // Every `status: 'failed'` must carry a code, or the tile has nothing to
  // print and falls back to looking untouched.
  // `\bcode\b`, not `code:` — the shared `fail` helper returns the shorthand
  // `{ status: 'failed' as const, code, renderId }`, and a `code:`-only regex
  // reported that correct exit as codeless. A guard that cries wolf on the
  // right code gets widened by the next reader until it says nothing.
  const failedReturns = [...src.matchAll(/status:\s*'failed'/g)].length;
  const codedReturns = [...src.matchAll(/status:\s*'failed'[^}]*\bcode\b/g)].length;
  assert.ok(failedReturns > 0, 'the action must have a failure exit at all');
  assert.equal(
    codedReturns,
    failedReturns,
    `${failedReturns - codedReturns} of ${failedReturns} failure exits carry no code. ` +
      `A codeless failure prints nothing and the tile looks untouched.`,
  );

  // 🪤 AND NO BARE SWALLOW. A `catch {}` with an empty body in this file is the
  // literal mechanism of the disease — it turns a failure into a no-op that
  // renders as whatever was already on screen.
  assert.ok(
    !/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(src),
    'render-actions.ts must not contain an empty catch block — that is a silent failure by construction',
  );
});

/* ── the stall fence: the one failure nobody is left to report ───────────── */

test('an in-flight render past the stall window reads as stalled, not as working', () => {
  const now = Date.parse('2026-09-03T12:00:00Z');
  const fresh = {
    image_key: null,
    failed_at: null,
    created_at: new Date(now - 30_000).toISOString(),
  };
  const old = {
    image_key: null,
    failed_at: null,
    created_at: new Date(now - RENDER_STALL_AFTER_MS - 1000).toISOString(),
  };
  assert.equal(isStalledRender(fresh, now), false, 'a render still inside the window is working');
  assert.equal(
    isStalledRender(old, now),
    true,
    'an in-flight row past the window must read as stalled — otherwise the tile spins forever, ' +
      'which is the stuck upload chip verbatim',
  );

  // A delivered or already-failed render is never "stalled".
  assert.equal(isStalledRender({ ...old, image_key: 'renders/x.png' }, now), false);
  assert.equal(isStalledRender({ ...old, failed_at: new Date(now).toISOString() }, now), false);
});

test('the stall window is longer than the provider deadline', () => {
  // Otherwise a render that is genuinely still working gets called stalled,
  // and the couple is offered a refund for a photograph about to arrive.
  const providerSrc = readFileSync(PROVIDER, 'utf8');
  const m = /timeoutMs\s*\?\?\s*([\d_]+)/.exec(providerSrc);
  assert.ok(m, 'could not find the provider deadline in gemini-image.ts');
  const deadlineMs = Number(m![1]!.replace(/_/g, ''));
  assert.ok(
    RENDER_STALL_AFTER_MS > deadlineMs,
    `RENDER_STALL_AFTER_MS (${RENDER_STALL_AFTER_MS}) must exceed the provider deadline (${deadlineMs})`,
  );
});
