/**
 * ⭐ A REFUSED SIGNALLING CHANNEL MUST SAY SO.
 *
 * Measured 2026-09-01, on the only live transport this platform has: a camera with
 * a healthy heartbeat, a controller with the camera bound to Channel 1, both on the
 * SAME MACHINE in the same browser — and no video, no error, nothing in the console.
 * The page read "connecting to the controller…" for as long as anyone waited.
 *
 * The cause of the SILENCE (not necessarily of the failure) was one shape:
 *
 *     .subscribe((status) => { if (status === 'SUBSCRIBED') … })
 *
 * CHANNEL_ERROR, TIMED_OUT and CLOSED were dropped on the floor. Supabase reports
 * them once and goes quiet, so a refusal and a slow connection rendered identically
 * and stayed that way. An hour went into guessing what one branch would have said.
 *
 * 🔑 THE MEASUREMENT MUST REACH THE RENDER — the same finding this codebase already
 * shipped seven PRs for in August.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSignalFailureStatus, SIGNAL_REFUSED_NOTICE } from './panood-signal-status';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

test('every terminal subscribe status is recognised as a failure', () => {
  for (const s of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
    assert.equal(isSignalFailureStatus(s), true, `${s} must be reported, not swallowed`);
  }
});

test('SUBSCRIBED is not a failure — and neither is an unknown future status', () => {
  assert.equal(isSignalFailureStatus('SUBSCRIBED'), false);
  // Deliberately an allow-list of the three terminal states: a status Supabase adds
  // later must not be guessed at as fatal and tear down a working broadcast.
  assert.equal(isSignalFailureStatus('JOINING'), false);
  assert.equal(isSignalFailureStatus(''), false);
});

test('the notice names one cause and one action, and does not blame the host', () => {
  assert.match(SIGNAL_REFUSED_NOTICE, /Setnayan/, 'it must say whose side this is on');
  assert.match(SIGNAL_REFUSED_NOTICE, /reload/i, 'it must name the one thing to try');
  assert.doesNotMatch(SIGNAL_REFUSED_NOTICE, /contact support/i);
});

/* ── The wiring. A predicate nobody calls would reproduce the defect exactly. ── */

test('⭐ the private channel is primed with the session JWT BEFORE subscribing', () => {
  // private:true makes Supabase evaluate panood_rtc_can_access on realtime.messages,
  // whose first line refuses when auth.uid() is NULL. The socket carries the anon key
  // until it is told the user's token, so without this both ends are refused.
  const src = repoFile('lib/panood-webrtc.ts');
  assert.match(src, /supabase\.realtime\.setAuth\(token\)/, 'the socket must be given the JWT');
  assert.equal(
    (src.match(/primeRealtimeAuth\(supabase\)\.then\(/g) ?? []).length,
    2,
    'BOTH the publisher and the viewer must prime before subscribe — one alone still fails',
  );
});

test('⭐ neither side drops a non-SUBSCRIBED status on the floor', () => {
  const src = repoFile('lib/panood-webrtc.ts');
  assert.equal(
    (src.match(/isSignalFailureStatus\(status\)/g) ?? []).length,
    2,
    'publisher and viewer must each report a refusal',
  );
});

test('⭐ the camera operator SEES the refusal — a log never changed a pixel', () => {
  const ui = repoFile('app/panood/cam/[token]/_components/panood-camera-publish.tsx');
  assert.match(ui, /onSignalRefused/, 'the page must subscribe to the refusal');
  assert.match(ui, /SIGNAL_REFUSED_NOTICE/, 'and it must render it, not only log it');
  assert.match(
    ui,
    /signalRefused[\s\S]{0,80}connecting to the controller/,
    'the refusal must PRE-EMPT the forever-optimistic "connecting…" copy',
  );
});
