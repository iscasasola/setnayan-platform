import Link from 'next/link';
import type { ReactNode } from 'react';
import { TERMS_FIELD } from '@/lib/terms-agreement';
import { TickBox } from './tick-box';

/**
 * THE GUEST'S TERMS TICK — one line, drawn once (owner 2026-09-27: the `/signup` clickwrap, `lib/terms-agreement.ts`;
 * never pre-ticked, required, one field name). The reply page's Send step and the Me tab's "Save to my account" both
 * show it, so both come from here — before, each held its own copy and the 44px fix of 2026-10-12 reached only one.
 *
 * 🔑 EVERY PRESS ON THE LINE IS 44px WITHOUT LOOKING ANY BIGGER (walk of release a5c36f4: Terms 39×18, Privacy Notice
 * 90×18, the box 20×20):
 *  - The sentence is a wrapping flex row; the two links ride ONE unbreakable group (so they never stack) and each is a
 *    44px box (`min-h-[44px]`, never padding) that hands its extra height back to a 20px line (`-my-3`, 2026-11-27) — see
 *    there. "Privacy Notice" is `whitespace-nowrap` (the two words are one press and wrap together), and `relative`
 *    lifts a link's sideways press over the text beside it, so the right edge of "Terms" opens Terms and never ticks
 *    the box. NO inline link padded up: on lines 20px apart those zones overlap when Privacy wraps under Terms
 *    (a real tap on Terms opened /privacy — batch-4 walk, 2026-10-13).
 *  - The box is the house tick (`tick-box.tsx`, shared with the reply's "They're coming"): a 20px drawing inside a
 *    44×44 press (`press` takes the extra room back, so the words sit where they sat). The input is still the one
 *    real, focusable, required checkbox — it is only larger than what is painted. Its fill is the page's paper, so a
 *    dark Event Hub no longer shows a white square (2026-10-25).
 */
export function TermsTick({ id, children }: { id?: string; children?: ReactNode }) {
  return (
    /* `data-needed-at`: a Send without the tick says "Needed to continue" right under this line, not under the
       button (the reply's walker, `rsvp-one-at-a-time.tsx` `markNeeded`). */
    <div data-needed-at="">
    <label htmlFor={id} className="flex min-h-[44px] items-start gap-3 text-sm text-ink/80">
      <TickBox press="-mx-3 -mb-3 -mt-2.5" id={id} name={TERMS_FIELD} required />
      <span className="flex flex-wrap items-center gap-x-1">
        <span>I agree to the</span>
        {/* 🔗 THE TWO LINKS ARE ONE UNBREAKABLE GROUP (owner walk 2026-11-27, MASTER-PLAN B8: "the terms links wrap with a
            gap"). Each link is a 44px box on a 20px line (`-my-3` hands the extra back), so a wrapped line no longer
            stands 44px tall and the sentence reads as one. The group never breaks, so "Privacy Notice" can never wrap
            UNDER "Terms" — the 2026-10-13 overlap (a tap on Terms opened /privacy) cannot come back. */}
        <span data-terms-links="" className="inline-flex items-center gap-x-1 whitespace-nowrap">
          <Link href="/terms" className="relative -mx-1.5 -my-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1.5 font-medium text-link underline underline-offset-2">
            Terms
          </Link>
          <span>and the</span>
          <Link href="/privacy" className="relative -mx-1.5 -my-3 inline-flex min-h-[44px] min-w-[44px] items-center whitespace-nowrap justify-center px-1.5 font-medium text-link underline underline-offset-2">
            Privacy Notice
          </Link>
        </span>
        {children ? <span className="basis-full">{children}</span> : null}
      </span>
    </label>
    </div>
  );
}
