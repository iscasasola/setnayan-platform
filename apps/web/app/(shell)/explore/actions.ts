'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  resolvePrimaryHostEvent,
  recomputeReceptionAnchor,
  userHostsEvent,
} from '@/lib/events';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { vendorCategoryForLeaf } from '@/lib/vendor-packages';
import { canonicalServicesForTile } from '@/lib/vendor-counts';
import { cardForTile, type ShopCard } from '@/lib/bench-save-card';
import type { WeddingTile } from '@/lib/taxonomy';
import { getEventTypeVocab } from '@/lib/event-types-db';

// Iteration 0041 — email capture for Coming-Soon event_type interest.
// Mirrors the 0043 `notifyWhenWeddingTypeLaunches` pattern but indexed by
// event_type instead of ceremony_type. The form lives on the /vendors
// empty-state banner that PR #184 added, fires when no vendors match the
// active event_type filter.
//
// user_id is stamped when the action is invoked with an authenticated
// session; anonymous submissions persist email only. Both paths use the
// admin client to bypass RLS on insert — the policy on
// couple_event_type_notify_signups grants INSERT to anon + auth anyway,
// but admin client keeps the signature identical to other "submit and
// confirm" forms in the app.


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NotifyResult =
  | { status: 'ok' }
  | { status: 'invalid_email' }
  | { status: 'invalid_event_type' }
  | { status: 'error'; message: string };

export async function notifyWhenEventTypeLaunches(formData: FormData): Promise<NotifyResult> {
  const rawEmail = String(formData.get('email') ?? '').trim();
  const rawEventType = String(formData.get('event_type') ?? '').trim();

  if (!EMAIL_REGEX.test(rawEmail)) {
    return { status: 'invalid_email' };
  }
  // DB-driven roster (2026-06-13): any ACTIVE event_type_vocab key is a
  // valid notify-me target. The vocab trigger on the table is the backstop.
  const vocab = await getEventTypeVocab();
  if (!vocab.some((t) => t.key === rawEventType)) {
    return { status: 'invalid_event_type' };
  }

  // Stamp user_id if the visitor is signed in; leave null for anonymous
  // browsers. Either way the row is valid per the RLS policy + the column
  // schema.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from('couple_event_type_notify_signups').insert({
    user_id: user?.id ?? null,
    email: rawEmail.toLowerCase(),
    event_type: rawEventType,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  // Marketplace page may want to repaint with a "thanks" banner — the
  // submitter's URL stays put so we revalidate the same path.
  revalidatePath('/explore');
  return { status: 'ok' };
}

// ============================================================================
// Save-vendor-to-picks (2026-05-20)
// ----------------------------------------------------------------------------
// Couple clicks "Save" on a marketplace vendor card or profile → we create an
// event_vendors row attached to their primary couple event, with
// marketplace_vendor_id pointing back at the canonical vendor_profiles row
// (iteration 0006/0022 — column added by migration 20260519200000).
//
// "Primary event" = the events row with is_primary=TRUE owned by this user.
// New couples always have exactly one primary event (created via the
// create-event flow). Multi-event couples can flip primary from their
// dashboard; saving always lands on whichever event is primary at the time
// of the click — matches the owner direction ("they will be logged on an
// event and it will always go there").
//
// Idempotent: if an event_vendors row for this (event_id, marketplace_vendor_id)
// already exists we return 'already_saved' instead of inserting a duplicate.
// There's no unique constraint on the pair today, so we check-then-insert.
// The tiny race window (two parallel saves) is acceptable for V1 — worst
// case the couple sees two rows under the same vendor name in their tracker.
// ============================================================================

export type SaveVendorResult =
  /**
   * `eventName` exists because Save is an EVENT-SCOPED action taken from a
   * screen that has no event on it (owner 2026-09-08: *"Save adds to a specific
   * event? this is a search result outside an event"*). The action resolves the
   * couple's PRIMARY host event and writes there. That is a reasonable default
   * and a terrible secret: a couple planning a wedding and a debut had no way to
   * learn which one just gained a supplier. The button says it now.
   */
  | { status: 'ok'; eventVendorId: string; eventName: string | null }
  | { status: 'already_saved'; eventVendorId: string; eventName: string | null }
  | { status: 'not_signed_in' }
  | { status: 'no_primary_event' }
  /**
   * An `event_id` was supplied and this user does not host it. Distinct from
   * every other refusal on purpose — the caller can say "that is not your
   * event" instead of the catch-all "we couldn't save that vendor".
   */
  | { status: 'not_your_event' }
  | { status: 'vendor_not_found' }
  | { status: 'error'; message: string };

