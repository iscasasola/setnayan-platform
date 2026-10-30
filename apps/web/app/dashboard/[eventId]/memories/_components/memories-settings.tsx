import { HardDrive } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { eventSkuActive } from '@/lib/entitlements';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { formatPhp } from '@/lib/orders';
import { InfoTip } from '@/app/_components/info-tip';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { ServiceParts } from '@/app/dashboard/[eventId]/studio/_components/service-parts';
import { LiveWallCard } from '@/app/dashboard/[eventId]/studio/papic/_components/live-wall-card';
import { PoolGalleryCard } from '@/app/dashboard/[eventId]/studio/papic/_components/pool-gallery-card';
import { DriveCopyCard, type DriveGrant } from '@/app/dashboard/[eventId]/studio/papic/_components/drive-copy-card';
import { getDriveOAuthConfig } from '@/lib/papic-drive';
import type { MemoriesManagerRole } from '@/lib/memories-rules';

/**
 * ⚙ GALLERY SETTINGS — the sheet behind Memories' gear (owner 2026-10-23, verbatim: *"Gallery holds: follow moments in
 * order, photowall, thank you, guest see photos, google drive, keep full res"*; approved
 * `prototypes/papic_controller_one_page_2026-10-23.html`, `gallerySettings`). "Follow the moments in order" is drawn
 * by the gallery itself (a way of looking, remembered on the device); the other five are the SHIPPED controls that
 * stood on the Papic page, moved — never a second copy:
 *
 *   Photo wall              `LiveWallCard variant="row"` (copy link · screen codes · on guests' phones · count · layout)
 *   Thank-You Video         `ServiceParts service="papic"` (the add-on's own door; nothing when it is not offered)
 *   Who sees what           `PoolGalleryCard variant="row"` (`pool_gallery_open`) — was "Guests see all photos"
 *   Google Drive            `DriveCopyCard` (connect / connected / "Coming soon" while Google's review runs)
 *   Keep full resolution    the HIGH_RES_ARCHIVE line, priced from the catalogue (web only — Apple does not sell it)
 *
 * 👁 WHO SEES WHAT FIRST (owner 2026-10-30, DECISION_LOG "MEMORIES ⚙ HOLDS THE MEMORIES RULES — HOSTS + COORDINATORS
 * MANAGE THEM; DEFAULT "ONLY TAGGED""): the "Guests see all photos" switch is now the rule **Who sees what** — Only
 * tagged (default) · Share all memories — the SAME column (`pool_gallery_open`), drawn by the same `PoolGalleryCard`.
 * 👥 `role`: the hosts (the couple + every co-host) get the whole sheet; the event's COORDINATOR gets the rules only
 * (Who sees what) — the photo wall, the Thank-You add-on, Google Drive and Keep full resolution are purchases and
 * the hosts' own accounts, not Memories rules. The server action is the authority either way (`memoriesManagerRole`).
 */
export async function MemoriesSettings({
  eventId,
  loginEmail,
  appleIap,
  role = 'host',
}: {
  eventId: string;
  loginEmail: string | null;
  appleIap: boolean;
  /** Who is looking (`memoriesManagerRole`): a coordinator sees the Memories rules only. */
  role?: MemoriesManagerRole;
}) {
  if (role === 'coordinator') return <PoolGalleryCard eventId={eventId} variant="row" />;
  const supabase = await createClient();
  const admin = createAdminClient();
  const [grantRes, driveConfig, owns, priceRes, platform] = await Promise.all([
    supabase
      .from('oauth_grants')
      .select('grant_id, external_account_display, granted_at, connection_health, metadata')
      .eq('event_id', eventId)
      .eq('provider', 'drive')
      .is('revoked_at', null)
      .maybeSingle(),
    getDriveOAuthConfig(),
    eventEntitlementClient(eventId).then((ent) => eventSkuActive(ent, eventId, 'HIGH_RES_ARCHIVE')),
    admin.from('platform_retail_catalog_v2').select('retail_price_php, is_active').eq('service_code', 'HIGH_RES_ARCHIVE').maybeSingle(),
    fetchPlatformSettings(supabase),
  ]);
  const price = priceRes.data?.is_active ? Number(priceRes.data.retail_price_php) : null;

  return (
    <>
      <PoolGalleryCard eventId={eventId} variant="row" />
      <LiveWallCard eventId={eventId} appleIap={appleIap} variant="row" />
      <div className="py-3" data-memories-setting="thank-you">
        <ServiceParts eventId={eventId} service="papic" />
      </div>
      <div className="py-3" data-memories-setting="drive">
        <DriveCopyCard
          eventId={eventId}
          driveOAuthReady={driveConfig.ready}
          driveGrant={(grantRes.data ?? null) as DriveGrant | null}
          loginEmail={loginEmail}
        />
      </div>
      {appleIap ? null : (
        <section className="flex items-center justify-between gap-3 py-3" data-memories-setting="keep-full-res">
          <span className="min-w-0">
            <InfoTip label="Keep full resolution" labelAs="h3" labelClassName="text-[15px] font-semibold text-ink" align="start">
              Your Memories stay free, for life. After 6 months we keep a compressed copy; Keep full resolution keeps every
              original too. A yearly service, priced from the catalogue.
            </InfoTip>
            <span className="block text-[12.5px] text-ink/60">
              {owns ? 'Active · every original kept' : 'Off · after 6 months we keep a compressed copy'}
            </span>
          </span>
          {owns ? (
            <span className="shrink-0 text-[13px] font-medium text-success-800">Active</span>
          ) : price && platform ? (
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey="HIGH_RES_ARCHIVE"
              displayName="Keep Full-Res"
              originalPriceCentavos={String(Math.round(price * 100))}
              settings={platform}
              triggerLabel={`Turn on · ${formatPhp(price)}/yr`}
              triggerClassName="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-terracotta/40 px-3.5 py-2 text-[13px] font-medium text-terracotta hover:bg-terracotta/5"
            />
          ) : (
            <HardDrive aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
          )}
        </section>
      )}
    </>
  );
}
