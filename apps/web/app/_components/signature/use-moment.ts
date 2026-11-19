'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * 🕯 Asks a signature moment's ONE question — "do I play now?" — exactly once per mount, before the first paint, and
 * keeps the answer for the life of the part (`lib/signature-moments.ts` holds each rule and marks the device, so the
 * next mount is told no). The server and the first client render both get `idle` — the still, finished picture — so
 * there is no hydration mismatch and a device with no storage simply never moves.
 */
export function useMoment<T>(decide: () => T | null): T | null {
  const [answer, setAnswer] = useState<T | null>(null);
  const asked = useRef(false);
  useIsoLayoutEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const a = decide();
    if (a !== null) setAnswer(a);
    // The question is asked once, with the facts the part mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return answer;
}
