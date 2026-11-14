/**
 * HELP SLOT H4 — host areas U12–U18 and U21–U24.
 *
 * Owned by ONE answer-writing session (H4); no other session edits this file.
 * Covers: seat plan and 3D · mood board · the Event Hub Maker · Details · invitations · prints · Papic · Music Maker · Memories · Story · E-Gifts.
 * Where those live in the app: app/dashboard/[eventId] (seating, plan3d, invitation, website, details, prints, memories, galleries, story, pabuya) · studio (papic, pakanta, mood-board).
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

export const USER_2_TOPICS: HelpTopic[] = [];
