import { Notice } from '@/app/_components/notices/notices';
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

  // 🔔 Inventory #3 · #15 — ONE offer line for both sides (one notice system, owner approved 14 Nov 2026: "Merge"):
  // ◆ the deal's own title, the rest behind the ⓘ, "Not now" (back after 30 days; the window also ends by itself).
  // Registered for the END of the page.
  return (
    <Notice
      kind="offer"
      noticeKey={`free-window:${promo.promo_window_id}`}
      title={promo.title}
      detail={
        <>
          {promo.blurb ? <span className="block">{promo.blurb}</span> : null}
          <span className="block">{`Free through ${endsLabel} — already applied, no code needed.`}</span>
        </>
      }
    />
  );
}
