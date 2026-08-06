import Link from 'next/link';
import { Camera, ArrowRight } from 'lucide-react';

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
 * wall page itself gates on) — matching how `pabatiActive` gates the video
 * guestbook card. A couple who does not own the wall sees nothing here rather
 * than an advertisement disguised as a broken feature.
 */
export function LivePhotoWallCard({ eventId }: { eventId: string }) {
  return (
    <article className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Live photo wall
        </p>
        <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta">
          Ready
        </span>
      </header>

      <h3 className="text-base font-semibold tracking-tight text-ink">
        Photos on the big screen, as they happen
      </h3>
      <p className="text-sm text-ink/65">
        Open this on the venue screen or a laptop plugged into the projector.
        You&rsquo;ll get a six-character code to type in once, then photos appear
        by themselves for the rest of the night.
      </p>

      <Link
        href={`/wall/${eventId}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-xs font-medium text-cream transition-opacity hover:opacity-90"
      >
        Open the wall on a screen
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </article>
  );
}
