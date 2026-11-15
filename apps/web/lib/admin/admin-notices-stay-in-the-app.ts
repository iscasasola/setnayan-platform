/**
 * 📥 ADMIN GETS ONE EMAIL A DAY — THE MORNING DIGEST; EVERY OTHER ADMIN NOTICE STAYS IN THE APP (owner, 2026-11-15,
 * DECISION_LOG).
 *
 * Owner, verbatim: *"i see the emails but i dont want to flood my mail. i want everything organized here."* … *"on the
 * app"* — and then: *"morning digest is fine. 1 email a day. not every notification"*.
 *
 * A per-event notice written FOR the admins — a payment waiting to be matched, a verification submitted, a help
 * message, a force-majeure or fee-dispute case — lands in the admin's bell and on their phone (push is unchanged) and
 * is never emailed. The morning digest (`lib/admin/digest-flush.ts`, its own switch) is the admin's one email a day and
 * is untouched. Emails to couples, guests and suppliers are unchanged.
 *
 * 🔑 THE GATE IS THE NOTICE'S AUDIENCE, NOT THE KIND AND NOT THE PERSON. `order_awaiting_reconciliation` and
 * `vendor_status_change` also reach suppliers, so withholding a kind would silence them; and the owner's own account
 * is an admin AND a couple, so withholding by person would stop the emails about his own wedding. Each admin fan-out
 * (the `is_internal / is_team_member / admin` read) sends through `emitAdminNotice`, and that notice is never emailed.
 * PURE — no server imports, so a test can read the rule.
 */

/** The notice was written for the admins: sent through `emitAdminNotice`, or built with the admin email parts. */
export function isAdminNotice(args: { adminNotice?: boolean; email?: { audience?: 'admin' } }): boolean {
  return args.adminNotice === true || args.email?.audience === 'admin';
}

