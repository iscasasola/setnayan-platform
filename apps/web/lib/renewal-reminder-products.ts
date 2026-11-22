/**
 * 📮 WHAT ONE RENEWAL REMINDER SAYS — per paid order, by its service_key. Pure (no `server-only`), so it is tested.
 *
 * There is ONE renewal-reminder sender: `runRenewalReminders` in `lib/daily-email-jobs.ts` (the daily, request-driven
 * `renewal-reminders` job). It reads `subscriptions_due_for_renewal_reminder` — paid orders whose prepaid window
 * (`orders.expires_at`) ends within 7 days — locks each one in `renewal_reminder_log`, and sends
 * `buildRenewalReminderEmail` through `sendEmail` (the one Resend choke point). This module decides only the words
 * and the link for each product.
 *
 * 🛒 THE ULTRA ADD-ON (owner 2026-11-19, specs ad44b079 — "all your picks": its buyers DO get the renewal reminder).
 * Each paid `vendor_ultra_addon__<vendor_profile_id>` order carries its own 28-day window, so it reaches the sender
 * like every other prepaid order; this names it, says "four weeks" (not "a year"), and links to the Plan page where it
 * is bought again.
 *
 * ⛔ The four retired "+1" add-ons and the single extra seat are NOT reminded: they are not sold any more (2026-11-14 /
 * 2026-11-19), so "renew" would point at nothing. The SQL leaves them out (`RENEWAL_NOT_REMINDED_PREFIXES` mirrors
 * that list).
 */

export type RenewalPeriod = 'year' | 'four weeks';

export type RenewalReminderProduct = {
  /** Friendly product name in the subject and body. */
  title: string;
  /** App path the "Renew now" button opens. */
  renewPath: string;
  /** How long one renewal buys — drives the one sentence that says it. */
  period: RenewalPeriod;
};

/** The Ultra Add-on's order prefix — the same as `COUNT_ADDONS.ultra.servicePrefix` (lib/vendor-ultra-addons.ts). */
export const ULTRA_ADDON_ORDER_PREFIX = 'vendor_ultra_addon__';

/**
 * The retired "+1" add-ons and the single extra seat — never reminded (the SQL excludes the same prefixes). The seat
 * joined them on 22 Nov, when its orders got a 28-day window (controller ruling on PR #8019): it is not sold and the
 * app has no way to renew one, so "renew before then" would point at nothing.
 */
export const RENEWAL_NOT_REMINDED_PREFIXES: readonly string[] = Object.freeze([
  'vendor_extra_category__',
  'vendor_extra_service_card__',
  'vendor_extra_waitlist__',
  'vendor_extra_booking_per_date__',
  'vendor_extra_seat__',
]);

/** The words and link for one paid order's reminder. The default is the scaffold's original copy, unchanged. */
export function renewalReminderProduct(serviceKey: string): RenewalReminderProduct {
  if (serviceKey.startsWith(ULTRA_ADDON_ORDER_PREFIX)) {
    return { title: 'Ultra Add-on', renewPath: '/vendor-dashboard/subscription', period: 'four weeks' };
  }
  if (serviceKey === 'EVENT_SUBDOMAIN' || serviceKey === 'vendor_subdomain') {
    return { title: 'Custom Subdomain', renewPath: '/pricing', period: 'year' };
  }
  if (serviceKey === 'vendor_ai_addon') return { title: 'Vendor AI', renewPath: '/pricing', period: 'year' };
  if (serviceKey === 'vendor_3d_booth') return { title: '3D Booth', renewPath: '/pricing', period: 'year' };
  if (serviceKey === 'vendor_specialized_tools' || serviceKey === 'vendor_specialized_tools_annual') {
    return { title: 'Specialized tools', renewPath: '/pricing', period: 'year' };
  }
  return { title: 'Setnayan subscription', renewPath: '/pricing', period: 'year' };
}

/** The sentence that says what a renewal is. "year" is the scaffold's original sentence, word for word. */
export function renewalPeriodSentence(period: RenewalPeriod): string {
  const what = period === 'four weeks' ? 'four prepaid weeks' : 'a one-time prepaid year';
  return `To keep it running without interruption, renew before then. Renewal is ${what} (no automatic charge — you're always in control of when you pay).`;
}
