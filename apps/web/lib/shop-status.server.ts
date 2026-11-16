import 'server-only';

/**
 * ⏸ THE ONE WAY THE APP CHANGES A SHOP'S STATUS. Today its only caller is the admin's Pause on /admin/verify
 * (`setVendorPause`, app/admin/verify/actions.ts); the supplier's Shop ⚙ › Shop status will call it too once its
 * drawing is approved — through an EXISTING action, never a new export with no screen (audit of #7890, item 4). Owner 2026-11-16, answer 3 to PR #7890: the admin's "Hide" BECOMES Pause — one
 * control — so both doors run this, and this runs the database door `set_shop_status()`.
 *
 * WHO MAY is decided in the DATABASE: the call goes out on the caller's OWN session, and `set_shop_status()` reads
 * `auth.uid()` (shop owner / team admin / `is_admin()`). What this adds is only what an ADMIN's act owes on top: an
 * `admin_audit_log` row and an in-app notice to the shop's owner. A supplier acting on their own shop needs neither.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { emitNotification } from '@/lib/notification-emit';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { clearHomeShelf } from '@/lib/home-shelf-clear';
import {
  parseShopStatus,
  parseShopStatusRefusal,
  type ShopStatus,
  type ShopStatusRefusal,
} from '@/lib/shop-status';

export type ApplyShopStatusResult =
  | { ok: true; status: ShopStatus }
  | { ok: false; reason: ShopStatusRefusal; openBookings?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function applyShopStatus(input: {
  vendorProfileId: unknown;
  status: unknown;
  /** An admin's note for the audit log. Ignored for a supplier. */
  reason?: unknown;
}): Promise<ApplyShopStatusResult> {
  const status = parseShopStatus(input?.status);
  const vendorProfileId = String(input?.vendorProfileId ?? '');
  if (!status) return { ok: false, reason: 'bad_status' };
  if (!UUID_RE.test(vendorProfileId)) return { ok: false, reason: 'missing' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'not_allowed' };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Read the row BEFORE, on the service role, only to audit an admin's act and to address the notice — it decides
  // nothing. The door below decides everything.
  const { data: beforeRow, error: beforeErr } = await admin
    .from('vendor_profiles')
    .select('user_id, business_name, business_slug, public_visibility, paused_at, paused_by')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  // FAIL CLOSED (audit of #7890, item 2): without this row there is nothing to audit and nobody to tell, so an
  // admin's pause would land silently. Refuse the change instead — the shop stays exactly as it was.
  if (beforeErr) {
    console.error('[supabase-error] lib/shop-status.server.ts · from:vendor_profiles.select (before)', beforeErr);
    return { ok: false, reason: 'unreadable' };
  }
  if (!beforeRow) return { ok: false, reason: 'missing' };

  const { data, error } = await supabase.rpc('set_shop_status', {
    p_vendor_profile_id: vendorProfileId,
    p_status: status,
  });
  if (error) {
    const refusal = parseShopStatusRefusal(error.message);
    if (refusal.reason === 'unreadable') {
      console.error('[supabase-error] lib/shop-status.server.ts · rpc:set_shop_status', error);
    }
    return { ok: false, ...refusal };
  }
  const after = parseShopStatus(data) ?? status;

  const shop = beforeRow as unknown as {
    user_id: string | null;
    business_name: string | null;
    business_slug: string | null;
    public_visibility: string | null;
    paused_at: string | null;
    paused_by: string | null;
  };
  revalidateShopPage(vendorProfileId, shop.business_slug);
  // The home page remembers its shop shelf for 60 s — forget it now (lib/home-shelf-clear.ts).
  clearHomeShelf('shops');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin === true) {
    const note = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 500) : null;
    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      action: 'vendor_shop_status_change',
      target_table: 'vendor_profiles',
      target_id: vendorProfileId,
      before_json: { public_visibility: shop.public_visibility, paused_at: shop.paused_at, paused_by: shop.paused_by },
      after_json: { status: after },
      reason: note,
      actor_user_id: user.id,
    });
    if (auditErr) console.error('[supabase-error] lib/shop-status.server.ts · from:admin_audit_log.insert', auditErr);

    if (shop.user_id && shop.user_id !== user.id) {
      const name = shop.business_name ?? 'Your shop';
      try {
        await emitNotification({
          userId: shop.user_id,
          type: 'vendor_status_change',
          title:
            after === 'paused'
              ? `Setnayan paused ${name}`
              : after === 'closed'
                ? `Setnayan closed ${name}`
                : `${name} is open again`,
          body:
            after === 'paused'
              ? 'Your shop takes no new bookings for now. Couples who already booked you keep their bookings and can still message you.'
              : after === 'closed'
                ? 'Your shop is closed and hidden. Your page, reviews and photos are kept. Message Setnayan if you think this is a mistake.'
                : 'Your shop takes new bookings again.',
          relatedUrl: '/vendor-dashboard',
        });
      } catch (e) {
        console.error('[applyShopStatus] notify failed:', e);
      }
    }
  }

  return { ok: true, status: after };
}
