'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

/** How long a form waits after the last change before it drafts it. */
export const DRAFT_AS_YOU_GO_MS = 600;

/** What the form would post — its text fields, in order (files are never in a Look form). */
function snapshot(form: HTMLFormElement): string {
  return JSON.stringify([...new FormData(form)].filter(([, v]) => typeof v === 'string'));
}

/**
 * ✍ A LOOK FORM DRAFTS ITSELF — NO SAVE BUTTON (owner, live iPhone test
 * 2026-10-05; INTERACTION_RULES §8: live preview, saves to the DRAFT, Apply
 * publishes). Drawn inside a `<form>` that carries `<HubDraftField />`: a
 * change to what the form would post is sent, after a short pause, through the
 * form's OWN action (`requestSubmit`) — the same door its Save button used, so
 * the page redraws with it and the ✓ Apply count rises. Nothing new on the
 * server.
 *
 * 🔒 OPENING NEVER WRITES. The form is compared with what it held when it was
 * drawn; only a difference the couple made is sent. A tap anywhere (a dropdown's
 * list is drawn outside the form, in a portal) only asks the question — "has
 * this form changed?" — and an unchanged form sends nothing.
 *
 * One at a time: while a draft is on its way the next one waits for it.
 */
export function DraftsAsYouGo({ delay = DRAFT_AS_YOU_GO_MS }: { delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { pending } = useFormStatus();
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    let last = snapshot(form);
    let timer: number | undefined;
    let touched = false;
    /* The first paint's own settling (a field filled by an effect) is not a change. */
    const settle = window.setTimeout(() => {
      if (!touched) last = snapshot(form);
    }, 300);
    const check = () => {
      timer = undefined;
      if (pendingRef.current) {
        timer = window.setTimeout(check, delay);
        return;
      }
      const now = snapshot(form);
      if (now === last) return;
      last = now;
      form.requestSubmit();
    };
    const poke = () => {
      touched = true;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(check, delay);
    };
    const kinds = ['click', 'change', 'input', 'keyup', 'pointerup'] as const;
    for (const k of kinds) document.addEventListener(k, poke, true);
    return () => {
      window.clearTimeout(settle);
      if (timer !== undefined) window.clearTimeout(timer);
      for (const k of kinds) document.removeEventListener(k, poke, true);
    };
  }, [delay]);

  return <span ref={ref} hidden data-drafts-as-you-go="" />;
}
