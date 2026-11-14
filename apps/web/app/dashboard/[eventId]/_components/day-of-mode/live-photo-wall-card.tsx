import { Camera, ArrowRight } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * The day-of Live Photo Wall card.
 *
 * ⚠ This was a hardcoded "Coming soon" stub whose docblock read: "the live photo
 * wall depends on iterations 0009 (photo delivery) and 0012 (Papic / paparazzo
 * tagging), which are not yet shipped." Both shipped. LIVE_WALL is an ACTIVE
 * ₱2,500 SKU in the production catalog and the wall itself ships at
 * /wall/[eventId] — so on the wedding day a couple who had PAID for the wall was
 * shown a greyed-out card telling them it did not exist yet. The stub outlived
 * its own premise and nothing re-read the premise.
 *
 * Rendering is now gated by the caller on real LIVE_WALL ownership (resolved
 * server-side in the dashboard page via eventSkuActive, the same predicate the
 * wall page itself gates on). A couple who does not own the wall sees nothing
 * here rather than an advertisement disguised as a broken feature.
 */
// 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 5 · 7 · 13): no box — grey capitals and a soft "Ready" chip; the how-to
// moves behind the title's ⓘ; the door is the shared pill at the 44 px floor.
export function LivePhotoWallCard({ eventId }: { eventId: string }) {
  return (
    <section aria-labelledby="day-of-memory-lane" className="space-y-2">
      <header className="flex min-h-11 items-center justify-between gap-2">
        <h2 id="day-of-memory-lane" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
          <Camera aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2} />
          Memory lane
        </h2>
        <Badge tone="ok">Ready</Badge>
      </header>

      <InfoTip
        label="Photos on the big screen, as they happen"
        labelAs="h3"
        labelClassName="text-base font-semibold tracking-tight text-ink"
        align="start"
      >
        Open this on the venue screen or a laptop plugged into the projector. You&rsquo;ll get a six-character code to
        type in once, then photos appear by themselves for the rest of the night.
      </InfoTip>

      <ActionButton
        tone="brand"
        href={`/wall/${eventId}`}
        icon={<ArrowRight aria-hidden strokeWidth={1.9} />}
        label="Open Memory lane on a screen"
      />
    </section>
  );
}
