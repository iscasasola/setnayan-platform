/**
 * HELP SLOT H5 — host areas U19, U20, U25–U30, U32, U36, U37.
 *
 * Owned by ONE answer-writing session (H5); no other session edits this file.
 * Covers: Live Watch · Patiktok · plans and payments (Event Plus · Event Pro · Event Ultra) · Setnayan AI · co-hosts · manpower · close-out · paperwork · Groups · refer · Life-Flash.
 * Where those live in the app: app/dashboard/[eventId] (live, studio/live-studio-control, studio/patiktok, orders, checkout, hosts, manpower, archive, paperwork, nikah, refer) · app/samahan.
 *
 * Rules every answer here obeys (each is held by a guard that reads this file):
 * - say what ships on main today, in the app's own words — no future, no typed
 *   price, credit count or tier boundary (read prices from the catalogue; point
 *   at setnayan.com/pricing or the supplier billing hub);
 * - "supplier", never "vendor"; plans are Event Plus · Event Pro · Event Ultra
 *   and Supplier Plus · Supplier Pro · Supplier Ultra;
 * - every slug is globally unique across lib/help/ and lib/help-admin/
 *   (lib/help-slugs-are-unique.test.ts);
 * - give an `appBody` where the web answer points at buying, Android or desktop
 *   (lib/help-in-the-app-sells-nothing.test.ts).
 *
 * lib/help.ts appends this file's topics after topics-existing.ts, in slot order.
 */
import type { HelpTopic } from '@/lib/help';

export const USER_3_TOPICS: HelpTopic[] = [];
