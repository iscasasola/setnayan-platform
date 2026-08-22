/**
 * A CHALLENGE ANSWER REACHES THE PUBLIC STORY ONLY IF FOUR SEPARATE PEOPLE-
 * FACING QUESTIONS WERE ALL ANSWERED YES.
 *
 * Owner, 2026-08-21: challenge answers *"have their own column"* on the story.
 * That column is a PUBLIC web page carrying video of somebody's guests, so the
 * interesting assertions here are all NEGATIVES.
 *
 * ── WHY FOUR GATES AND NOT ONE FLAG ─────────────────────────────────────────
 * They are four different questions and a guest can answer them differently:
 *   1. `consent_to_share` — "share this ANSWER", ticked on the answer itself.
 *   2. `consent_to_public` — "my captures may be public at all", asked once.
 *   3. the capture is screened `clean` and not hidden.
 *   4. the guest has not opted out of photos for this event.
 *
 * 🔑 GATE 1 ALONE IS THE TEMPTING SHORTCUT AND IT IS WRONG. A guest who ticks
 * "share this" on a greeting has agreed the COUPLE may see it. They have not
 * agreed that a page anybody can open may carry their face. Collapsing the two
 * would be indistinguishable from working, on every event that has ever existed
 * so far, because production holds ZERO answers.
 *
 * ── WHAT THIS FILE CAN AND CANNOT DO ────────────────────────────────────────
 * `loadEditorialData` needs a live database, so this tests the PREDICATE the
 * loader is built from, mirrored here. That is weaker than calling the loader,
 * and it is said out loud rather than implied: `admits()` below must stay in
 * step with the query in `data.ts` by hand.
 * ⚠ THE HONEST GUARD AGAINST THAT DRIFT IS THE SHAPE OF THE QUERY ITSELF — it
 * filters in SQL AND again in memory, so losing one still leaves the other.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { isPublicSafeModerationState } from '@/lib/public-media-visibility';
import { publicKeyForCapture, type ConsentVeto } from './consent-veto';

type Answer = {
  consentToShare: boolean;
  consentToPublic: boolean;
  moderationState: string | null;
  hiddenAt: string | null;
  captureId: string;
  mediaKey: string | null;
};

const clean = (over: Partial<Answer> = {}): Answer => ({
  consentToShare: true,
  consentToPublic: true,
  moderationState: 'clean',
  hiddenAt: null,
  captureId: 'cap-1',
  mediaKey: 'r2://media/cap-1.mp4',
  ...over,
});

const noVeto = (): ConsentVeto => ({ ids: new Set(), safeKeyById: new Map(), failed: false });

/** The loader's predicate, mirrored. See the docblock on why this is honest. */
function admits(a: Answer, veto: ConsentVeto = noVeto()): boolean {
  if (!a.consentToShare) return false;
  if (!a.consentToPublic) return false;
  if (a.hiddenAt !== null) return false;
  if (!isPublicSafeModerationState(a.moderationState)) return false;
  return publicKeyForCapture(veto, a.captureId, a.mediaKey) !== null;
}

test('an answer with all four yeses is published', () => {
  assert.equal(admits(clean()), true);
});

test('no answer-level consent → refused', () => {
  assert.equal(admits(clean({ consentToShare: false })), false);
});

test('no public consent → refused, even though they shared the answer', () => {
  // 🔑 THE ONE THAT LOOKS REDUNDANT AND IS NOT. Agreeing the couple may see your
  // greeting is not agreeing a public page may carry it.
  assert.equal(admits(clean({ consentToPublic: true, consentToShare: true })), true);
  assert.equal(admits(clean({ consentToPublic: false })), false);
});

test('an unscreened or blocked capture → refused', () => {
  // Fail-CLOSED on every value that is not exactly 'clean' — including NULL and
  // 'unscreened', which is what a capture the NSFW screen never ran on looks
  // like. A blocklist here would publish the states nobody thought of.
  for (const state of [null, 'unscreened', 'nsfw_blocked', 'pending', 'withdrawn', '']) {
    assert.equal(admits(clean({ moderationState: state })), false, `state ${String(state)} was admitted`);
  }
});

test('a hidden capture → refused', () => {
  assert.equal(admits(clean({ hiddenAt: '2026-08-21T10:00:00Z' })), false);
});

test('a guest who opted out of photos → refused, even with every other yes', () => {
  const veto: ConsentVeto = { ids: new Set(['cap-1']), safeKeyById: new Map(), failed: false };
  assert.equal(admits(clean(), veto), false);
});

test('a veto that could not be READ refuses everything', () => {
  // ⚠ `failed: true` means we could not find out who opted out. Publishing on
  // an unreadable veto is publishing on an assumption about consent.
  assert.equal(admits(clean(), { ids: new Set(), safeKeyById: new Map(), failed: true }), false);
});

test('an answer with no media key → refused, never a broken tile', () => {
  assert.equal(admits(clean({ mediaKey: null })), false);
});

test('every single gate is load-bearing on its own', () => {
  // Turn exactly one thing off at a time. If any of these passes, that gate is
  // decoration and the other three are carrying it.
  const off: Array<[string, Answer]> = [
    ['answer consent', clean({ consentToShare: false })],
    ['public consent', clean({ consentToPublic: false })],
    ['moderation', clean({ moderationState: 'unscreened' })],
    ['hidden', clean({ hiddenAt: 'now' })],
    ['media key', clean({ mediaKey: null })],
  ];
  for (const [name, a] of off) {
    assert.equal(admits(a), false, `${name} is not actually gating anything`);
  }
});

// ── The mirror above is only honest if the loader really carries these ──────

test('the loader query carries all four gates — the mirror is not the only copy', () => {
  // 🔑 THE WEAKNESS THIS CLOSES. Every assertion above tests a MIRROR of the
  // loader's predicate. If somebody loosened the real query, the mirror would
  // still pass and this file would go on reporting that consent is enforced.
  //
  // So: read the loader's source and require each gate to be present IN THE
  // QUERY CHAIN, not merely somewhere in a 3,000-line file. Comments are
  // stripped first — this repo has shipped a guard that a docblock satisfied.
  const src = readFileSync(fileURLToPath(new URL('./data.ts', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const start = src.indexOf("from('papic_mission_completions')");
  assert.ok(start !== -1, 'the challenge-answers loader is gone entirely');
  // The whole loader, bounded by the next table it reads after the captures.
  const chain = src.slice(start, start + 3000);

  for (const gate of [
    "eq('consent_to_share', true)",     // 1 · this answer may be shared
    "eq('consent_to_public', true)",    // 2 · this guest's captures may be public
    "is('hidden_at', null)",            // 3a · not hidden
    'PUBLIC_SAFE_MODERATION_STATE',     // 3b · screened clean
    'publicKeyForCapture',              // 4 · the per-guest opt-out veto
    'filterPublicSafeRows',             // 3b again, in memory — belt and braces
  ]) {
    assert.ok(chain.includes(gate), `the loader no longer applies: ${gate}`);
  }
});
