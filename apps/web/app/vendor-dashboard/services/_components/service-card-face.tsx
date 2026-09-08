import { Gift, Plus, AlertCircle, Lock, ImageIcon, CheckCircle2 } from 'lucide-react';
import { php, type Snapshot } from '@/lib/service-card-snapshot';

/**
 * service-card-face.tsx — the card a couple sees, drawn from a `Snapshot`.
 *
 * ── WHY IT IS ITS OWN COMPONENT (owner, 2026-09-08) ────────────────────────
 * *"we want to show the actual service cards."* This markup used to live inside
 * `ServiceCardLivePreview`, which reads a live `<form>` — so the only place a
 * vendor could see their real card was INSIDE the collapsed "Edit details"
 * editor. The list showed a grey wrench glyph and one line of text.
 *
 * Splitting the drawing from the reading lets the LIST render the same card
 * from stored values while the EDITOR keeps mirroring the form as you type.
 * Two renderers would have been the obvious move and the wrong one: the card is
 * a promise about what a couple sees, and two of them drift.
 *
 * Purely presentational — no state, no effects, no form access. It renders no
 * inputs, so mounting it inside a form adds nothing to the submitted payload.
 */
export function ServiceCardFace({
  snap,
  leafPathLabel,
  addonsFromPhp,
  coverUrl,
}: {
  snap: Snapshot;
  /** "Leaf · Parent" context line under the name (server-resolved). */
  leafPathLabel: string;
  /** Cheapest PAID add-on (server-known; the AddonsEditor manages its own forms). */
  addonsFromPhp?: number | null;
  /** Presigned/public URL of the current cover, when there is one. */
  coverUrl?: string | null;
}) {
  return (
  <div
    className="flex items-start gap-3 rounded-2xl border p-3"
    style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
  >
    <div
      className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg"
      style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : snap.hasCover ? (
        <CheckCircle2 aria-hidden className="h-6 w-6" strokeWidth={1.5} />
      ) : (
        <ImageIcon aria-hidden className="h-6 w-6" strokeWidth={1.5} />
      )}
    </div>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          {snap.name}
        </span>
        {snap.discountBadge ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'var(--m-sage)', color: 'var(--m-ink)' }}
          >
            {snap.discountBadge}
          </span>
        ) : null}
      </div>
      <p className="truncate text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
        {leafPathLabel}
      </p>
      <p className="flex items-center gap-2 text-xs">
        {/* No star here on purpose — the real card shows a "shop
            rating" only once the shop has a real review, never a
            per-card number (see CardRecordSection). A hardcoded 4.5
            would tell the vendor couples see praise this card has
            not earned. */}
        <span className="font-medium" style={{ color: 'var(--m-orange-2)' }}>
          {snap.priceText}
        </span>
      </p>
      {snap.includesLine ? (
        <p className="flex items-start gap-1 text-[11px] font-medium" style={{ color: 'var(--m-sage-deep, var(--m-ink))' }}>
          <Gift aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
          <span>{snap.includesLine}</span>
        </p>
      ) : null}
      {addonsFromPhp != null ? (
        <p className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          <Plus aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          Add-ons from +{php(addonsFromPhp)}
        </p>
      ) : null}
      {snap.notIncluded.length ? (
        <p
          className="flex items-start gap-1 rounded-md px-2 py-1 text-[11px]"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
        >
          <AlertCircle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
          <span>Not included: {snap.notIncluded.join(' · ')}</span>
        </p>
      ) : null}
      {snap.hasExclusive ? (
        <p className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--m-orange-2)' }}>
          <Lock aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          Setnayan Exclusive inside · unlocked in chat
        </p>
      ) : null}
      <p className="flex items-center gap-2 pt-1">
        <span
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          Request a quote
        </span>
        <span className="text-[10px]" style={{ color: 'var(--m-slate-3)' }}>
          final price by quote
        </span>
      </p>
    </div>
  </div>
  );
}
