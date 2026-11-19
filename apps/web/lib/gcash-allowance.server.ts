import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { monthStartISO } from '@/lib/payment-channels';
import { gcashNumberOrNull, gcashUsedFromRows, type GcashGate } from '@/lib/gcash-allowance';

/**
 * 💳 THE LIVE GCASH GATE — the line, the monthly allowance, and how much of it
 * this Manila month has used (owner 2026-11-18; rule in lib/gcash-allowance.ts).
 *
 * Read LIVE on every call (never remembered): the month total moves with every
 * payment, and a stale total is exactly how the allowance would overshoot.
 * Service-role read — a payer cannot see other people's payments, and the
 * allowance is about all of them.
 *
 * The month window is the same one the admin meter uses (`monthStartISO`, the
 * Manila calendar month, on `paid_at`).
 *
 * ⛔ FAILS TO NULL, AND NULL MEANS BDO. A refused or thrown read of either half
 * returns `null`, which `pickPayerRail` turns into BDO — never a wider GCash.
 */
export async function getGcashGate(opts?: { excludeOrderId?: string | null; now?: Date }): Promise<GcashGate | null> {
  try {
    const admin = createAdminClient();
    const monthStart = monthStartISO(opts?.now ?? new Date());
    const [settingsRes, paymentsRes] = await Promise.all([
      admin.from('platform_settings').select('gcash_max_php, gcash_allowance_php').eq('id', 1).maybeSingle(),
      admin
        .from('payments')
        .select('channel, amount_php, status, order_id')
        .in('status', ['pending', 'matched'])
        .gte('paid_at', monthStart),
    ]);
    if (settingsRes.error || !settingsRes.data) {
      if (settingsRes.error) logQueryError('gcash-allowance: settings', settingsRes.error, {}, 'graceful_degrade');
      return null;
    }
    if (paymentsRes.error || !paymentsRes.data) {
      if (paymentsRes.error) logQueryError('gcash-allowance: month total', paymentsRes.error, {}, 'graceful_degrade');
      return null;
    }
    const s = settingsRes.data as { gcash_max_php?: unknown; gcash_allowance_php?: unknown };
    return {
      maxPhp: gcashNumberOrNull(s.gcash_max_php),
      allowancePhp: gcashNumberOrNull(s.gcash_allowance_php),
      usedThisMonthPhp: gcashUsedFromRows(
        paymentsRes.data as Array<{ channel: string | null; amount_php: number | string | null; status: string | null; order_id: string | null }>,
        opts?.excludeOrderId ?? null,
      ),
    };
  } catch {
    return null;
  }
}
