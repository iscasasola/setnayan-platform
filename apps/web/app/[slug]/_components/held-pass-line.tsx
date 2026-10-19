import { heldPassLine, hostPreviewLine } from '@/lib/pass-account-rule';

/**
 * 🪪 ONE PLAIN LINE when this browser holds an invitation that is not the signed-in viewer's (owner bug 2026-10-19 —
 * `lib/pass-account-rule.ts`). Drawn in Me (and under the host's cover, where Me is not drawn), in the slot "Not you?
 * Switch" uses: the same quiet text and the same underlined buttons, no box (nothing here is a card to press).
 *
 *   set_aside     "This browser also holds Milagros's invitation. Viewing as you."
 *                 · a HOST also gets "Open as Milagros" (hosts preview guests);
 *                 · everyone gets "Remove it from this browser" — that event's pass only (`/{slug}/sign-out`).
 *   host_preview  "You're viewing as Milagros — this browser holds their invitation." · "Back to you".
 *
 * Every button is a POST form: a link would be run by a prefetch.
 */
export function HeldPassLine({
  slug,
  firstName,
  mode,
  className = '',
}: {
  slug: string;
  firstName: string | null;
  mode: 'set_aside' | 'set_aside_host' | 'host_preview';
  className?: string;
}) {
  const name = firstName?.trim() || null;
  const button =
    'min-h-[44px] min-w-[44px] font-medium text-ink underline underline-offset-4 hover:text-link';
  if (mode === 'host_preview') {
    return (
      <div data-held-pass="host_preview" className={`text-sm text-ink/70 ${className}`}>
        <p>{hostPreviewLine(name)}</p>
        <form method="post" action={`/${slug}/open-as-pass`}>
          <input type="hidden" name="do" value="back" />
          <button type="submit" className={button}>
            Back to you
          </button>
        </form>
      </div>
    );
  }
  return (
    <div data-held-pass={mode} className={`text-sm text-ink/70 ${className}`}>
      <p>{heldPassLine(name)}</p>
      <div className="flex flex-wrap gap-x-5">
        {mode === 'set_aside_host' ? (
          <form method="post" action={`/${slug}/open-as-pass`}>
            <input type="hidden" name="do" value="open" />
            <button type="submit" className={button}>
              {name ? `Open as ${name}` : 'Open as this guest'}
            </button>
          </form>
        ) : null}
        <form method="post" action={`/${slug}/sign-out`}>
          <button type="submit" className={button}>
            Remove it from this browser
          </button>
        </form>
      </div>
    </div>
  );
}
