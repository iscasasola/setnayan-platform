import { Gift } from 'lucide-react';
import { getCoupleFreeWindowBanners } from '@/lib/promo-free-windows';

/**
 * Couple-facing announcement banner for a live "free this weekend" promo window
 * (the in-app channel the owner picked, 2026-07-22). Self-gating server
 * component: renders nothing unless PROMO_FREE_WINDOWS_ENABLED is on AND a
 * banner-enabled window is live for the 'all_couples' audience. Mounted once in
 * the event layout so it shows across the couple's dashboard while a promo runs.
 *
 * Silent auto-free (owner choice): the covered SKUs are already unlocked via the
 * entitlement-OR (lib/entitlements.ts) — this banner is just how the couple finds
 * out. No CTA/claim step; the services simply show as included while it's live.
 */
export async function PromoFreeWindowBanner() {
  const banners = await getCoupleFreeWindowBanners();
  const promo = banners[0];
  if (!promo) return null;

  const endsLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(promo.ends_at));

  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-xl border border-terracotta/25 bg-terracotta/5 px-4 py-3 text-sm text-ink"
    >
      <Gift
        aria-hidden
        strokeWidth={1.75}
        className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-700"
      />
      <div className="min-w-0">
        <p className="font-semibold text-terracotta-700">{promo.title}</p>
        {promo.blurb ? (
          <p className="mt-0.5 text-ink/75">{promo.blurb}</p>
        ) : null}
        <p className="mt-0.5 text-xs text-ink/55">
          Free through {endsLabel} — already applied, no code needed.
        </p>
      </div>
    </div>
  );
}
