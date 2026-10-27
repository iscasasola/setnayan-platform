'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * lib/ask-on-return.ts — "DID YOU SEND IT?" IS ASKED WHEN THE HOST COMES BACK
 * (owner 2026-10-27, DECISION_LOG "AFTER INVITE OPENS ANOTHER APP, ASK ON
 * RETURN: \"SENT\" OR \"NOT YET\""): *"when we click on invite and it jumps to a
 * different app, when we return is it better to ask if did they successfully
 * invite the person? … just answer Yes or No."*
 *
 * WHICH PRESSES ARM IT. Only the ones that LEAVE Setnayan with the message:
 * "Send in an app ▾" (opens Viber · WhatsApp · Messenger) and Copy message (the
 * host pastes it elsewhere). The phone's share sheet does NOT — it runs over the
 * page and tells us itself when an app took the message, which already stamps
 * Sent ✓ (`shareInvite` → 'shared').
 *
 * 🔑 IT ASKS ONLY IF THE HOST REALLY LEFT. Armed, then the page went to the
 * background, then it came back → ask. A copy that was never pasted anywhere
 * (the page never hid) asks nothing; the shipped "Mark as sent" stays for that,
 * and for a computer, where nothing leaves the window.
 *
 * ⏳ AN ARM GOES STALE. If the page has not hidden within `ARM_TTL_MS` of the
 * press, the host did not leave to send — a later, unrelated switch of apps must
 * not raise a question about an invitation from minutes ago.
 */

export const ARM_TTL_MS = 2 * 60 * 1000;

export type ReturnState = { armedAt: number | null; left: boolean };
export type ReturnEvent = { kind: 'arm' } | { kind: 'hidden' } | { kind: 'visible' } | { kind: 'settle' };

export const RETURN_IDLE: ReturnState = { armedAt: null, left: false };

/**
 * Pure: the next state, and whether to ask now. Ask exactly once per arm, on
 * the first return after a leave that began while the arm was fresh.
 */
export function askOnReturnStep(
  state: ReturnState,
  event: ReturnEvent,
  now: number,
): { state: ReturnState; ask: boolean } {
  switch (event.kind) {
    case 'arm':
      return { state: { armedAt: now, left: false }, ask: false };
    case 'hidden':
      if (state.armedAt !== null && now - state.armedAt <= ARM_TTL_MS) return { state: { ...state, left: true }, ask: false };
      return { state: RETURN_IDLE, ask: false };
    case 'visible':
      if (state.armedAt !== null && state.left) return { state: RETURN_IDLE, ask: true };
      return { state, ask: false };
    case 'settle':
      return { state: RETURN_IDLE, ask: false };
  }
}

/**
 * `arm()` right after a press that leaves; `asking` turns true when the host
 * comes back; `settle()` closes the question (Sent or Not yet).
 */
export function useAskOnReturn(): { arm: () => void; asking: boolean; settle: () => void } {
  const state = useRef<ReturnState>(RETURN_IDLE);
  const [asking, setAsking] = useState(false);

  const step = useCallback((event: ReturnEvent) => {
    const next = askOnReturnStep(state.current, event, Date.now());
    state.current = next.state;
    if (next.ask) setAsking(true);
  }, []);

  useEffect(() => {
    const onVis = () => step({ kind: document.visibilityState === 'hidden' ? 'hidden' : 'visible' });
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [step]);

  const arm = useCallback(() => step({ kind: 'arm' }), [step]);
  const settle = useCallback(() => {
    step({ kind: 'settle' });
    setAsking(false);
  }, [step]);

  return { arm, asking, settle };
}
