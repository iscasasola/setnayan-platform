import Link from 'next/link';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
import { ReturnInPlace } from '@/app/_components/chat/chat-back';
import { pageBackLink } from '@/lib/page-home';

/**
 * BackButton — the single shared "back" affordance.
 *
 * WHY: the 2026-06-20 user-flow audit found back navigation drawn ~95 different
 * ways — `ArrowLeft` (×80 files) vs `ChevronLeft` (×15), with gap 1/1.5/2/3,
 * text xs/sm/base, and ink/50–85 all mixed (the classic "same control, designed
 * differently" tell). This standardises on ONE icon, size, spacing, tap target,
 * and tint. Every "Back to X" link should use it.
 *
 * 🧭 IT READS ITS DESTINATION FROM THE MAP (owner 2026-10-28, DECISION_LOG
 * "EVERY PAGE GOES BACK TO THE RIGHT HOME"). Pass the page's own route pattern
 * and its params — `<BackButton route="/dashboard/[eventId]/story" params={{ eventId }} />`
 * — and the href and the label come from `lib/page-home.ts`. Where the map says
 * the page draws no back (a bar tab, a one-time token page, a flow with its own
 * ✕) this renders NOTHING, so a page cannot disagree with the map by accident.
 * `lib/every-back-goes-home.test.ts` holds that every `route=` names the file's
 * own page.
 *
 * @deprecated `href` — the free destination, kept only for callers not yet
 * moved to `route` (the 2026-10-28 swap of the ad-hoc backs is a later PR). The
 * guard still checks an `href` against the map, so it cannot drift either.
 *
 * Href-only by design — the audit found 0 `router.back()` back buttons; every
 * back affordance points at a known destination. Plain <Link>, so it works in
 * server and client components alike. `min-h-[44px]` keeps the tap target ≥44px
 * (mobile). Pass `className` to nudge layout (e.g. drop the default `mb-4`).
 */
export function BackButton(
  props:
    | {
        /** This page's route pattern, as on disk: `/dashboard/[eventId]/guests/new`. */
        route: string;
        /** Values for the home's `[params]` (`eventId`, `slug`, …). */
        params?: Readonly<Record<string, string>>;
        href?: never;
        label?: string;
        className?: string;
        /**
         * `chat` — the chat head's ‹ (owner 2026-10-28, the Messenger look): a 44 round chevron in the accent, its
         * label the accessible name, and it RETURNS IN PLACE — when the tab came to the chat from a chat list, ‹ is
         * the browser's back, so the list comes back where it was scrolled (`chat/chat-back.tsx`).
         */
        variant?: 'pill' | 'chat';
      }
    | {
        /** @deprecated pass `route` — see the docblock. */
        href: string;
        route?: never;
        params?: never;
        label?: string;
        className?: string;
        variant?: 'pill' | 'chat';
      },
) {
  const { className = '' } = props;
  let href: string;
  let label: string;
  if (props.route !== undefined) {
    const link = pageBackLink(props.route, props.params);
    if (!link) return null;
    href = link.href;
    label = props.label ?? link.label;
  } else {
    href = props.href;
    label = props.label ?? 'Back';
  }
  if (props.variant === 'chat') {
    return (
      <ReturnInPlace>
        <Link
          href={href}
          aria-label={`Back to ${label}`}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sn-accent hover:bg-ink/5 ${className}`}
          data-chat-back=""
        >
          <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={2} />
        </Link>
      </ReturnInPlace>
    );
  }
  return (
    <Link
      href={href}
      className={`mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink ${className}`}
    >
      <ArrowLeft aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
      {label}
    </Link>
  );
}
