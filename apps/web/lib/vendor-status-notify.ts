import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Cross-account notification helpers for the vendor VERIFICATION + ACCOUNT
 * STATUS flow (Notification Foundation · Phase B · 2026-06-19).
 *
 * Two directions are closed here, both previously silent:
 *   • notifyAdminsApplicationSubmitted → fan out to every admin/internal/team
 *     user when a vendor submits a verification application (the 5-business-day
 *     SLA clock starts; the queue at /admin/verify gets a new item).
 *   • notifyVendorStatusChange → tell the VENDOR their verification/account
 *     status changed (approved / rejected / demoted), carrying the admin's
 *     decision_reason so it's not a silent state flip.
 *
 * Both are fully fail-soft (a failed notification never affects the underlying
 * application/decision action) and resolve everything they need from ids passed
 * by the caller, so they work from a server action OR a cron path.
 *
 * emitNotification already drops the in-app row AND emails the recipient (via
 * Resend when configured, for the allowlisted types — `vendor_status_change`
 * IS on the EMAIL_ENABLED_TYPES allowlist) — so these are the single call for
 * both channels.
 */

/**
 * Fan out to every admin/internal/team user that a vendor submitted a
 * verification application. Deep-links to the verification queue. SLA starts
 * the moment this fires.
 */
export async function notifyAdminsApplicationSubmitted(args: {
  vendorProfileId: string;
  applicationId: string;
  applicationType?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: v } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle();
    const name = v?.business_name ?? 'A vendor';

    const { data: admins } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (!admins?.length) return;

    const typeLabel =
      args.applicationType && args.applicationType !== 'initial'
        ? ` (${args.applicationType})`
        : '';

    await Promise.all(
      admins.map((row) =>
        emitNotification({
          userId: row.user_id as string,
          type: 'vendor_status_change',
          title: `Verification submitted · ${name}`,
          body: `${name} submitted a verification application${typeLabel}. The 5-business-day review SLA has started — review it in the queue.`,
          relatedUrl: '/admin/verify',
        }),
      ),
    );
  } catch (e) {
    console.error('[vendor-status] admin submit notify failed:', e);
  }
}

/**
 * Tell the vendor their verification / account status changed. Resolves the
 * owning user_id from the vendor_profile_id (unclaimed vendors with a NULL
 * user_id are skipped — there's no account to notify yet). Deep-links to the
 * vendor's verification surface so they can see the decision + next steps.
 */
export async function notifyVendorStatusChange(args: {
  vendorProfileId: string;
  decision: 'approved' | 'rejected' | 'demoted';
  reason?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: v } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', args.vendorProfileId)
      .maybeSingle();
    const vendorUserId = (v as { user_id?: string | null } | null)?.user_id;
    if (!vendorUserId) return; // unclaimed vendor — no account to notify yet

    const reasonSuffix = args.reason ? ` Reason: ${args.reason}.` : '';
    const copy =
      args.decision === 'approved'
        ? {
            title: 'Your verification was approved',
            body: `You're now a verified Setnayan vendor — your profile is live in the marketplace.${reasonSuffix}`,
          }
        : args.decision === 'rejected'
          ? {
              title: 'Your verification needs another look',
              body: `Your verification application wasn't approved this time. You can address the notes and submit a new application.${reasonSuffix}`,
            }
          : {
              title: 'Your account was moved to limited status',
              body: `Your vendor account was demoted from verified status.${reasonSuffix} Reach the Setnayan team if you have questions or to re-apply.`,
            };

    await emitNotification({
      userId: vendorUserId,
      type: 'vendor_status_change',
      title: copy.title,
      body: copy.body,
      relatedUrl: '/vendor-dashboard/verify',
    });
  } catch (e) {
    console.error('[vendor-status] vendor status-change notify failed:', e);
  }
}
