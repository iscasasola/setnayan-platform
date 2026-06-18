import type { SupabaseClient } from '@supabase/supabase-js';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';

/**
 * apps/web/lib/animated-monogram.ts
 *
 * Ownership gate for the paid ANIMATED_MONOGRAM SKU (₱2,499 · "Your initials,
 * drawn live" · v2.1 brief § 5 + Onboarding Blueprint §3.3). Every event ships
 * with a FREE auto-generated text monogram (the "M & J" circle — lib/monogram.ts
 * + EventMonogram); this resolves whether the event has also bought the paid
 * Animated Monogram upgrade, which makes that same monogram draw itself on the
 * couple's surfaces with an SVG stroke-trace reveal on page load.
 *
 * WHY · v2-catalog.ts marks ANIMATED_MONOGRAM 'partial' — "V1 monogram tools
 *       exist · not bound to this SKU". The free monogram + the monogram tools
 *       work; this is the missing gating so a couple who owns a paid
 *       ANIMATED_MONOGRAM order unlocks the animated render.
 *
 * SKU DISAMBIGUATION (load-bearing — two monogram SKUs exist):
 *   • ANIMATED_MONOGRAM (₱2,499 · V2 catalog · THIS file) — "Your initials,
 *     drawn live." The standalone stroke-trace draw-on reveal applied to the
 *     event's AUTO-GENERATED text monogram (no upload, no video background).
 *     Drives the animated render on the V2 catalog surfaces (landing-page hero
 *     + the /add-ons/animated-monogram detail page).
 *   • monogram_hero_upgrade (₱1,999 · iteration 0004 "Monogram Hero") — a
 *     WIDGET upgrade on the hero_monogram invitation widget that ALSO does a
 *     trace, but bundles a custom video/photo BACKGROUND + SVG/PNG-upload via
 *     Potrace, and is gated by the invitation_widgets.tier flip from the
 *     apply-then-pay reconciliation hook. That path is the Website-tab widget
 *     editor and is NOT touched here.
 *
 * Binding ANIMATED_MONOGRAM ownership to the auto-text-monogram animated render
 * leaves the 0004 Monogram Hero widget path completely undisturbed.
 *
 * Detection — same owned-orders pattern eventOwnsProWebsite() uses and the
 * Website tab uses for the iteration-0004 widget upgrades
 * (apps/web/app/dashboard/[eventId]/website/page.tsx:124 + _components/
 * pro-upgrade-panel.tsx): an `orders` row with service_key='ANIMATED_MONOGRAM'
 * whose status is NOT cancelled / refunded / lapsed. A still-in-reconciliation
 * 'submitted' order counts as owned so the couple can't double-buy while their
 * payment is being verified.
 *
 * The canonical service_key is the V2 catalog code 'ANIMATED_MONOGRAM'
 * (uppercase), exactly what the inline-checkout drawer stamps on the order via
 * submitOrderAction (apps/web/app/dashboard/[eventId]/checkout/actions.ts).
 *
 * SAFETY · This helper queries the existing `orders` table — no new table, no
 * migration. Graceful-degrade on a missing/changed `orders` table (42P01
 * undefined_table · 42703 undefined_column) so a pre-bootstrap database
 * resolves to "not owned" (the safe default — static monogram, upgrade CTA)
 * instead of crashing. Matches the PR #380/#390 + website/page.tsx hotfix
 * pattern + eventOwnsProWebsite.
 */

export const ANIMATED_MONOGRAM_SERVICE_KEY = 'ANIMATED_MONOGRAM';

/**
 * Does this event own the paid Animated Monogram upgrade?
 *
 * Delegates to the shared bundle-aware eventOwnsSku() reader (lib/entitlements.ts)
 * — refund-aware, graceful-degrade on a missing orders table so callers fall
 * back to the static monogram + the upgrade CTA rather than throwing. Bundle-
 * aware so a couple who bought ANIMATED_MONOGRAM inside the Essentials
 * (GUIDED_PACK) or Complete (MEDIA_PACK) bundle — which lands as a single
 * bundle-keyed order, not a child ANIMATED_MONOGRAM order — still unlocks the
 * animated render (matches the papic-seats / papic-guest gate pattern).
 */
export async function eventOwnsAnimatedMonogram(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, ANIMATED_MONOGRAM_SERVICE_KEY);
}

/**
 * Is the paid Animated Monogram ACTIVE (admin-approved)? The handshake FEATURE
 * GATE — the monogram draws live only after the Setnayan team verifies the
 * payment (owner 2026-06-18). The buy surface keeps eventOwnsAnimatedMonogram.
 */
export async function eventAnimatedMonogramActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventSkuActive(supabase, eventId, ANIMATED_MONOGRAM_SERVICE_KEY);
}
