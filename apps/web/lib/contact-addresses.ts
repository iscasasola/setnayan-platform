/**
 * contact-addresses.ts — the addresses Setnayan publishes to the world.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The Data Protection Officer contact was `iscasasolaii@gmail.com` — the
 * owner's personal Gmail — in **21 places across 10 published surfaces**:
 * /privacy (×6), /terms, /refunds, /cookies, /acceptable-use,
 * /privacy/google-access, the marketing footer, the JSON-LD `Organization` in
 * app/layout.tsx, lib/help.ts and lib/llms-txt.ts.
 *
 * 🔑 IT IS A COMPLIANCE STRING, NOT A CONTACT DETAIL. Under RA 10173 the DPO
 * contact is what a data subject uses to exercise access, correction, blocking
 * and erasure, and what the NPC uses to reach the controller. A personal
 * mailbox on a third-party consumer domain is the wrong endpoint for that, and
 * it also publishes the owner's private address on six public pages.
 *
 * The repo's own compliance register already had this open as a Tier-0 task —
 * `lib/npc-filing-tasks.ts` key `t0-3`: *"One DPO email (dpo@setnayan.com vs
 * iscasasolaii@gmail.com)"*. The canonical filing documents say `dpo@`; the
 * code said the other. Owner ruled 2026-09-22: **use `dpo@setnayan.com`.**
 *
 * ── WHY A MODULE AND NOT 21 EDITED STRINGS ──────────────────────────────────
 * Because it had already drifted once in the other direction: `support@setnayan.com`
 * is declared TWICE, independently, in `anniversary-emails-core.ts` and
 * `godchild-reminder-emails.ts`. A value that appears in twenty-one places and
 * is owned by none of them is a value that will be wrong in some of them.
 * `published-contacts-are-canonical.test.ts` holds this closed.
 *
 * ⚠ THE MAILBOX MUST EXIST BEFORE THIS SHIPS. `setnayan.com` receives mail via
 * iCloud+ Custom Email Domain (MX `mx01/mx02.mail.icloud.com`, SPF
 * `include:icloud.com`), so addresses are created at icloud.com/settings →
 * Custom Email Domain. **A published DPO contact that bounces is worse than a
 * personal one that works** — an unreachable controller is its own violation.
 */

/**
 * The Data Protection Officer contact published on every legal surface.
 * Routes to a person; it is a role address, not a shared inbox with no owner.
 */
export const DPO_EMAIL = 'dpo@setnayan.com';

/**
 * Ordinary customer support — NOT a substitute for the DPO address above.
 *
 * ⚠ `support@setnayan.com` WAS PUBLISHED FOR MONTHS AND NEVER EXISTED. The
 * domain receives mail through iCloud+ Custom Email Domain, which caps a plan
 * at **three** addresses, and all three were already spent: `live@`, `dpo@`,
 * `noreply@`. So every unsubscribe line and receipt that named `support@` was
 * pointing customers at a bounce.
 *
 * 🔑 A DOMAIN ACCEPTING MAIL IS NOT A MAILBOX EXISTING. A session confirmed the
 * MX records resolved and read that as the address working; the owner's own
 * iCloud screen was what settled it. Owner ruled 2026-09-22: **use `live@`**,
 * which exists today, rather than buying a plan tier for a fourth address.
 */
export const SUPPORT_EMAIL = 'live@setnayan.com';

/**
 * Domains a published Setnayan surface may never point a person at. Consumer
 * mail hosts, i.e. somebody's personal mailbox. Held by the guard rather than
 * left to review, because the replacement of a legal contact is exactly the
 * edit that gets made quickly and read by nobody.
 */
export const PERSONAL_MAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'me.com',
  'proton.me',
] as const;

/** True when `address` sits on a consumer mail host. Case- and space-tolerant. */
export function isPersonalMailbox(address: string): boolean {
  const at = address.trim().toLowerCase();
  const domain = at.slice(at.lastIndexOf('@') + 1);
  return (PERSONAL_MAIL_DOMAINS as readonly string[]).includes(domain);
}
