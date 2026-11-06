/**
 * THE ONE SAMPLE MARKER — the small calm chip that says "this is a sample, not a real one".
 *
 * First drawn on the sample event's own story page (`app/realstories/[slug]/page.tsx`, "Sample showcase" — the
 * `is_sample` event). Owner, 6 Nov 2026: *"They are demo shops. The only real shop is the wedding planner."* — and the
 * demo shops wear the SAME marker the sample event wears ("Sample shop"), on their page and on their card. Owner, the
 * same day: *"builds don't look like what was designed"* — so this is the sample event's chip, moved here unchanged,
 * not a new drawing. Every sample marker reads its look from {@link SAMPLE_MARKER_CLASS}; change it here and every
 * sample changes with it. Guard: `app/_components/the-sample-shop-wears-the-sample-marker.test.ts`.
 *
 * No hook, no state: renders on the server or the client alike.
 */
import type { ReactNode } from 'react';

import { InfoTip } from './info-tip';

/** The sample event's chip, exactly as `realstories/[slug]` drew it before it moved here. */
export const SAMPLE_MARKER_CLASS =
  'rounded-full border border-ink/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/55';

export function SampleMarker({ children }: { children: ReactNode }) {
  return <span className={SAMPLE_MARKER_CLASS}>{children}</span>;
}

/** What the ⓘ beside "Sample shop" says (owner-approved words, 6 Nov 2026). */
export const SAMPLE_SHOP_ABOUT = 'A sample to show how a shop looks on Setnayan. Its photos are illustrations.';

/**
 * "Sample shop" + its ⓘ — the shop page's name block and the shop's marketplace card. The chip IS the ⓘ's label
 * (InfoTip prints it), so the label and the marker cannot drift apart. Render it only for a shop marked
 * `vendor_profiles.is_demo` — the caller decides; this draws.
 */
export function SampleShopMarker({ align = 'start' }: { align?: 'center' | 'start' | 'end' }) {
  return (
    <InfoTip label="Sample shop" labelClassName={SAMPLE_MARKER_CLASS} align={align} className="w-fit shrink-0">
      {SAMPLE_SHOP_ABOUT}
    </InfoTip>
  );
}
