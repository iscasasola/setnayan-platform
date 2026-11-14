import { ArrowRight, EyeOff } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InlineNotice } from '@/app/_components/notices/inline-notice';
import { TEAM_PREVIEW_COPY, TEAM_PREVIEW_HEAD, type ShopPreviewReason } from '@/lib/own-shop-preview';

/**
 * The band a shop's owner and helpers see on their own page before couples can (lib/own-shop-preview.ts).
 *
 * Owner, 23 Oct 2026: the page must say who can see it, what couples are waiting on, and the next step as a button.
 * A band, not a card — frames go only on what you press, so the one framed thing here is the button (44 px).
 * 🧡 The button is the house forward step (BUTTON_RULE: `ActionButton tone="brand" main` — terracotta, a pill), not
 * the black ink block it was (owner, live on his own shop 2026-11-07). This is a SERVER component and ActionButton is a
 * client one, so the icon goes over as an ELEMENT — a component (a function) cannot cross that line and 500s the page.
 * `data-team-preview` carries the reason so a walk and a guard can read which state was drawn.
 */
/**
 * 🔔 Inventory #11 — a LIVE notice (info) in the one notice system (owner approved 14 Nov 2026): who can see this page.
 * It can't be hidden — it is the truth about the page in front of you — and it is drawn where it stands.
 */
export function TeamPreviewBanner({ reason }: { reason: ShopPreviewReason }) {
  const copy = TEAM_PREVIEW_COPY[reason];
  return (
    <section aria-label="Only your team can see this page" data-team-preview={reason} className="mx-auto w-full max-w-5xl px-4 pt-3 sm:px-6 lg:px-8">
      <InlineNotice
        kind="live"
        tone="info"
        closable={false}
        noticeKey={`who-can-see:${reason}`}
        mark={<EyeOff aria-hidden className="h-4 w-4 shrink-0 text-ink/60" strokeWidth={1.75} />}
        title={TEAM_PREVIEW_HEAD}
        detail={copy.line}
        actions={
          <ActionButton
            tone="brand"
            main
            icon={<ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />}
            label={copy.action.label}
            href={copy.action.href}
            className="!h-11 min-h-11 shrink-0"
          />
        }
      />
    </section>
  );
}
