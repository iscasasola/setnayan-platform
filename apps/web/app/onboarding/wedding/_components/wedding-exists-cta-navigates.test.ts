/**
 * wedding-exists-cta-navigates.test.ts — a source-level guard against the
 * one-wedding-at-a-time dead end (owner report 2026-09-11, screenshot).
 *
 * THE BUG: an account that already has a wedding in planning sees the
 * summary card + "You already have a wedding in planning…" beside a button
 * labelled "Go to my dashboard". Pressing it did NOTHING useful — on the
 * terminal screen that button is the commit CTA (`handleFinish`), the server
 * answers `wedding_exists` again, and the CTA stayed wired to the SAME commit
 * call forever. Same class of dead end in the generic (non-wedding)
 * onboarding at `apps/web/app/onboarding/[type]/_components/generic-onboarding.tsx`
 * when the event type has no honoree field to disambiguate with.
 *
 * THE FIX: once either flow learns (from the server) that the account
 * already has one in planning, every "finish" CTA must NAVIGATE — never
 * re-commit. This is a SOURCE-LEVEL guard, not a rendered-DOM test: it
 * asserts the state exists, that the commit callback checks it and returns
 * BEFORE calling the commit server action, and that the check's own block
 * navigates. It cannot prove a browser click works, but it proves the CTA
 * is not silently re-wired back onto the same dead end by a future edit.
 *
 * ⚠ Strip comments before matching — a hand-rolled comment strip is banned
 * repo-wide (one comment stripper: lib/strip-comments.ts) because a naive
 * regex blanks real code and can hide a violation instead of catching one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEDDING_SHELL = join(HERE, 'onboarding-shell.tsx');
const GENERIC_ONBOARDING = join(
  HERE,
  '..',
  '..',
  '[type]',
  '_components',
  'generic-onboarding.tsx',
);

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

/**
 * Slice out ONE `if (...) { ... }` block by its condition and the indent of
 * its closing brace — narrower than "start of guard to start of commit
 * call", which would silently swallow unrelated sibling branches (e.g. the
 * `committedEventId` branch, which legitimately DOES clear the draft) and
 * make an assertion pass or fail for the wrong reason.
 */
function extractIfBlock(src: string, conditionPattern: RegExp, closeIndent: string): string {
  const startMatch = conditionPattern.exec(src);
  assert.ok(startMatch, `block not found: ${conditionPattern}`);
  const start = startMatch!.index;
  const closeRe = new RegExp(`\\n${closeIndent}\\}`);
  const rest = src.slice(start);
  const closeMatch = closeRe.exec(rest);
  assert.ok(closeMatch, `closing brace (indent ${JSON.stringify(closeIndent)}) not found for: ${conditionPattern}`);
  return rest.slice(0, closeMatch!.index + closeMatch![0].length);
}

test('the anchor: both onboarding surfaces exist and are not stubs', () => {
  for (const p of [WEDDING_SHELL, GENERIC_ONBOARDING]) {
    assert.ok(
      existsSync(p) && readFileSync(p, 'utf8').length > 1000,
      `${p} is missing or a stub — every assertion below would pass vacuously`,
    );
  }
});

