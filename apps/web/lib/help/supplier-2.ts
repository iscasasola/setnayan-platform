/**
 * HELP SLOT H2 — supplier areas S10–S21.
 *
 * Owned by ONE answer-writing session (H2); no other session edits this file.
 * Covers: Clients · inquiries · quotes and proposals · the negotiation chat · bookings · deposits and getting paid · schedules and the calendar · files and contracts · portfolio and albums · QR · reviews · team and crew · storage.
 * Where those live in the app: app/vendor-dashboard (clients, customers, proposals, offers, messages, bookings, payday, earnings, payment-options, calendar, on-the-day, contracts, forms, real-stories, recaps, locked-qr, reviews, team, manpower, branches).
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

export const SUPPLIER_2_TOPICS: HelpTopic[] = [];
