/**
 * INTERNAL OPERATIONS GUIDES — for the Setnayan team, never for the public.
 *
 * ── WHY THIS FILE EXISTS (sweep 2026-10-19, row B3) ─────────────────────────
 * These three topics used to sit inside `HELP_TOPICS` in lib/help.ts with
 * `roles: ['admin']`, and a role filter is not a wall: /help rendered EVERY
 * topic on its unfiltered view, the FAQPage JSON-LD serialised all of them,
 * /help/[slug] prerendered each article as an indexed page, the help sitemap
 * listed them and site search returned them. So a stranger read "/admin has 8
 * sections … gated to internal admins (`is_internal=TRUE` on your user row)",
 * the audit-log table name, the two-admin rules and the force-majeure queue —
 * internal operations docs, published to the open web.
 *
 * 🔑 THE FIX IS STRUCTURAL, NOT A FILTER. A filter has to be remembered by
 * every reader of HELP_TOPICS (there are six); a separate module cannot be
 * reached by accident. `HelpRole` in lib/help.ts no longer has an admin value,
 * so an admin topic cannot even be typed there. Guarded by
 * `lib/public-help-says-what-is-true.test.ts`: no public topic may be for the
 * team, and no public route may import this file.
 *
 * ⏭ NOTHING RENDERS THESE TODAY. The content is kept (not deleted) because
 * `the-two-admin-promise-is-tracked.test.ts` counts every § 9.1 promise in
 * 'what-needs-two-admins', and withdrawing a contractual promise is an owner
 * decision, not a copy edit. Giving them a home inside /admin is a separate,
 * unbuilt piece of work — import this from an `app/admin/**` page only.
 */

import type { HelpArticle } from './help';

export type AdminHelpTopic = {
  key: string;
  label: string;
  audience: 'admin';
  articles: HelpArticle[];
};

export const ADMIN_HELP_TOPICS: ReadonlyArray<AdminHelpTopic> = [
  {
    key: 'admin-console-basics',
    label: 'Setnayan HQ basics',
    audience: 'admin',
    articles: [
      {
        slug: 'eight-surfaces',
        title: 'The 8 admin surfaces',
        body: '/admin has 8 sections: Users, Suppliers, Orders, Reviews, Funnels, Force-majeure, Website editor, Verify queue. Each is gated to internal admins (`is_internal=TRUE` on your user row). The left sidebar persists across all 8.',
      },
      {
        slug: 'find-a-user-or-vendor',
        title: 'Look up a user or supplier',
        body: 'Use the search bar on /admin/users or /admin/vendors. Search by name, email, public ID (S89U- / S89V- / S89E-), or partial slug. Click through to the full record — every action you take from there writes an audit row.',
      },
      {
        slug: 'audit-log',
        title: 'Read the audit log',
        body: 'Every meaningful admin action writes a row to `admin_audit_log` (actor user_id, target, action, before/after JSON, timestamp). View it from any user or supplier detail page → Audit tab. Use it when investigating "who did this and when".',
      },
      {
        slug: 'delete-vs-blacklist',
        title: 'Delete vs blacklist a user',
        body: 'Delete = soft-delete + 30-day restore window (RA 10173 right-to-erasure). Blacklist = permanent ban from re-signing-up with same email or device fingerprint, used for fraud. Pick delete by default; only blacklist after the abuse pattern is confirmed.',
      },
    ],
  },
  {
    key: 'admin-approvals',
    label: 'Two-admin approvals',
    audience: 'admin',
    articles: [
      {
        slug: 'what-needs-two-admins',
        title: 'What needs two-admin approval',
        body: 'Per Vendor Agreement § 9.1, major decisions need two admins. That means promoting a user to any admin role, adding an internal account, adding a team member to the shared pool, a comp grant above the § 9.1 retail limit, changing the BDO or GCash receiving account, a mid-quarter price change on any in-app SKU, force-delisting a supplier without the due-process timeline, refunding a single transaction above the § 9.1 limit, and re-publishing a previously rejected supplier application. Routine ops stay single-admin — payment reconciliation, approving a supplier verification queue item, comps and refunds at or below those limits, dispute mediation, review moderation and user lookup. Both limits are stated in § 9.1 itself, and the admin console names the exact figure at the moment you go over it.',
      },
      {
        slug: 'approving-an-action',
        title: "Approve another admin's request",
        body: 'When another admin proposes a major action, you see it in your Approvals queue at /admin (bell counter). Open the request, read the rationale + linked evidence, click Approve or Reject. Both admins\' identities are recorded permanently in the audit log.',
      },
      {
        slug: 'routine-vs-major',
        title: 'Routine vs major — the rule of thumb',
        body: 'Routine = reversible by a single admin within 1 business day. Major = affects many users, has financial impact above the limits § 9.1 states, or touches public trust. When in doubt, route to two-admin. The cost of double-checking is small; the cost of an unreviewed major action can be very high.',
      },
    ],
  },
  {
    key: 'admin-force-majeure',
    label: 'Force-majeure escalations',
    audience: 'admin',
    articles: [
      {
        slug: 'escalation-queue',
        title: 'Work the escalation queue',
        body: "/admin/force-majeure lists every flagged event. Each row shows: couple display name, event date, flag type (typhoon, illness, venue closure, etc.), evidence files the couple uploaded, the affected suppliers, and the 7-day auto-resolution clock.",
      },
      {
        slug: 'seven-day-window',
        title: 'The 7-day auto-resolution window',
        body: 'When a force-majeure flag is filed, suppliers have 7 days to propose terms directly with the couple in chat. If a resolution lands within 7 days, the flag closes without admin involvement. If day 7 passes with no resolution, the flag escalates to admin and shows up in your queue with an "ESCALATED" tag.',
      },
      {
        slug: 'four-resolution-paths',
        title: 'Four canonical resolution paths',
        body: 'Refund (supplier returns payment minus documented expenses), reschedule (services move to a mutually agreed new date), substitute (supplier provides equivalent service later), partial (some services delivered, some refunded). Pick one in the Resolve dialog; both parties get an email with the outcome.',
      },
    ],
  },
];
