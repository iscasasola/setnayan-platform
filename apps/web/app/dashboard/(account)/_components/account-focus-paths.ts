/**
 * The account pages whose rail FOCUSES on their own menu (owner 2026-09-21:
 * "same concept when on memories, people, shop, and admin"). Every other
 * account page — profile, notifications, your story, the year — keeps the full
 * rail. A plain module, not the client component, because the server layout
 * reads it: a non-component export of a 'use client' file reaches a server
 * component as a reference, not as this array.
 *
 * `AccountRailContext` switches on the same prefixes; they must stay in step,
 * which `app/_components/frontdoor/rail-focus.test.ts` holds.
 */
export const ACCOUNT_FOCUS_PATHS = [
  '/dashboard/library',
  '/dashboard/people',
  '/dashboard/samahan',
] as const;
