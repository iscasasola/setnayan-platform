/**
 * THE ONE DEMO MARKER — the small calm chip that says "this is a demo, not a real one".
 *
 * First drawn on the sample event's own story page (`app/realstories/[slug]/page.tsx`, "Sample showcase" — the
 * `is_sample` event); moved here unchanged (PR #7333's component, owner 6 Nov 2026: *"builds don't look like what was
 * designed"* — so this is the sample event's chip, not a new drawing).
 *
 * 🧪 THE WORDS ARE THE OWNER'S, VERBATIM (DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS"): *"these demo events, and
 * demo suppliers will show on with the rest of suppliers and events, but has a marking of (DEMO ONLY)."* That later
 * ruling replaces the same day's "Sample shop" copy. So every demo shop (`vendor_profiles.is_demo`) and every demo event
 * (`events.is_sample`) wears {@link DEMO_ONLY_LABEL} wherever the public sees it — the shop page, its marketplace card,
 * the front page shelf, the compare table, its share image, the demo event's page and its story.
 *
 * Every marker reads its look from {@link SAMPLE_MARKER_CLASS} and its words from {@link DEMO_ONLY_LABEL}; change them
 * here and every demo changes with them. A surface that cannot render React classes (the OG image, satori) prints
 * {@link DEMO_ONLY_LABEL} itself. Guard: `app/_components/demo-shops-wear-the-marker.test.ts` (per surface, anchored on
 * this module's import and its JSX, never a file-level word match).
 *
 * No hook, no state: renders on the server or the client alike (the ⓘ is the shared client `InfoTip`).
 */
import type { ReactNode } from 'react';

import { DEMO_ONLY_LABEL } from './demo-only-label';
import { InfoTip } from './info-tip';

/** The owner's words, verbatim — brackets included. Lives in a plain module so non-React surfaces share it. */
export { DEMO_ONLY_LABEL };

/** The sample event's chip, exactly as `realstories/[slug]` drew it before it moved here. */
export const SAMPLE_MARKER_CLASS =
  'rounded-full border border-ink/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/55';

/** The bare chip — for a caller that already sits inside its own ⓘ or must not open one. */
export function SampleMarker({ children = DEMO_ONLY_LABEL }: { children?: ReactNode }) {
  return <span className={SAMPLE_MARKER_CLASS}>{children}</span>;
}

/** What the ⓘ beside a demo SHOP's marker says. */
export const DEMO_SHOP_ABOUT =
  "A demo shop that shows how a supplier looks on Setnayan. It can't be booked, and its photos are illustrations.";

/** What the ⓘ beside a demo EVENT's marker says. */
export const DEMO_EVENT_ABOUT =
  'A demo event that shows how an event runs on Setnayan. It is not real, and it books only demo shops.';

/**
 * "(DEMO ONLY)" + its ⓘ. The chip IS the ⓘ's label (InfoTip prints it), so the label and the marker cannot drift
 * apart. Render it only for a row marked `vendor_profiles.is_demo` (kind `shop`, the default) or `events.is_sample`
 * (kind `event`) — the caller decides; this draws.
 */
export function DemoOnlyMarker({
  kind = 'shop',
  align = 'start',
}: {
  kind?: 'shop' | 'event';
  align?: 'center' | 'start' | 'end';
}) {
  return (
    <InfoTip
      label={DEMO_ONLY_LABEL}
      labelClassName={SAMPLE_MARKER_CLASS}
      ariaLabel={kind === 'event' ? 'About this demo event' : 'About this demo shop'}
      align={align}
      className="w-fit shrink-0"
    >
      {kind === 'event' ? DEMO_EVENT_ABOUT : DEMO_SHOP_ABOUT}
    </InfoTip>
  );
}
