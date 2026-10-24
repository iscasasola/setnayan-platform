import type { ReactNode } from 'react';
import { Eye, LogOut, Undo2 } from 'lucide-react';
import { heldPassLine, hostPreviewLine } from '@/lib/pass-account-rule';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * 🪪 ONE PLAIN LINE when this browser holds an invitation that is not the signed-in viewer's (owner bug 2026-10-19 —
 * `lib/pass-account-rule.ts`). Drawn in Me (and under the host's cover, where Me is not drawn), in the slot "Not you?
 * Switch" uses, with no box around it (nothing here is a card to press).
 *
 *   set_aside     "This browser also holds Milagros's invitation. Viewing as you."
 *                 · a HOST also gets "Open as Milagros" (hosts preview guests);
 *                 · everyone gets "Remove it from this browser" — that event's pass only (`/{slug}/sign-out`).
 *   host_preview  "You're viewing as Milagros — this browser holds their invitation." · "Back to you".
 *
 * 🔘 THE ACTIONS LOOK PRESSABLE, AND STAND WHERE THE LINE STANDS (owner 2026-10-24, on cale-ice: the sentence sat
 * centred under "Will you join us? · Reply" while its two underlined words sat flush left, "out of line with
 * everything above them"). Each is a small quiet pill — icon + word, a hairline in the page's own ink, a 44 px tap
 * target — painted only with the Event Hub's theme tokens (`ink`), so it wears every couple's design and the dark
 * Look. The row is INLINE (`inline-flex` pills in a block, no `flex` row of its own), so it follows whatever text
 * alignment the place it is drawn in has: centred under the cover's centred line, flush left beside the reply's name.
 * (A `flex` row has its own `justify-content` and ignores `text-align` — that was the bug.)
 *
 * Every button is a POST form: a link would be run by a prefetch.
 */
const PILL =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/20 px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/60';
const ICON = 'h-4 w-4 shrink-0';

/** One pill, as a POST form that sits inline (so the row follows its parent's alignment). */
function PassAction({
  action,
  value,
  icon,
  children,
}: {
  action: string;
  value?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <form method="post" action={action} className="m-1 inline-block align-middle">
      {value ? <input type="hidden" name="do" value={value} /> : null}
      <button type="submit" className={PILL}>
        {icon}
        <span>{children}</span>
      </button>
    </form>
  );
}

export function HeldPassLine({
  slug,
  firstName,
  mode,
  className = '',
  bar = false,
}: {
  slug: string;
  firstName: string | null;
  mode: 'set_aside' | 'set_aside_host' | 'host_preview';
  className?: string;
  /** 🪪 THE SLIM HOST BAR at the top of the redrawn Me (owner 2026-10-24): "Viewing as Indalecia ⓘ · Back to you" —
   *  the rest ("Only they can save it to their account") inside the ⓘ. Host preview only. */
  bar?: boolean;
}) {
  const name = firstName?.trim() || null;
  if (mode === 'host_preview' && bar) {
    return (
      <div data-held-pass="host_preview" data-held-pass-bar="" className={`text-center text-sm text-ink/70 ${className}`}>
        <InfoTip label={`Viewing as ${name ?? 'this guest'}`} className="justify-center align-middle" labelClassName="text-ink" ariaLabel="About viewing as a guest">
          This browser holds their invitation. Only they can save it to their account.
        </InfoTip>
        <div data-held-pass-actions="" className="-m-1 ml-1 inline-block align-middle">
          <PassAction action={`/${slug}/open-as-pass`} value="back" icon={<Undo2 aria-hidden className={ICON} />}>
            Back to you
          </PassAction>
        </div>
      </div>
    );
  }
  if (mode === 'host_preview') {
    return (
      <div data-held-pass="host_preview" className={`text-sm text-ink/70 ${className}`}>
        <p>{hostPreviewLine(name)}</p>
        <div data-held-pass-actions="" className="-m-1 mt-2">
          <PassAction action={`/${slug}/open-as-pass`} value="back" icon={<Undo2 aria-hidden className={ICON} />}>
            Back to you
          </PassAction>
        </div>
      </div>
    );
  }
  return (
    <div data-held-pass={mode} className={`text-sm text-ink/70 ${className}`}>
      <p>{heldPassLine(name)}</p>
      <div data-held-pass-actions="" className="-m-1 mt-2">
        {mode === 'set_aside_host' ? (
          <PassAction action={`/${slug}/open-as-pass`} value="open" icon={<Eye aria-hidden className={ICON} />}>
            {name ? `Open as ${name}` : 'Open as this guest'}
          </PassAction>
        ) : null}
        <PassAction action={`/${slug}/sign-out`} icon={<LogOut aria-hidden className={ICON} />}>
          Remove it from this browser
        </PassAction>
      </div>
    </div>
  );
}
