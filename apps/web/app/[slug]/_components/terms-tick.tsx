import Link from 'next/link';
import type { ReactNode } from 'react';
import { TERMS_FIELD } from '@/lib/terms-agreement';

/**
 * THE GUEST'S TERMS TICK — one line, drawn once (owner 2026-09-27: the `/signup` clickwrap, `lib/terms-agreement.ts`;
 * never pre-ticked, required, one field name). The reply page's Send step and the Me tab's "Save to my account" both
 * show it, so both come from here — before, each held its own copy and the 44px fix of 2026-10-12 reached only one.
 *
 * 🔑 EVERY PRESS ON THE LINE IS 44px WITHOUT LOOKING ANY BIGGER (walk of release a5c36f4: Terms 39×18, Privacy Notice
 * 90×18, the box 20×20):
 *  - The two links are plain INLINE links. Their vertical padding does not touch the line (an inline box's padding
 *    paints and presses, it does not take room), and `px-1.5 -mx-1.5` widens "Terms" to 44px or more (35px in a fallback font, 39px in ours) with no gap in the sentence.
 *    The first fix made them `inline-flex` — which put a 44px-wide box round "Terms" ("the  Terms  and the") and made
 *    "Privacy Notice" wrap as one lump at 375px.
 *  - The box is a 20px drawing inside a 44×44 press (`-m-3` takes the extra room back, so the words sit where they
 *    sat). The input is still the one real, focusable, required checkbox — it is only larger than what is painted.
 *    Keep `>` out of these class lists: `the-guest-pathway.test.ts` finds the input by `[^>]*`.
 */
export function TermsTick({ id, children }: { id?: string; children?: ReactNode }) {
  return (
    <label htmlFor={id} className="flex min-h-[44px] items-start gap-3 text-sm text-ink/80">
      <span className="relative -mx-3 -mb-3 -mt-2.5 flex h-11 w-11 shrink-0 items-center justify-center">
        <input
          id={id}
          name={TERMS_FIELD}
          type="checkbox"
          required
          className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none h-5 w-5 rounded-sm border-[1.5px] border-ink/50 bg-white peer-checked:border-terracotta peer-checked:bg-terracotta peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mulberry"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute inset-0 m-auto hidden h-5 w-5 text-white peer-checked:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5.5 10.5 3 3 6-6.5" />
        </svg>
      </span>
      <span>
        I agree to the{' '}
        <Link href="/terms" className="-mx-1.5 px-1.5 py-3.5 font-medium text-link underline underline-offset-2">
          Terms
        </Link>{' '}
        and the{' '}
        <Link href="/privacy" className="-mx-1.5 px-1.5 py-3.5 font-medium text-link underline underline-offset-2">
          Privacy Notice
        </Link>
        {children}
      </span>
    </label>
  );
}
