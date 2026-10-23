import { HardDrive } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { eventSkuActive } from '@/lib/entitlements';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatPhp } from '@/lib/orders';
import { createClient } from '@/lib/supabase/server';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

/**
 * 🗂 KEEP FULL RESOLUTION — a Memories setting now (owner 2026-10-23: *"Gallery holds: … keep full res"*), moved
 * whole from the Papic page: owned → the one line that says so; on sale → its catalogue price and the shipped
 * apply-then-pay drawer; not on sale → nothing (the price is never typed — `platform_retail_catalog_v2`).
 *
 * 🍎 Sold on the web only — the caller never draws it in the iPhone app.
 */
export async function KeepFullResRow({ eventId }: { eventId: string }) {
  const admin = createAdminClient();
  const supabase = await createClient();
  const [row, owns, settings] = await Promise.all([
    admin.from('platform_retail_catalog_v2').select('retail_price_php, is_active').eq('service_code', 'HIGH_RES_ARCHIVE').maybeSingle(),
    eventEntitlementClient(eventId)
      .then((ent) => eventSkuActive(ent, eventId, 'HIGH_RES_ARCHIVE'))
      .catch(() => false),
    fetchPlatformSettings(supabase),
  ]);
  if (row.error) logQueryError('KeepFullResRow.catalog', row.error, { event_id: eventId }, 'graceful_degrade');
  if (owns) {
    return (
      <p className="text-sm text-ink/70" data-keep-full-res="owned">
        ✓ <span className="font-medium text-ink">Keep full resolution is on</span> — every original is kept for this
        event, undegraded.
      </p>
    );
  }
  const price = row.data?.is_active ? Number(row.data.retail_price_php) : null;
  if (!price) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-keep-full-res="offer">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <HardDrive className="h-4 w-4 text-mulberry" aria-hidden />
          Keep full resolution
        </p>
        <p className="text-xs text-ink/60">After 6 months we keep a compressed copy; this keeps every original too.</p>
      </div>
      {settings ? (
        <InlineCheckoutDrawer
          eventId={eventId}
          serviceKey="HIGH_RES_ARCHIVE"
          displayName="Keep Full-Res"
          originalPriceCentavos={String(Math.round(price * 100))}
          settings={settings}
          triggerLabel={`Keep Full-Res · ${formatPhp(price)}/yr`}
          triggerClassName="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-mulberry/40 px-4 py-2.5 text-sm font-medium text-mulberry hover:bg-mulberry/5"
        />
      ) : (
        <span className="shrink-0 font-mono text-sm text-ink/60">{formatPhp(price)}/yr</span>
      )}
    </div>
  );
}
