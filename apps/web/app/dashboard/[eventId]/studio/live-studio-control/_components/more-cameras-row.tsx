'use client';

/**
 * "More cameras" — the ONE row the Live Watch shop window collapsed into
 * (corpus `MORE_MENU_PAGES_AUDIT_2026-10-07_fable.md` §3 step 1; prototype
 * `3-live-watch.html`, last row: "More cameras · Add Live Watch · ₱…").
 *
 * The row is a different DOOR to the same `ChoosePlanSheet` the hero CTA used
 * to open — same plans, same notices, same acknowledgement, same checkout —
 * so nothing about the purchase changes; only the 500 words in front of it
 * are gone. The other states mirror `AddOnStateCta` one for one, as a row
 * value instead of a pill.
 */
import { Star } from 'lucide-react';
import { ChoosePlanSheet, type ChoosePlanSheetProps } from '@/app/_components/app-store/choose-plan-sheet';
import type { AddOnState } from '@/lib/add-on-state';
import { ServiceRow } from '@/components/service-rows';

export function MoreCamerasRow({
  state,
  href,
  choosePlan,
}: {
  state: AddOnState;
  /** `request_sent` → the order page, where the reference and status live. */
  href: string | null;
  choosePlan: Omit<ChoosePlanSheetProps, 'renderTrigger'>;
}) {
  const glyph = <Star strokeWidth={2} />;
  switch (state) {
    case 'add':
      return (
        <ChoosePlanSheet
          {...choosePlan}
          renderTrigger={(open) => (
            <ServiceRow
              glyph={glyph}
              label="More cameras"
              value={`${choosePlan.triggerLabel}${choosePlan.priceFromLabel ? ` · ${choosePlan.priceFromLabel}` : ''}`}
              onClick={open}
              data-testid="live-watch-more-cameras"
            />
          )}
        />
      );
    case 'request_sent':
      return href ? (
        <ServiceRow glyph={glyph} label="More cameras" value="Verifying payment" href={href} />
      ) : (
        <ServiceRow glyph={glyph} label="More cameras" value="Verifying payment" />
      );
    case 'launch':
      return <ServiceRow glyph={glyph} label="More cameras" value="Unlocked" />;
    case 'blocked':
      return <ServiceRow glyph={glyph} label="More cameras" value="Unavailable" />;
    case 'expired':
      return <ServiceRow glyph={glyph} label="More cameras" value="Event ended" />;
  }
}