test('wedding onboarding: handleFinish checks weddingExists and returns BEFORE re-committing', () => {
  const src = read(WEDDING_SHELL);

  // The refusal must be remembered in state.
  assert.match(
    src,
    /const \[weddingExists, setWeddingExists\]\s*=\s*useState/,
    'onboarding-shell.tsx must hold a weddingExists state — without it there is nowhere ' +
      'to remember the wedding_exists refusal across a second tap of the CTA',
  );

  // The wedding_exists branch of the commit response must set it.
  assert.match(
    src,
    /res\.error === 'wedding_exists'[\s\S]{0,900}?setWeddingExists\(/,
    'the wedding_exists branch must call setWeddingExists — otherwise the CTA never learns ' +
      'the account is blocked and keeps re-committing',
  );

  // Isolate handleFinish's body.
  const fn = /const handleFinish = useCallback\(async[\s\S]*?\n {2}\}, \[[^\]]*\]\);/.exec(src);
  assert.ok(fn, 'handleFinish should exist as a useCallback');
  const body = fn![0];

  const guardIdx = body.search(/if \(weddingExists\) \{/);
  const commitIdx = body.indexOf('commitOnboardingWedding(');
  assert.ok(guardIdx >= 0, 'handleFinish must check `if (weddingExists)`');
  assert.ok(commitIdx >= 0, 'handleFinish must still call commitOnboardingWedding on the ' +
    'first attempt — this guard is about ORDER, not removal');
  assert.ok(
    guardIdx < commitIdx,
    'the weddingExists check must run BEFORE commitOnboardingWedding is called — otherwise ' +
      'a second tap of the CTA still re-commits and re-hits wedding_exists forever',
  );

  // The guard block itself (just the `if (weddingExists) { … }`, nothing
  // past its own closing brace) must navigate, and must return.
  const guardBlock = extractIfBlock(body, /if \(weddingExists\) \{/, '    ');
  assert.match(
    guardBlock,
    /return;/,
    'the weddingExists branch must return — falling through would still reach the commit call',
  );
  assert.match(
    guardBlock,
    /router\.push\(dest\)|window\.location\.assign\(dest\)/,
    'the weddingExists branch must actually navigate (router.push / hard-nav fallback) — ' +
      'remembering the block and doing nothing is the same dead end with extra steps',
  );

  // weddingExists must be a real dependency of the callback, or the check
  // above can run against a stale closure that never sees the update.
  assert.match(
    src,
    /\}, \[committedEventId, state, buildCommitPayload, router, goToId, nextPath, servicesSelection, weddingExists\]\);/,
    'weddingExists must be in the handleFinish dependency array',
  );
});

test('wedding onboarding: the draft is not cleared on the weddingExists path', () => {
  const src = read(WEDDING_SHELL);
  const fn = /const handleFinish = useCallback\(async[\s\S]*?\n {2}\}, \[[^\]]*\]\);/.exec(src);
  const body = fn![0];
  const guardBlock = extractIfBlock(body, /if \(weddingExists\) \{/, '    ');
  assert.doesNotMatch(
    guardBlock,
    /ONBOARDING_DRAFT_KEY/,
    'the weddingExists branch must NOT touch the onboarding draft — the refusal message ' +
      'promises the couple they can come back to THIS plan after putting the other one away',
  );
});

test('generic onboarding: handleCreate checks blockedTerminal and returns BEFORE re-committing', () => {
  const src = read(GENERIC_ONBOARDING);

  assert.match(
    src,
    /const \[blockedTerminal, setBlockedTerminal\]\s*=\s*useState/,
    'generic-onboarding.tsx must hold a blockedTerminal state for the no-honoree-screen ' +
      'life_event_exists dead end',
  );

  assert.match(
    src,
    /idx >= 0[\s\S]{0,50}\{[\s\S]{0,200}\} else \{[\s\S]{0,600}?setBlockedTerminal\(true\)/,
    'the life_event_exists branch must set blockedTerminal(true) when there is no honoree ' +
      'screen to route back to',
  );

  const fn = /async function handleCreate\(\) \{[\s\S]*?\n {2}\}/.exec(src);
  assert.ok(fn, 'handleCreate should exist');
  const body = fn![0];

  const guardIdx = body.search(/if \(blockedTerminal && blockedBy\) \{/);
  const commitIdx = body.indexOf('commitOnboardingEvent(');
  assert.ok(guardIdx >= 0, 'handleCreate must check `if (blockedTerminal && blockedBy)`');
  assert.ok(commitIdx >= 0, 'handleCreate must still call commitOnboardingEvent on the first attempt');
  assert.ok(
    guardIdx < commitIdx,
    'the blockedTerminal check must run BEFORE commitOnboardingEvent is called',
  );

  const guardBlock = extractIfBlock(body, /if \(blockedTerminal && blockedBy\) \{/, '    ');
  assert.match(guardBlock, /return;/, 'the blockedTerminal branch must return early');
  assert.match(
    guardBlock,
    /router\.push\(`\/dashboard\/\$\{blockedBy\.eventId\}`\)/,
    'the blockedTerminal branch must navigate to the blocking event’s dashboard',
  );
});
