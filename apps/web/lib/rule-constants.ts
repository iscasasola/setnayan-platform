/**
 * rule-constants.ts — fixed RULES that screens quote to people, each named once.
 *
 * Root map (part 2) "Numbers that look live but are typed in" (owner 2026-10-02:
 * *"if for example we say 190 days to go on the screen, but all along the 190
 * days was hardcoded…"*). A number written into a screen's words is a second
 * copy of whatever really decides it. These are the rules that are NOT read from
 * an event, a catalogue row or a table — they are the rule itself — so they get
 * ONE named home here, and the words that quote them interpolate the name:
 * change the rule once, every sentence that states it moves with it.
 *
 * ⛔ NOT A PRICE. A price is read from `platform_retail_catalog_v2` (or the
 * vendor billing catalogue), never from this file.
 * ⛔ NOT A MEASUREMENT. Nothing here is counted from an event — a count is
 * computed from its rows.
 *
 * Pure module: no React, no I/O, no imports — safe in a client component, and
 * a few bytes in a bundle.
 */

/**
 * Days a customer has, from payment, to report a problem for a refund
 * ("within 7 days of payment where possible" — /refunds). The policy page and
 * the support macros quote this; it is a stated window, not enforced by a job.
 */
export const REFUND_REPORT_WINDOW_DAYS = 7;

/**
 * How long error and usage logs are kept, as the Privacy policy declares it
 * ("90 days or less"). RA 10173 storage limitation binds us to the period we
 * DECLARE, so the notice renders this name instead of its own literal. The
 * retention itself is enforced by the logging vendor's project setting, not by a
 * job in this repo — change the setting and this together.
 */
export const ERROR_LOG_RETENTION_DAYS = 90;

/**
 * How long the database provider keeps each daily backup, as /privacy and
 * /terms declare it. Read off Supabase › Database Backups by the owner on
 * 2026-10-23 (daily physical backups, kept 7 days; storage objects not
 * included) and recorded in the Breach Policy § 3.1. Enforced by the
 * provider's plan, not by a job in this repo — change the plan and this
 * together.
 */
export const DB_BACKUP_RETENTION_DAYS = 7;

/**
 * A complimentary grant worth more than this many PESOS is marked
 * `requires_two_admin_review` by `issueCompGrant`, but it still inserts at once —
 * no second admin checks a customer comp yet. The banner and the Users form hint
 * both say so and quote this number (owner 16 Nov 2026: keep the rule, promise
 * no check that never happens).
 */
export const COMP_GRANT_CO_REVIEW_PESOS = 10_000;

/**
 * Days a supplier has to answer a clashing-date request before the couple may
 * choose (safeguard 2 of the clashing-date flow). Lives here, not in
 * `lib/date-change.ts`, so the Maker's client panel can say it without pulling
 * that module's date formatting into its first load.
 */
export const DATE_CHANGE_DUE_DAYS = 3;
