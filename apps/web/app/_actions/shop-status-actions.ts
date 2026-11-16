'use server';

/**
 * ⏸ SHOP STATUS — ONE server action for both doors (owner 2026-10-31 *"They can pause and close. Admin can also do
 * that"*; 2026-11-16 "AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW"). One dispatcher instead of a supplier
 * export and an admin export: every exported "use server" function is one Vercel route
 * (`scripts/lint-server-action-budget.mjs`).
 *
 *   · A supplier (Shop ⚙ › Shop status): pause · reopen their own pause · close (owner only, no open bookings).
 *   · Setnayan (admin): pause · reopen · close any shop.
 *
 * WHO MAY is decided in the DATABASE, not here: the call goes to `set_shop_status()` on the caller's OWN session, and
 * that door reads `auth.uid()` (shop owner / team admin / `is_admin()`). This action adds only what an admin's act
 * owes on top: an `admin_audit_log` row and an in-app notice to the shop's owner.
 *
 * ⚠ No screen calls this yet — the Shop status row and the paused page wait on an owner-approved drawing.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { emitNotification } from '@/lib/notification-emit';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import {
  parseShopStatus,
  parseShopStatusRefusal,
  type ShopStatus,
  type ShopStatusRefusal,
} from '@/lib/shop-status';

export type SetShopStatusResult =
  | { ok: true; status: ShopStatus }
  | { ok: false; reason: ShopStatusRefusal; openBookings?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setShopStatus(input: {
  vendorProfileId: string;
  status: ShopStatus;
  /** An admin's note for the audit log. Ignored for a supplier. */
  reason?: string | null;
}): Promise<SetShopStatusResult> {
  const status = parseShopStatus(input?.status);
  const vendorProfileId = String(input?.vendorProfileId ?? '');
  if (!status) return { ok: false, reason: 'bad_status' };
  if (!UUID_RE.test(vendorProfileId)) return { ok: false, reason: 'missing' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'not_allowed' };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Read the row BEFORE, on the service role, only to tell an admin's act apart and to audit it — it decides nothing.
  const { data: beforeRow } = await admin
    .from('vendor_profiles')
    .select('user_id, business_name, business_slug, public_visibility, paused_at, paused_by')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();

  const { data, error } = await supabase.rpc('set_shop_status', {
    p_vendor_profile_id: vendorProfileId,
    p_status: status,
  });
  if (error) {
    const refusal = parseShopStatusRefusal(error.message);
    if (refusal.reason === 'unreadable') {
      console.error('[supabase-error] app/_actions/shop-status-actions.ts · rpc:set_shop_status', error);
    }
    return { ok: false, ...refusal };
  }
  const after = parseShopStatus(data) ?? status;

  const shop = beforeRow as {
    user_id: string | null;
    business_name: string | null;
    business_slug: string | null;
    public_visibility: string | null;
    paused_at: string | null;
    paused_by: string | null;
  } | null;
  revalidateShopPage(vendorProfileId, shop?.business_slug ?? null);

  // An admin's act: audit it, and tell the shop. A supplier acting on their own shop needs neither.
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin === true && shop) {
    const { error: auditErr } = await admin.from('admin_audit_log').insert({
      action: 'vendor_shop_status_change',
      target_table: 'vendor_profiles',
      target_id: vendorProfileId,
      before_json: { public_visibility: shop.public_visibility, paused_at: shop.paused_at, paused_by: shop.paused_by },
      after_json: { status: after },
      reason: typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 500) : null,
      actor_user_id: user.id,
    });
    if (auditErr) console.error('[supabase-error] app/_actions/shop-status-actions.ts · from:admin_audit_log.insert', auditErr);

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
                ? 'Your shop is closed. Message Setnayan if you think this is a mistake.'
                : 'Your shop takes new bookings again.',
          relatedUrl: '/vendor-dashboard',
        });
      } catch (e) {
        console.error('[setShopStatus] notify failed:', e);
      }
    }
  }

  return { ok: true, status: after };
}
