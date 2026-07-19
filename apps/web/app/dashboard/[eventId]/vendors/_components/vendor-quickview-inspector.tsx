import {
  Star,
  MapPin,
  MapPinOff,
  Wallet,
  CalendarCheck,
  CalendarX2,
  BadgeCheck,
  Sparkles,
} from 'lucide-react';
import { InspectorColumn } from '@/app/_components/inspector/inspector-column';
import { formatPhp } from '@/lib/vendors';
import type { ShortlistVendor } from '@/lib/shortlist-taxonomy';

/**
 * VendorQuickViewInspector — the desktop inspector body for a Shortlist "bench"
 * vendor card (Merkado, phase 3). A NEW PRESENTATION of the SAME `ShortlistVendor`
 * the card already renders — identity (name · category · city), the Verified /
 * Setnayan badges, the live fit-badges (reach / budget / date), the rating +
 * review summary, and the vendor's price — with the SAME single action the card
 * offers today: "Open full profile ↗" → its existing `/vendors/<vendorId>` room
 * (InspectorColumn's built-in full-page link).
 *
 * REAL-DATA HONESTY: every field is read straight off the `ShortlistVendor` the
 * bench card is built from, and each renders ONLY when present (rating, city,
 * price, badges are all hidden-when-absent — nothing is fabricated). The bench
 * card's data carries no Setnayan-AI-ranked signal (the "% match", the eyeing
 * count, and the ranked sort all live OUTSIDE `ShortlistVendor`, gated upstream),
 * so this quick-view surfaces nothing that sits behind the AI paywall — it shows
 * exactly what the couple already sees on the card, no more.
 *
 * Server component — renders the client `InspectorColumn` with static children.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function VendorQuickViewInspector({
  vendor,
  categoryLabel,
  fullHref,
}: {
  vendor: ShortlistVendor;
  /** The tile (category) this vendor is shortlisted under — the eyebrow. */
  categoryLabel: string;
  /** The vendor's existing detail route (the card's own href). */
  fullHref: string;
}) {
  const v = vendor;

  // Fit-badges — the SAME live reach / budget / date signals the bench card
  // shows (FitBadges in shortlist-categories.tsx), hidden-when-absent exactly as
  // there. These are NOT AI-paywalled (they render on the card whether or not
  // Setnayan AI is active).
  const fits: { cls: 'ok' | 'warn'; icon: React.ReactNode; text: string }[] = [];
  if (v.reachesVenue === true) {
    fits.push({ cls: 'ok', icon: <MapPin size={12} strokeWidth={2.25} aria-hidden />, text: 'Reaches you' });
  } else if (v.reachesVenue === false) {
    fits.push({
      cls: 'warn',
      icon: <MapPinOff size={12} strokeWidth={2.25} aria-hidden />,
      text: v.serviceRadiusKm ? `Beyond ${v.serviceRadiusKm}km` : 'Travel fee likely',
    });
  }
  if (v.budgetFit === 'fits') {
    fits.push({
      cls: 'ok',
      icon: <Wallet size={12} strokeWidth={2.25} aria-hidden />,
      text: v.budgetEstimated ? 'Fits budget · est.' : 'Fits budget',
    });
  } else if (v.budgetFit === 'over') {
    fits.push({
      cls: 'warn',
      icon: <Wallet size={12} strokeWidth={2.25} aria-hidden />,
      text: v.budgetEstimated ? 'Over budget · est.' : 'Over budget',
    });
  }
  if (v.dateFit === 'free') {
    fits.push({ cls: 'ok', icon: <CalendarCheck size={12} strokeWidth={2.25} aria-hidden />, text: 'Free on your date' });
  } else if (v.dateFit === 'booked') {
    fits.push({ cls: 'warn', icon: <CalendarX2 size={12} strokeWidth={2.25} aria-hidden />, text: 'Booked that day' });
  }

  return (
    <InspectorColumn
      eyebrow={categoryLabel}
      title={v.name}
      fullHref={fullHref}
      fullLabel="Open full profile"
      swapKey={`v:${v.vendorId}`}
      ariaLabel={`${v.name} — vendor details`}
    >
      <div className="space-y-4">
        {/* Hero image / initials — mirrors the card's photo ladder. */}
        <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#3a3f47] to-[#565b63]">
          {v.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif text-4xl italic text-cream/70">{initials(v.name)}</span>
          )}
        </div>

        {/* Status + identity chips */}
        <div className="flex flex-wrap items-center gap-2">
          {v.status === 'locked' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-mulberry px-2.5 py-1 text-[11px] font-bold text-cream">
              ★ Chosen
            </span>
          ) : (
            <span className="rounded-full border border-ink/12 px-2.5 py-1 text-[11px] font-medium text-ink/55">
              Considering
            </span>
          )}
          {v.city ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-ink/60">
              <MapPin size={13} strokeWidth={1.75} aria-hidden /> {v.city}
            </span>
          ) : null}
        </div>

        {/* Badges — Setnayan · Verified (only when present). */}
        {v.isVerified || v.isSetnayan ? (
          <div className="flex flex-wrap gap-2">
            {v.isSetnayan ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mulberry/10 px-2.5 py-1 text-[11px] font-semibold text-mulberry">
                <Sparkles size={12} strokeWidth={2} aria-hidden /> Setnayan
              </span>
            ) : null}
            {v.isVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-[11px] font-semibold text-success-900">
                <BadgeCheck size={12} strokeWidth={2} aria-hidden /> Verified
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Rating + review summary (hidden when the vendor has no rating). */}
        {v.rating != null ? (
          <div className="flex items-center gap-1.5 text-sm text-ink/75">
            <Star size={15} strokeWidth={1.75} className="text-terracotta" aria-hidden />
            <span className="font-semibold text-ink">{v.rating.toFixed(1)}</span>
            {v.reviewCount != null ? (
              <span className="text-ink/55">
                · {v.reviewCount} {v.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Live fit-badges — same reach / budget / date signals as the card. */}
        {fits.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {fits.map((f, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  f.cls === 'ok'
                    ? 'bg-success-100 text-success-900'
                    : 'bg-warn-50 text-warn-900'
                }`}
              >
                {f.icon} {f.text}
              </span>
            ))}
          </div>
        ) : null}

        {/* Price — the vendor's quoted total, when there is one. */}
        {v.totalCostPhp != null && v.totalCostPhp > 0 ? (
          <div className="border-t border-ink/10 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Your price</p>
            <p className="mt-0.5 font-serif text-2xl italic font-semibold text-ink">
              {formatPhp(v.totalCostPhp)}
            </p>
          </div>
        ) : null}
      </div>
    </InspectorColumn>
  );
}
