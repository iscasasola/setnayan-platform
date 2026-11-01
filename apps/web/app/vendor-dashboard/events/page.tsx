import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/events — 🗂 "Events you run" FOLDED INTO HUB (owner 2026-10-29, DECISION_LOG "THE SUPPLIER'S BOTTOM
 * BAR = TODAY · CUSTOMERS · SHOP · HUB — 'EVENTS' FOLDS INTO HUB": *"old /vendor-dashboard/events links forward to
 * Hub"*). Every event this person runs as the hosts' coordinator is now an option in the Hub's ▾, marked "You run it",
 * with its pages under "The event's pages". A bookmark lands on the Hub; nothing is lost on the way.
 */
export default function EventsYouRunPage(): never {
  redirect('/vendor-dashboard/on-the-day');
}