function coerceCategory(services: ReadonlyArray<string>): VendorCategory {
  /**
   * ── WHY THIS STOPPED USING `resolveVendorCategory` (measured 2026-09-08) ──
   * A shop was saved to a couple's shortlist with `category = 'misc'`, so the
   * bench's **Live Band** row — which looks for `live_band` — could not show a
   * supplier the couple had just inquired with. The same fallback rendered
   * "INQUIRING ABOUT: Miscellaneous" on the thread header.
   *
   * `resolveVendorCategory` says so in its own docblock: *"LEAF-KEYED, AND IT
   * COVERS 52 OF 246 LIVE LEAVES … Do NOT reach for it to classify an arbitrary
   * service — 194 live leaves land in `misc` here. Use `vendorCategoryForLeaf`
   * below, which falls back to the leaf's BRANCH and covers all of them."* This
   * function was reaching for exactly the one it warns about.
   *
   * And the owner ruled on the symptom on 2026-08-09: *"fix the taxonomy if
   * needed. we do not like having categories under misc."*
   *
   * 🔑 THE VALUE IS PASSED AS BOTH LEAF AND BRANCH ON PURPOSE.
   * `vendor_profiles.services` holds TILE IDS in production
   * (`lib/card-kind-labeller.ts` records this), and a tile id is exactly what
   * the branch arm wants. Measured:
   *
   *     live_band → band_dj    host_mc → host_emcee    cake → cake_maker
   *     dj        → band_dj    choir   → choir         florist → florist
   *
   * A value that IS a canonical leaf still resolves on the leaf arm first, so
   * correctly-stored shops are unaffected.
   */
  for (const s of services) {
    const resolved = vendorCategoryForLeaf(s, s);
    if (resolved !== 'misc') {
      return resolved;
    }
  }
  return 'misc';
}

