/**
 * customer-nav-slot-keys.ts — which admin nav-registry slot governs which nav
 * item, for the customer's event menu.
 *
 * ⚠ NO `'use client'`, AND THAT IS THE WHOLE REASON THIS FILE EXISTS. These two
 * maps used to sit in `customer-sidebar.tsx`, which is a client component
 * because it renders. `event-rail-match-rows.ts` needs the HIDDEN rule from a
 * server layout, and a hand-copied second map would be two answers to one
 * question — an admin hiding a row would see it vanish from the sidebar and
 * stay matchable in the rail, with nothing thrown.
 *
 * Moved verbatim, re-exported by `customer-sidebar.tsx` so every existing
 * caller is untouched. Nothing here changed but its address.
 */
import type { NavSlotLite } from '@/lib/nav-registry-types';

export type { NavSlotLite };

/**
 * Maps the five top-level tab item keys → their admin nav-registry slot keys.
 * Matches the unified 5-tab structure in customer-nav-config.ts.
 */
export const SIDEBAR_SLOT_KEYS: Record<string, string> = {
  home: 'customer.sidebar.home',
  guests: 'customer.sidebar.guests',
  explore: 'customer.sidebar.explore',
  studio: 'customer.sidebar.studio',
  launch: 'customer.sidebar.launch',
  // (No 'budget' — the top-level Budget item was removed 2026-07-10; its
  // customer.sidebar.budget registry slot was already retired.)
};

/**
 * Maps all child item keys → their registry slot keys. Covers the five
 * guest-journey stages plus every other sub-page nested under a top-level tab.
 * Items absent here (e.g. "Checklist") have no registry slot and pass through
 * with their hardcoded label/icon.
 */
export const CHILD_SLOT_KEYS: Record<string, string> = {
  // (Overview's old schedule/messages/contracts children were flattened #3004;
  // their CHILD_SLOT_KEYS entries were dead and were removed 2026-07-10.)
  // Guests children — five journey stages
  build: 'customer.sidebar.guests-build',
  invite: 'customer.sidebar.guests-invite',
  confirm: 'customer.sidebar.guests-confirm',
  seat: 'customer.sidebar.seating',
  dayof: 'customer.sidebar.guests-dayof',
  'event-qr': 'customer.sidebar.event-qr',
  // Studio children
  'event-page': 'customer.sidebar.event-page',
  website: 'customer.sidebar.website',
  'mood-board': 'customer.sidebar.mood-board',
  monogram: 'customer.sidebar.monogram',
  live: 'customer.sidebar.live',
  // Budget children — retained even though the top-level Budget item was removed
  // 2026-07-10: the customer.sidebar.activity/disputes registry slots are kept
  // (routes still valid), so these mappings stay so a re-surfaced Activity /
  // Disputes link renders its admin-editable label + icon.
  activity: 'customer.sidebar.activity',
  disputes: 'customer.sidebar.disputes',
};

