import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { emitAdminNotice } from '@/lib/notification-emit';
import { insertFaultLog } from '@/lib/telemetry/fault-log';

/**
 * 💳 MAYA WOULD NOT OPEN — tell the admins ONCE (owner 2026-11-21, DECISION_LOG "BDO QR IS NOT AN OPTION — ONLY THE
 * SAFETY ROUTE WHEN MAYA IS OFF" ③ + ship review: "send exactly one admin notice").
 *
 * The payer is already on the BDO QR with "Maya is busy — pay by BDO QR. Nothing has been charged." — this is the
 * admins' half. Every failure is written to the fault log; the NOTICE goes out once per window: the first failure
 * claims `platform_settings.maya_busy_noticed_at` with a conditional UPDATE, so ten payers hitting a dead Maya in the
 * same hour send one notice, not ten. A claim that cannot be written sends nothing (never a storm).
 */
export const MAYA_BUSY_NOTICE_WINDOW_MS = 60 * 60 * 1000;

export async function noteMayaBusy(reason: string, orderId: string): Promise<void> {
  try {
    await insertFaultLog({
      event_type: 'OTHER',
      element_name: 'Maya checkout would not open — payer sent to the BDO QR',
      file_path: 'app/pay/[reference]/maya-start.ts',
      error_message: reason.slice(0, 500),
      payload_snapshot: { orderId },
    });
    const admin = createAdminClient();
    const since = new Date(Date.now() - MAYA_BUSY_NOTICE_WINDOW_MS).toISOString();
    const { data: claimed, error } = await admin
      .from('platform_settings')
      .update({ maya_busy_noticed_at: new Date().toISOString() })
      .eq('id', 1)
      .or(`maya_busy_noticed_at.is.null,maya_busy_noticed_at.lt.${since}`)
      .select('id');
    if (error) {
      console.error('[maya] busy-notice claim refused — no notice sent', error.message);
      return;
    }
    if ((claimed ?? []).length === 0) return; // already told this window

    const { data: admins, error: adminsError } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (adminsError) {
      console.error('[maya] busy-notice admin read refused', adminsError.message);
      return;
    }
    await Promise.all(
      (admins ?? []).map((row) =>
        emitAdminNotice({
          userId: row.user_id as string,
          type: 'payment_rail_down',
          title: 'Maya is not opening — payers are on the BDO QR',
          body: `Maya's checkout would not open (${reason.slice(0, 120)}). Payers are being sent to the BDO QR, which you approve by hand. Check the Maya keys and Maya's status.`,
          relatedUrl: '/admin/integrations',
        }),
      ),
    );
  } catch (e) {
    console.error('[maya] busy notice failed (non-fatal)', e instanceof Error ? e.message : e);
  }
}
