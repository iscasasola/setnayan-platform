'use client';

/**
 * SupplierToast — THE OUTCOME OF AN ANSWER (supplier redesign S-PR1, corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Outcome notices — Keep
 * as a toast, not a tile"), DRAWN BY THE SHARED TOAST (2026-10-12 look audit).
 *
 * A supplier answers on the page (Agree · Move · Unlock · "it never arrived")
 * and the action redirects back with its status in the query string. The
 * outcome is said twice, in the two places the templates give a message
 * (`INTERACTION_RULES.md` § 9 kind 12 — toast · status line):
 *
 *   · THE TOAST — `PeekToast`, the one drawing (`app/_components/toast/
 *     peek-toast.tsx`): it peeks down from the TOP, terracotta with ✓ for a
 *     good result, dark red with a warning mark for a failure, white for a
 *     nothing-changed note, and leaves by itself. It says the outcome's FIRST
 *     sentence — the pill holds two lines, and these sentences run longer. A
 *     failure the supplier can simply press again ("That did not go through")
 *     carries **Try again**, which brings the page back with the answer on it.
 *     It was a dark pill at the BOTTOM for 8 s, drawn here (look audit
 *     2026-10-12: "use the shared top toast").
 *   · THE STATUS LINE — the WHOLE sentence, at the top of the column, in the
 *     page itself: "the lasting copy of a failure is the status line on the
 *     page" (§ 9). It is drawn by the server, so it is there with JavaScript
 *     off and before hydration, and it stays until the supplier leaves. Words
 *     only — nothing to press — so the Next card is still the first tap.
 *
 * 🔴 A REFUSAL IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT NEVER HAPPENED —
 * which is why the status line never leaves by itself, whatever the toast does.
 *
 * Loaded only by the supplier's Today (and its dev lab).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { PeekToast, type PeekToastTone } from '@/app/_components/toast/peek-toast';

export type SupplierOutcomeTone = PeekToastTone;

/** The toast's words: the outcome's first sentence (the whole of it when it has one). */
export function toastWords(text: string): string {
  const first = text.match(/^.*?[.!?](?=\s|$)/)?.[0];
  return (first ?? text).trim();
}

export function SupplierToast({
  text,
  tone,
  retry = false,
}: {
  /** The outcome, in the shipped sentence (`lockAgreeNotice`, `DATE_ANSWER_NOTICE`, the deposit answers). */
  text: string;
  /** ok = it happened · note = nothing changed · bad = it was refused or failed. */
  tone: SupplierOutcomeTone;
  /** The press can simply be made again — the toast carries "Try again". */
  retry?: boolean;
}) {
  // The toast is a client thing: drawn once mounted (portalled to <body> — a transform on an ancestor would pin a
  // `fixed` child to it), so the server's markup holds only the status line.
  const [showing, setShowing] = useState(false);
  useEffect(() => setShowing(true), [text, tone]);

  return (
    <>
      <p
        role="status"
        data-supplier-outcome={tone}
        className={`mb-3 flex items-start gap-2 text-[13px] leading-snug ${tone === 'bad' ? 'text-[rgb(var(--color-danger))]' : 'text-ink/70'}`}
      >
        {tone === 'bad' ? <TriangleAlert aria-hidden className="mt-px h-4 w-4 flex-none" strokeWidth={2.2} /> : null}
        <span>{text}</span>
      </p>
      {showing
        ? createPortal(
            <PeekToast
              tone={tone}
              data="supplier-outcome"
              onGone={() => setShowing(false)}
              onRetry={
                tone === 'bad' && retry
                  ? () => {
                      setShowing(false);
                      // The same page without the outcome: the answer is back on it, ready to press again.
                      window.location.replace('/vendor-dashboard');
                    }
                  : undefined
              }
            >
              {toastWords(text)}
            </PeekToast>,
            document.body,
          )
        : null}
    </>
  );
}
