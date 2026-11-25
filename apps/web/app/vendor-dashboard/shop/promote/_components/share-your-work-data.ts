import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories, type VendorFeaturedStory } from '@/lib/realstories-vendor';
import { loadVendorRecaps, type VendorRecap } from '@/lib/recap-vendor';
import { canUseSoloBusinessTools } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled, readVendorTier } from '@/lib/vendor-feature-gate';
import { logQueryError } from '@/lib/supabase/error-detect';
import { effectiveSeoTier } from '@/lib/vendor-seo-tier';
import { hasStoryPages } from '@/lib/ultra-story-pages';

/**
 * 📣 SHARE YOUR WORK — the reads of Shop › Promote row 4 (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE
 * TOOL": real stories + recaps with their Facebook / Pinterest / share / copy / story-card buttons, IN Promote).
 *
 * The SAME loaders the two retired pages used (`/vendor-dashboard/real-stories` · `/vendor-dashboard/recaps`, which now
 * forward to `/vendor-dashboard/shop/promote#share`), with ONE pool read shared by both lists instead of one each.
 * Recaps keep their Solo gate (the old page's `VendorTierGate`, same rule). A thrown read is `null` → "Couldn’t load",
 * never "none".
 */
export type ShareYourWorkData = {
  /** null = the read failed (said, never "none"). */
  stories: VendorFeaturedStory[] | null;
  /** null = the read failed. Empty when `recapsGated`. */
  recaps: VendorRecap[] | null;
  /** The plan gate is on and the shop's plan is below Solo — recap sharing is a Solo feature (unchanged rule). */
  recapsGated: boolean;
  /**
   * 📖 ULTRA STORY PAGES (owner 2026-11-14, item 8) — null unless the shop is on Ultra (effective tier). Then each
   * story row gets its "In our words" note and a link to the shop's own page for it. `notes` is keyed by event id;
   * 🛑 a REFUSED notes read is `notes: null`, never an empty map: an empty box is SAVEABLE, and a blank save deletes
   * the note — so a supplier could wipe a published note they never saw (supplier audit 2026-11-17, S-5).
   */
  ultra?: { shopSlug: string; notes: Record<string, string> | null } | null;
};

/** The notes part, unread: drawn as "couldn't load" per story, never a saveable box (S-5). */
const UNREAD_ULTRA = { shopSlug: '', notes: null } as const;

async function loadUltraStoryNotes(supabase: SupabaseClient, vendorProfileId: string): Promise<ShareYourWorkData['ultra']> {
  const { data: shop, error } = await supabase
    .from('vendor_profiles')
    .select('business_slug, tier_state, tier_expires_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) {
    logQueryError('ShareYourWork.ultra', error, { vendorProfileId }, 'graceful_degrade');
    // 🪪 Refused, the plan is unknown: the notes part says it could not load (the `notes: null` branch draws
    // "couldn't load", never a box), instead of the Ultra notes silently vanishing (final check A5-G4-11).
    return UNREAD_ULTRA;
  }
  const row = shop as { business_slug: string | null; tier_state: string | null; tier_expires_at: string | null } | null;
  if (!row?.business_slug || !hasStoryPages(effectiveSeoTier(row))) return null;
  const { data: noteRows, error: notesErr } = await supabase
    .from('vendor_event_story_notes')
    .select('event_id, body')
    .eq('vendor_profile_id', vendorProfileId);
  if (notesErr) {
    logQueryError('ShareYourWork.notes', notesErr, { vendorProfileId }, 'graceful_degrade');
    return { shopSlug: row.business_slug, notes: null };
  }
  const notes: Record<string, string> = {};
  for (const n of (noteRows ?? []) as { event_id: string; body: string }[]) notes[n.event_id] = n.body;
  return { shopSlug: row.business_slug, notes };
}

export async function loadShareYourWork(supabase: SupabaseClient, vendorProfileId: string): Promise<ShareYourWorkData> {
  // 🪪 'unread' = the plan read was refused: the recaps part is then "couldn't load", never opened on a guess
  // (final check A5-G4-11).
  const gatedRead: Promise<boolean | 'unread'> = isVendorFeatureGateEnabled()
    ? readVendorTier(supabase, vendorProfileId).then(({ tier }) => (tier === 'unread' ? 'unread' : !canUseSoloBusinessTools(tier)))
    : Promise.resolve(false);

  // LEFT ON THE POOL READ, ON PURPOSE — and NOT because this is capacity. It is the same "which events did this shop
  // work" question the day-of screens ask, one screen over. It feeds loadVendorFeaturedStories, whose output the shop
  // can promote onto its PUBLIC page, so widening it here would put an agreed-but-unpaid booking one click from
  // strangers — the same leak app/v/[slug] is guarded against. Widening needs that gate first. (Moved here, with its
  // reason, from the two retired pages, 2026-11-06.)
  const eventIdsRead = fetchVendorPoolBookings(supabase, vendorProfileId).then((bookings) => bookings.map((b) => b.eventId));

  const [gate, eventIds, ultra] = await Promise.all([
    gatedRead.catch(() => 'unread' as const),
    eventIdsRead.catch((err) => {
      logQueryError('ShareYourWork.bookings', err, { vendorProfileId }, 'graceful_degrade');
      return null;
    }),
    loadUltraStoryNotes(supabase, vendorProfileId).catch(() => UNREAD_ULTRA),
  ]);
  const recapsGated = gate === true;
  const planUnread = gate === 'unread';
  if (eventIds === null) return { stories: null, recaps: null, recapsGated };

  const [stories, recaps] = await Promise.all([
    loadVendorFeaturedStories(eventIds).catch((err) => {
      logQueryError('ShareYourWork.stories', err, { vendorProfileId }, 'graceful_degrade');
      return null;
    }),
    planUnread
      ? Promise.resolve(null)
      : recapsGated
      ? Promise.resolve([] as VendorRecap[])
      : loadVendorRecaps(eventIds).catch((err) => {
          logQueryError('ShareYourWork.recaps', err, { vendorProfileId }, 'graceful_degrade');
          return null;
        }),
  ]);
  return { stories, recaps, recapsGated, ultra };
}
