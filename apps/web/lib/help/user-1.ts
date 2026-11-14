/**
 * HELP SLOT H3 — host areas U1–U11.
 *
 * Owned by ONE answer-writing session (H3); no other session edits this file.
 * Covers: Home · guests · check-in · sponsors · join requests · schedule · the date finder · budget · suppliers · contracts · messages.
 * Where those live in the app: app/dashboard/[eventId] (page, guests, sponsors, access-requests, schedule, find-date, date-selection, budget, vendors, contracts, messages, event-qr).
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

export const USER_1_TOPICS: HelpTopic[] = [];
