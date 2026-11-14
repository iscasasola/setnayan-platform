/**
 * HELP SLOT H6 — host areas U31, U33–U35 and every guest area UG1–UG10.
 *
 * Owned by ONE answer-writing session (H6); no other session edits this file.
 * Covers: U31, U33–U35 per the coverage map · as a guest: the invite · RSVP · the Event Hub · the day itself · Papic as a guest · the live wall · the story · gifts · joining.
 * Where those live in the app: app/[slug] (invite, hub, welcome, find-my-table, seat, live-wall, recap, pabuya, request) · app/join.
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

export const USER_4_TOPICS: HelpTopic[] = [];
