/**
 * FirstRunBrand — the SETNAYAN mark + wordmark, small, at the top of every first-run screen (owner 2026-10-21,
 * "make sure there is Setnayan"; prototype `first_run_you_and_next_steps_2026-10-21.html`): sign-up, the You
 * card, the event-type picker, "What do you need?", and every /open-shop step. The shipped `Wordmark`, never a
 * redraw — this only fixes its size and its one line of space, so the screens cannot drift apart.
 *
 * `size` is the Wordmark's own (12 → the prototype's 12.5 px "SETNAYAN" beside a 15 px mark). The spotlight's
 * once-only welcome draws it larger (18) — `lib/tours.ts` `welcome`.
 * Held by `lib/first-run-screens-carry-the-brand.test.ts`.
 */
import { Wordmark } from './brand-marks';

export function FirstRunBrand({
  size = 12,
  color = 'currentColor',
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div data-first-run-brand="" className={className}>
      <Wordmark size={size} color={color} />
    </div>
  );
}
