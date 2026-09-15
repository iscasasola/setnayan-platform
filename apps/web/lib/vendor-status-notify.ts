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
  /*
    SUP-31 — the last three are LISTING decisions, not verification ones.
    Measured on origin/main 2026-09-15: four admin surfaces move a shop in or
    out of the marketplace and only `/admin/verify` ever told it. A shop whose
    vouched badge was withdrawn by hand, or whose listing was un-published off
    an integrity flag, learned by finding its own page gone.

    They ride THIS function rather than a sibling because everything that makes
    it safe is already here and is easy to get wrong alone: it resolves the
    owning account, SKIPS an unclaimed shop that has no account yet, is
    fail-soft so a notify failure can never roll back the admin action, and
    emits `vendor_status_change` — a type already on BOTH the email allowlist
    and the push allowlist. That last part matters: in this repo a notification
    and its allowlist entry are two halves of one mechanism, and having one is
    indistinguishable from having neither.
  */
  decision: 'approved' | 'rejected' | 'demoted' | 'listed' | 'hidden' | 'unpublished';
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
          : args.decision === 'demoted'
            ? {
                title: 'Your account was moved to limited status',
                body: `Your vendor account was demoted from verified status.${reasonSuffix} Reach the Setnayan team if you have questions or to re-apply.`,
              }
            : args.decision === 'listed'
              ? {
                  title: 'Your shop is live in the marketplace',
                  body: `Setnayan has listed your shop — couples can find it and send you enquiries now.${reasonSuffix}`,
                }
              : args.decision === 'hidden'
                ? {
                    title: 'Your shop is no longer shown to couples',
                    body: `Setnayan has hidden your shop from the marketplace, so it no longer appears in search or on your public page.${reasonSuffix} Your shop, services and messages are all still here. Reach the Setnayan team if you have questions.`,
                  }
                : {
                    title: 'Your listing was taken down',
                    body: `Setnayan has un-published your listing, so couples can no longer find it.${reasonSuffix} Nothing has been deleted — your shop and its services are intact. Reach the Setnayan team if you have questions.`,
                  };

    await emitNotification({
      userId: vendorUserId,
      type: 'vendor_status_change',
      title: copy.title,
      body: copy.body,
      /*
        A listing decision sends them to My Shop, where the listing state and
        its controls actually live. The verification decisions keep
        `/vendor-dashboard/verify` — which is itself now a redirect to
        `/vendor-dashboard/shop#get-verified`, so both land on the same page and
        the verification ones land on the right ANCHOR.
      */
      relatedUrl:
        args.decision === 'listed' ||
        args.decision === 'hidden' ||
        args.decision === 'unpublished'
          ? '/vendor-dashboard/shop'
          : '/vendor-dashboard/verify',
    });
  } catch (e) {
    console.error('[vendor-status] vendor status-change notify failed:', e);
  }
}
