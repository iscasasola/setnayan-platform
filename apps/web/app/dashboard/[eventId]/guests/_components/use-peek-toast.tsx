'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PeekToast, type PeekToastTone } from '@/app/_components/toast/peek-toast';

/**
 * usePeekToast — THE GUEST LIST'S WAY OF SAYING WHAT HAPPENED, WITH THE APPROVED TOAST.
 *
 * Owner 2026-10-08 (kind 12 "Messages"): a notification peeks down from the TOP. The guest list used to call the
 * older app-wide `useToast()` (a bordered row at the BOTTOM); each of its call sites now holds ONE message and draws
 * `<PeekToast>` — the same words, the same three results (`success` → the accent with a ✓ · `error` → the darkened
 * danger with a warning mark · `info` → a note). The app-wide provider is NOT moved; only these call sites are.
 *
 *   const [toast, toastNode] = usePeekToast();
 *   toast.error(res.error);   …   return (<>… {toastNode}</>);
 *
 * `toast` is stable (safe in a dependency list). A new message is a new toast with its own life (the `key`), and the
 * toast is drawn on <body> — the dashboard page wraps its content in a transformed box, inside which `position: fixed`
 * is not the screen (house rule, 2026-09).
 *
 * No request, no timer but the toast's own leaving.
 */
export type PeekSay = {
  success: (words: string) => void;
  error: (words: string) => void;
  info: (words: string) => void;
};

export function usePeekToast(): [PeekSay, ReactNode] {
  const [now, setNow] = useState<{ n: number; tone: PeekToastTone; words: string } | null>(null);
  const seq = useRef(0);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  const say = useCallback((tone: PeekToastTone, words: string) => {
    seq.current += 1;
    setNow({ n: seq.current, tone, words });
  }, []);
  const toast = useMemo<PeekSay>(
    () => ({ success: (w) => say('ok', w), error: (w) => say('bad', w), info: (w) => say('note', w) }),
    [say],
  );
  const node =
    now && body
      ? createPortal(
          <PeekToast key={now.n} tone={now.tone} data="guests" onGone={() => setNow((t) => (t?.n === now.n ? null : t))}>
            {now.words}
          </PeekToast>,
          body,
        )
      : null;
  return [toast, node];
}
