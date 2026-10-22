import { InfoTip } from '@/app/_components/info-tip';

/**
 * ⓘ What a loved one is — and why a shop you own sits among them (its business alaga: a shop opened or
 * claimed becomes its owner's, 2026-10-22). Secondary, so behind the ⓘ (design brief 2026-09-24 §2), beside
 * "Add a loved one" at the head of People › Loved ones. One component, so the page and `/dev/people-lab`
 * draw the same words.
 */
export function LovedOnesTip() {
  return (
    <InfoTip label="About loved ones" labelClassName="text-[13px] text-ink/70" align="end">
      The people and things you plan events for — a child, a lola, a pet. A shop you own is here too, so you can make
      an event for it.
    </InfoTip>
  );
}
