/**
 * THE FREE-CREDIT PROMISE, AS PIXELS.
 *
 * Every place /papic mentions the free pool renders through here, for two
 * reasons and they are both about failure:
 *
 *   1 · ONE SENTENCE, FOUR SURFACES. The hero badge, the bullet, the closing
 *       line and the structured data all said "on every celebration" — a claim
 *       that is technically true and materially false (an account claims the
 *       pool ONCE; celebration two gets a 1-point floor, one photograph). Four
 *       hand-typed copies is how three of them get fixed and one is missed.
 *
 *   2 · THE SWITCHED-OFF BRANCH HAS TO BE EXECUTABLE. `papicFreeCreditPromise`
 *       returns `null` when the allowance is off, and each component below
 *       returns `null` with it — so `the-free-credit-promise-is-true.test.ts`
 *       can RENDER them at zero and assert the markup is EMPTY. A source grep
 *       cannot see that branch; a `stillSayable`-style pattern ban cannot see
 *       it either. The measurement has to reach the render.
 *
 * ⚠ NO NUMBER IS TYPED HERE. Every figure arrives as a `PapicFreeGrantRead`
 * from the admin-owned column. This file is on
 * `lib/papic-copy-guardrails.test.ts`'s list, which fails CI on a literal.
 */

import { papicFreeCreditPromise } from '@/lib/papic-free-credit-promise';
import type { PapicFreeGrantRead } from '@/lib/papic-tier-copy';

/**
 * The page's tick bullet. It lives here rather than in `page.tsx` because the
 * free-credit bullet is the ONE bullet that can legitimately disappear, and the
 * disappearance has to be the component's own decision — a `<Fact>` wrapper in
 * the page with an empty body would draw a tick beside nothing.
 */
export function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-2.5">
      <span aria-hidden className="translate-y-px text-[var(--m-orange-2)]">
        ✓
      </span>
      <span className="text-[var(--m-slate-2)]">{children}</span>
    </li>
  );
}

/**
 * The badge on the hero photograph.
 *
 * ⚠ IT IS A SIZE, NOT A COUNTDOWN. This read "N credits left" — a meter
 * reading, on a public marketing page, for a stranger who has no celebration
 * and therefore nothing that could be counting down. Nothing is being spent
 * here; the figure is what the pool STARTS at.
 */
export function PapicFreeCreditBadge({ read }: { read: PapicFreeGrantRead }) {
  const promise = papicFreeCreditPromise(read);
  if (!promise) return null;
  return (
    <p className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-2.5 py-1.5 font-mono text-xs text-[var(--m-paper)] backdrop-blur">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--m-mulberry)] align-middle" />
      {promise.size}
    </p>
  );
}

/** The first of the three facts under the hero. */
export function PapicFreeCreditFact({ read }: { read: PapicFreeGrantRead }) {
  const promise = papicFreeCreditPromise(read);
  if (!promise) return null;
  return (
    <Fact>
      <span className="font-mono tabular-nums text-[var(--m-ink)]">{promise.count}</span>{' '}
      {promise.rest}
    </Fact>
  );
}

/** The line the page ends on. */
export function PapicFreeCreditClosing({ read }: { read: PapicFreeGrantRead }) {
  const promise = papicFreeCreditPromise(read);
  if (!promise) return null;
  return (
    <p className="font-serif text-2xl leading-snug tracking-tight text-[var(--m-ink)] sm:text-3xl">
      <span className="font-mono tabular-nums">{promise.count}</span> {promise.rest}.
    </p>
  );
}
