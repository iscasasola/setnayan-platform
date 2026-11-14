/**
 * HELP SLOT H1 — supplier areas S1–S9 and S22.
 *
 * Owned by ONE answer-writing session (H1); no other session edits this file.
 * Covers: sign-up and opening a shop · Today · the setup checklist · verification · the shop page · service cards · packages · pricing basis · the booking fee · plans (Supplier Plus · Supplier Pro · Supplier Ultra).
 * Where those live in the app: app/open-shop · app/vendor-dashboard (page, verify, shop, services, packages, booking-fees, subscription, settings) · app/v/[slug].
 * Also repoints the "How booking works" row in app/vendor-dashboard/settings/settings-rows.ts at the new answer.
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

export const SUPPLIER_1_TOPICS: HelpTopic[] = [];