export async function saveVendorToPicks(formData: FormData): Promise<SaveVendorResult> {
  const vendorProfileId = String(formData.get('vendor_profile_id') ?? '').trim();
  if (!vendorProfileId) {
    return { status: 'error', message: 'Missing vendor_profile_id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  const admin = createAdminClient();

  // 1. Resolve the user's primary host event across BOTH membership
  //    models — event_members (legacy 'couple') and event_moderators
  //    (iteration 0048 multi-host invite path). See
  //    resolvePrimaryHostEvent in @/lib/events for the rule.
  /**
   * ── THE EVENT THE CALLER IS STANDING IN WINS ─────────────────────────────
   * The bench is scoped to ONE event by its own URL. Re-deriving a "primary"
   * event here meant a pick made on event A's bench could land in event B —
   * silently, and correctly as far as any test was concerned.
   *
   * Measured 2026-09-08 on a real account holding TWO events flagged
   * `is_primary = true` (nothing enforces one): the resolver sorts primaries
   * first and takes `sorted[0]`, a stable sort over an unordered query, so
   * which event won was arbitrary per request.
   *
   * `/explore` genuinely has no event on it, so the primary fallback stays for
   * that caller. An id that IS supplied is a claim from a form, so it is
   * checked — `userHostsEvent` shares its definition of "hosts" with
   * `resolvePrimaryHostEvent`, so the two cannot disagree.
   */
  const requestedEventId = String(formData.get('event_id') ?? '').trim();

  let primaryEvent: { event_id: string; display_name: string | null };
  try {
    let resolvedEventId: string | null = null;
    if (requestedEventId) {
      if (!(await userHostsEvent(admin, user.id, requestedEventId))) {
        return { status: 'not_your_event' };
      }
      resolvedEventId = requestedEventId;
    } else {
      const resolved = await resolvePrimaryHostEvent(admin, user.id);
      resolvedEventId = resolved?.event_id ?? null;
    }
    if (!resolvedEventId) {
      return { status: 'no_primary_event' };
    }
    const resolved = { event_id: resolvedEventId };
    // The NAME is read here, next to the id it belongs to, so the two can never
    // describe different events. Best-effort: a save must not fail because a
    // label could not be read.
    const { data: named } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', resolved.event_id)
      .maybeSingle();
    primaryEvent = {
      event_id: resolved.event_id,
      display_name:
        (named as { display_name?: string | null } | null)?.display_name ?? null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown resolution error';
    return { status: 'error', message };
  }

  // 2. Load the vendor profile (name + services for category mapping +
  //    HQ coords so we can anchor the event's venue if this is a venue pick).
  const { data: vendor, error: vError } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, services, hq_latitude, hq_longitude')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (vError) {
    return { status: 'error', message: vError.message };
  }
  if (!vendor) {
    return { status: 'vendor_not_found' };
  }

  /*
    2b. WHICH CARD (owner's test round 1, 2026-09-11). A bench row or sheet says
    which tile the couple is browsing ("More in Live Band"); the save is then
    for the shop's card IN that tile, not for the shop. Its category comes from
    that card, and service_id records it — so a two-service shop saved from its
    second tile is filed there, the inquiry anchors on that card, and the saved
    card shows that card's cover, price and inclusions. /explore sends no tile
    and keeps the shop-level behaviour below.
  */
  const tile = String(formData.get('tile') ?? '').trim();
  let tileCard: ShopCard | null = null;
  if (tile) {
    const { data: cards } = await admin
      .from('vendor_services')
      .select('vendor_service_id, category, created_at')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true);
    tileCard = cardForTile((cards ?? []) as ShopCard[], tile, canonicalServicesForTile(tile as WeddingTile));
  }
  const tileCategory: VendorCategory | null = (() => {
    if (!tileCard?.category) return null;
    const c = vendorCategoryForLeaf(tileCard.category, tile);
    return c === 'misc' ? null : c;
  })();

  // 3. Already saved? Return idempotently.
  const { data: existing } = await admin
    .from('event_vendors')
    .select('vendor_id, category, service_id')
    .eq('event_id', primaryEvent.event_id)
    .eq('marketplace_vendor_id', vendorProfileId)
    .maybeSingle();
  if (existing?.vendor_id) {
    // A row saved before cards were recorded gets its card now — but only when
    // the card agrees with where the row already sits, so a re-save never
    // MOVES a pick between tiles behind the couple's back.
    if (tileCard && existing.service_id == null && tileCategory && existing.category === tileCategory) {
      await admin
        .from('event_vendors')
        .update({ service_id: tileCard.vendor_service_id })
        .eq('vendor_id', existing.vendor_id)
        .is('service_id', null);
    }
    return {
      status: 'already_saved',
      eventVendorId: existing.vendor_id,
      eventName: primaryEvent.display_name,
    };
  }

  // 4. Insert. Stamp source='host_manual' so any auto-cascade "added for
  // you" badge doesn't fire on rows the host added themselves from the
  // /vendors marketplace.
  const category = tileCategory ?? coerceCategory((vendor.services ?? []) as string[]);
  const { data: inserted, error: iError } = await admin
    .from('event_vendors')
    .insert({
      event_id: primaryEvent.event_id,
      marketplace_vendor_id: vendorProfileId,
      category,
      service_id: tileCard?.vendor_service_id ?? null,
      vendor_name: vendor.business_name,
      status: 'considering',
      source: 'host_manual',
    })
    .select('vendor_id')
    .single();
  if (iError || !inserted) {
    return { status: 'error', message: iError?.message ?? 'Insert failed' };
  }

  // 5. Re-anchor "ground 0" — the reception venue every other vendor's
  // distance is measured from (CLAUDE.md 2026-06-02 directive 3 · the anchor
  // column was locked 2026-05-20). When this save is a reception pick
  // (category='venue'), recompute events.venue_latitude/longitude from the
  // current reception picks: a LOCKED reception wins, else the oldest
  // 'considering' (stable first-saved-wins). recomputeReceptionAnchor also
  // resolves admin-seeded venues (venue_directory.hq_*), which the old inline
  // first-saved path missed. Best-effort — never throws.
  if (category === 'venue') {
    await recomputeReceptionAnchor(admin, primaryEvent.event_id);
  }

  // Repaint both the marketplace (button → "Saved" · distance chips
  // update if venue just got anchored) and the couple home (12-group
  // planner now shows the new pick).
  revalidatePath('/explore');
  revalidatePath(`/v/`);
  revalidatePath(`/dashboard/${primaryEvent.event_id}`);

  return {
    status: 'ok',
    eventVendorId: inserted.vendor_id,
    eventName: primaryEvent.display_name,
  };
}

// ============================================================================
// Add-venue-directory-entry-to-plan (2026-05-21)
// ----------------------------------------------------------------------------
// PairedVenuePanel "Add to plan" button calls this with a venue_directory_id.
// Distinct from saveVendorToPicks above because venue_directory and
// vendor_profiles have parallel but non-aligned slug spaces (per migration
// 20260530000000), so we can't reliably resolve directory entries to
// marketplace vendors. Instead we link via the new
// event_vendors.source_venue_directory_id column.
//
// Category mapping is unambiguous because venue_directory.venue_type already
// encodes ceremony-vs-reception intent: religious_venue for any faith
// chapel + civil registrar, venue for hotels/gardens/beach/heritage. The
// couple can re-categorize manually in their planner if a garden is
// actually serving as their ceremony venue.
//
// Idempotent via the unique partial index on (event_id, source_venue_directory_id).
// ============================================================================

export type AddVenueToPlanResult =
  | { status: 'ok'; eventVendorId: string }
  | { status: 'already_added'; eventVendorId: string }
  | { status: 'not_signed_in' }
  | { status: 'no_primary_event' }
  | { status: 'venue_not_found' }
  | { status: 'error'; message: string };

function venueDirectoryTypeToCategory(venueType: string): VendorCategory {
  switch (venueType) {
    case 'catholic_church':
    case 'christian_church':
    case 'inc_chapel':
    case 'mosque':
    case 'cultural_site':
    case 'civil_registrar':
    case 'temple':
      return 'religious_venue';
    case 'hotel_ballroom':
    case 'restaurant':
    case 'garden':
    case 'beach':
    case 'destination_resort':
    case 'heritage':
    case 'outdoor_tent':
      return 'venue';
    default:
      return 'venue';
  }
}

export async function addVenueDirectoryEntryToPlan(
  formData: FormData,
): Promise<AddVenueToPlanResult> {
  const venueDirectoryId = String(formData.get('venue_directory_id') ?? '').trim();
  if (!venueDirectoryId) {
    return { status: 'error', message: 'Missing venue_directory_id' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  const admin = createAdminClient();

  // 1. Resolve the user's primary host event across BOTH membership
  //    models (legacy event_members 'couple' + iteration 0048
  //    event_moderators invite path). Same helper as saveVendorToPicks.
  let primaryEvent: { event_id: string };
  try {
    const resolved = await resolvePrimaryHostEvent(admin, user.id);
    if (!resolved) {
      return { status: 'no_primary_event' };
    }
    primaryEvent = { event_id: resolved.event_id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown resolution error';
    return { status: 'error', message };
  }

  // 2. Load the directory row (name + venue_type drives the category;
  //    coords let us anchor the reception slot for non-religious venues).
  const { data: venue, error: vError } = await admin
    .from('venue_directory')
    .select('venue_directory_id, name, venue_type, hq_latitude, hq_longitude')
    .eq('venue_directory_id', venueDirectoryId)
    .maybeSingle();
  if (vError) {
    return { status: 'error', message: vError.message };
  }
  if (!venue) {
    return { status: 'venue_not_found' };
  }

  // 3. Already added? Idempotent return — the unique partial index would
  //    catch this on INSERT, but we short-circuit for the cleaner UX.
  const { data: existing } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', primaryEvent.event_id)
    .eq('source_venue_directory_id', venueDirectoryId)
    .maybeSingle();
  if (existing?.vendor_id) {
    return { status: 'already_added', eventVendorId: existing.vendor_id };
  }

  // 4. Insert. Stamp source='host_manual' so any auto-cascade "added for
  // you" badge doesn't fire on rows the host added themselves from
  // PairedVenuePanel.
  const category = venueDirectoryTypeToCategory(venue.venue_type as string);
  const { data: inserted, error: iError } = await admin
    .from('event_vendors')
    .insert({
      event_id: primaryEvent.event_id,
      source_venue_directory_id: venueDirectoryId,
      category,
      vendor_name: venue.name,
      status: 'considering',
      source: 'host_manual',
    })
    .select('vendor_id')
    .single();
  if (iError || !inserted) {
    return { status: 'error', message: iError?.message ?? 'Insert failed' };
  }

  // 5. Anchor the reception venue lat/lng if this is a reception-type pick
  //    and the event has no anchor yet. Religious venues never anchor the
  //    "reception" coordinate — that's the slot reserved for hotels /
  //    gardens / beach / etc. per the saveVendorToPicks convention.
  const venueHasCoords =
    venue.hq_latitude !== null && venue.hq_longitude !== null;
  if (category === 'venue' && venueHasCoords) {
    await admin
      .from('events')
      .update({
        venue_latitude: venue.hq_latitude,
        venue_longitude: venue.hq_longitude,
      })
      .eq('event_id', primaryEvent.event_id)
      .is('venue_latitude', null);
  }

  revalidatePath('/explore');
  revalidatePath('/v/');
  revalidatePath(`/dashboard/${primaryEvent.event_id}`);

  return { status: 'ok', eventVendorId: inserted.vendor_id };
}

