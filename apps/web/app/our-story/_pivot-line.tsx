'use client';

/**
 * OurStoryPivotLine — the Act 2 manifesto PIVOT line of /our-story, given the
 * page's ONE bold motion moment.
 *
 * "A photograph can't hold that. An album can't move. Until now." IS the page
 * thesis — stillness giving way to motion — so animating it ENACTS the argument:
 * the lines rise (mask-clipped) into place as the block scrolls into view, and
 * the final mulberry "Until now." lands last.
 *
 * This is a 'use client' island so the otherwise-server OurStory body can stay a
 * server component. It REPLACES the line's previous `<Reveal delay={140}>`
 * wrapper (never nested with it — that would fade-then-rise twice). The copy
 * stays the exact SSR HTML / a11y text; useLineReveal is opacity-only,
 * fonts.ready-guarded, and rests fully visible under reduced motion or any
 * SplitText failure, so this load-bearing line is never stranded hidden.
 *
 * See corpus `Premium_UI_Standard_2026-06-25.md` + the useLineReveal contract in
 * `_components/marketing/_premium.tsx`.
 */

import { useLineReveal } from '@/app/_components/marketing/_premium';

export function OurStoryPivotLine() {
  // trigger:'view' — the pivot line sits below the fold, so it's IO-gated.
  const ref = useLineReveal({ trigger: 'view' });

  return (
    <p
      ref={ref as React.RefObject<HTMLParagraphElement>}
      className="m-serif italic mx-auto mt-10"
      style={{ fontSize: 'clamp(1.4rem, 3.6vw, 2rem)', lineHeight: 1.3, maxWidth: 560 }}
    >
      A photograph can’t hold that. An album can’t move.{' '}
      <span style={{ color: 'var(--m-mulberry)' }}>Until now.</span>
    </p>
  );
}
