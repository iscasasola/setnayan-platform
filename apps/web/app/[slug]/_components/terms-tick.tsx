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
 *  - The sentence is a wrapping flex row and each link is a flex item 44px tall by its own box (its own `min-h-[44px]`, never padding) — see
 *    there. "Privacy Notice" is `whitespace-nowrap` (the two words are one press and wrap together), and `relative`
 *    lifts a link's sideways press over the text beside it, so the right edge of "Terms" opens Terms and never ticks
 *    the box. NO inline link padded up: on lines 20px apart those zones overlap when Privacy wraps under Terms
 *    (a real tap on Terms opened /privacy — batch-4 walk, 2026-10-13).
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
      <span className="-my-3 flex flex-wrap items-center gap-x-1">
        <span>I agree to the</span>
        <Link href="/terms" className="relative -mx-1.5 inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1.5 font-medium text-link underline underline-offset-2">
          Terms
        </Link>
        <span>and the</span>
        <Link href="/privacy" className="relative -mx-1.5 inline-flex min-h-[44px] min-w-[44px] items-center whitespace-nowrap justify-center px-1.5 font-medium text-link underline underline-offset-2">
          Privacy Notice
        </Link>
        {children ? <span className="basis-full">{children}</span> : null}
      </span>
    </label>
  );
}
