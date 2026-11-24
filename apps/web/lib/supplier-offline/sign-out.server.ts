import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { DEVICE_ID_RE } from './qr';

/** The cookie the phone keeps its QR key ids in (`lib/offline/supplier-queue.ts` · `ensurePhoneKey`). */
export const OFFLINE_DEVICES_COOKIE = 'sn_offline_devices';

/**
 * 🔳 Signing out stops this phone's offline QR keys (owner 2026-11-24, DECISION_LOG 7d618cb3): only the leaving
 * account's rows, only the phones this browser names. Returns how many were stopped; a refused write is logged and the
 * sign-out goes on (the phone's own keys are erased either way).
 */
export async function stopOfflineDevicesOnSignOut(admin: SupabaseClient, userId: string, raw: string | undefined): Promise<number> {
  const ids = decodeURIComponent(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => DEVICE_ID_RE.test(s))
    .slice(0, 20);
  if (ids.length === 0) return 0;
  const { data, error } = await admin
    .from('vendor_offline_devices')
    .update({ status: 'stopped', stopped_at: new Date().toISOString(), stopped_by: userId, stop_reason: 'signed_out' })
    .in('device_id', ids)
    .eq('member_user_id', userId)
    .eq('status', 'active')
    .select('device_id');
  if (error) {
    console.error('[supabase-error] supplier-offline: stop devices on sign-out', error.message);
    return 0;
  }
  return (data ?? []).length;
}
