import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import {
  isMoodboardStyleFamily,
  type MoodboardStyleFamily,
} from '@/lib/moodboard-templates';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchGuestsByEvent,
  guestDisplayName,
  resolveGuestAttire,
  fetchGuestGroupsByEvent,
  fetchGroupMembershipsByEvent,
} from '@/lib/guests';
import {
  fetchTables,
  fetchAssignments,
  fetchFloorPlan,
  fetchSeatingConstraints,
  fetchSceneObjects,
  fetchBooths,
  fetchSigns,
  defaultPriorityOrder,
  guestTier,
  defaultTablePosition,
} from '@/lib/seating';
import {
  shapeHintFor,
  VENUE_OBJECT_CATALOG,
  type Lab3DTable,
  type Lab3DFloor,
  type Lab3DFloorExtras,
  type Lab3DGuest,
  type Lab3DGroup,
  type Lab3DMonogram,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
  type VenueObjectKind,
} from '@/lib/seating-3d';
import { fetchBoothCardItems } from '@/lib/vendor-services';
import { resolveMonogram } from '@/lib/monogram';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import type { VendorCategory } from '@/lib/vendors';
import { PLAN3D_BOOTH_ADS_ENABLED, placedGhostBooths, type GhostBooth3D } from '@/lib/ghost-booths';
import { displayUrlForStoredAsset, guestPhotoDisplayUrls } from '@/lib/uploads';
import {
  sanitizeRolePalette,
  resolveAttirePaletteColor,
  sideAttireColor,
} from '@/lib/mood-board';
import { resolveDisplayPalette } from '@/lib/room-palette';
import {
  finalizedPartsNow,
  type PartFinalizationRecord,
} from '@/lib/moodboard-finalization-rows';
import { renderPartById } from '@/lib/moodboard-render-parts';
import { INSPIRATION_SLOT_FOR_PART } from '@/lib/moodboard-slots';
import { sanitizeReceptionDesign } from '@/lib/reception-scene';
import { SeatingLabLoader } from './_components/seating-lab-loader';
import { Couple3dPlanUnlockNotice } from './_components/couple-3d-plan-unlock-notice';
import { Couple3dPlanBuy } from './_components/couple-3d-plan-buy';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';

export const metadata = { title: 'Seating · 3D lab (prototype)' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * 3D seating lab — a 3D editor that renders the couple's real plan as a
 * navigable 3D room ("Sims build" + walk-to-seat). On for every couple by
 * default; `NEXT_PUBLIC_SEATING_3D='false'` is the kill-switch (→ 404, so the
 * route disappears) if the prototype needs pulling in production.
 * Edits (move / rotate / delete / add) persist through the SAME single-editor
 * lock + server actions as the 2D editor, so 3D and 2D share one plan. See the
 * as-built doc `0008_Seating_AS_BUILT_2026-06-21.md` for the data contract.
 */
export default async function SeatingLabPage({ params }: Props) {
  if (process.env.NEXT_PUBLIC_SEATING_3D === 'false') notFound();

  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [tablesRaw, assignments, guestsRaw, floorPlan, constraints, sceneObjectsRaw, boothsRaw, signsRaw, groupsRaw, memberships, eventRow, roleSet, finalizationRes, vendorNameRes] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    fetchSeatingConstraints(supabase, eventId),
    fetchSceneObjects(supabase, eventId),
    fetchBooths(supabase, eventId),
    fetchSigns(supabase, eventId),
    fetchGuestGroupsByEvent(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
    // The couple's monogram columns — to render their canonical mark on the 3D
    // floor (animated-logo rollout). RLS already scopes this to the member; the
    // sibling seating/print route reads `events` by event_id the same way.
    supabase
      .from('events')
      .select(
        'display_name, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, role_palette, reception_design, venue_setting, moodboard_style_family, moodboard_theme_name',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    // Iteration 0053 P4 Unit 6: per-event-type role set for the 3D tier annotation.
    resolveRoleSetForEvent(eventId),
    // MB15 — the finalization handshakes on this board. The Reception Designer
    // below is the ONE editor of `events.reception_design`, so a part a supplier
    // agreed to has to stop moving HERE, not only on the mood board's panel. Read
    // with the same columns and the same shape the mood board reads, so both
    // surfaces answer "is this frozen" through `isPartFinalized` and there is one
    // predicate rather than two.
    supabase
      .from('moodboard_part_finalizations')
      .select('finalization_id, part_id, vendor_id, state, agreed_at')
      .eq('event_id', eventId),
    // Supplier NAMES for the label. Deliberately unfiltered by status: an agreed
    // row records who agreed, and a booking whose status later changed does not
    // un-say it — showing "Agreed with your supplier" with no name would be a
    // worse answer than the name on the row.
    supabase.from('event_vendors').select('vendor_id, vendor_name').eq('event_id', eventId),
  ]);

  // Tables created but never dragged onto the spatial canvas have null
  // x_pos/y_pos. Mirror the 2D editor's grid fallback (defaultTablePosition)
  // so the 3D room matches what the couple sees in 2D — Number(null) would
  // otherwise stack every un-positioned table in the back-left corner.
  const spread = !(floorPlan.venue_width_m && floorPlan.venue_length_m);
  const tables: Lab3DTable[] = tablesRaw.map((t, i) => {
    const positioned = t.x_pos != null && t.y_pos != null;
    const pos = positioned
      ? { x: Number(t.x_pos), y: Number(t.y_pos) }
      : defaultTablePosition(i, tablesRaw.length, spread);
    return {
      id: t.table_id,
      label: t.link_group_label ?? t.table_label,
      type: t.table_type,
      shape: shapeHintFor(t.table_type),
      capacity: t.capacity,
      removedSeats: t.removed_seats ?? [],
      xPct: pos.x,
      yPct: pos.y,
      rotationDeg: t.rotation_deg ?? 0,
      linkGroupId: t.link_group_id ?? null,
    };
  });

  const seatByGuest = new Map(assignments.map((a) => [a.guest_id, a]));

  // Guest photo_url is a stored r2:// ref (or a raw avatar URL) — resolve each to
  // a display URL so the 3D avatars wear the guest's actual selfie (owner
  // 2026-06-25). Mirrors the 2D seating page's resolver; signs in parallel.
  const photoDisplayUrls = await guestPhotoDisplayUrls(guestsRaw);

  // Attire motif colours from the mood-board role palette. TAXONOMY v2: each
  // guest's colour resolves through the STRICT chain (specific role palette key →
  // wedding_party → bride/groom SIDE colour → kit default) via
  // resolveAttirePaletteColor, per guest role + side (below). A couple who set
  // only `wedding_party` gets the identical result to the old GOWN bucket
  // (`wedding_party ?? bride`); suit-class attire, which the old code took from
  // groom/charcoal, now also degrades to `wedding_party` — the owner-locked v2
  // intent (mood-board.test.ts "wedding_party-only dresses gowns AND suits
  // identically"), NOT the old suit bucket.
  const rolePalette = sanitizeRolePalette((eventRow.data as Record<string, unknown> | null)?.role_palette);
  // MB15 — THE PALETTE SECTION 02 ACTUALLY SHOWS. `rolePalette` is the raw
  // JSONB, where a role the couple never hand-edited is simply ABSENT: the
  // attire chain then fell through to `wedding_party`, then to the bride/groom
  // side colour, and dressed a bridesmaid in a colour the board never displayed.
  // 02 renders those roles from the derived board; the room now reads the same
  // resolver, so the two surfaces cannot disagree. See lib/room-palette.ts.
  const displayPalette = resolveDisplayPalette(rolePalette);
  // Wave 2b: the couple's saved reception treatments + room archetype reach the
  // 3D lab (sanitized against the RECEPTION_PARTS vocabulary; default banquet_hall).
  const receptionDesign = sanitizeReceptionDesign((eventRow.data as Record<string, unknown> | null)?.reception_design);

  // The couple's own inspiration photos, keyed by the design part they belong
  // to. Uploaded during onboarding and on the mood board, and until now read by
  // no 3D surface at all: they picked a ceiling they loved, then chose a
  // ceiling treatment on another screen with the photo nowhere in sight.
  //
  // Only the FIVE parts that have a slot appear here (see
  // INSPIRATION_SLOT_FOR_PART) — a part with no slot gets no entry rather than
  // an unrelated photo. RLS scopes the read to this event.
  //
  // ⚠ `removed_at IS NULL` IS NOT OPTIONAL, AND THIS READ SHIPPED WITHOUT IT.
  // Every upload path replaces a cell by SOFT-DELETING the row that held it
  // (the partial UNIQUE(event_id, slot_key, slot_position) WHERE removed_at IS
  // NULL requires it), so an unfiltered read returns the photo the couple
  // REPLACED alongside the one they replaced it with — and the zone strip below
  // showed both, with nothing saying which was current. The mood board's own
  // read (studio/mood-board/page.tsx) has always filtered; this one did not.
  const inspirationRows = await supabase
    .from('event_inspiration_assets')
    .select('slot_key, slot_position, image_url')
    .eq('event_id', eventId)
    .is('removed_at', null)
    .order('slot_position', { ascending: true });
  const inspirationByPart: Record<string, string[]> = {};
  for (const [partId, slotKey] of Object.entries(INSPIRATION_SLOT_FOR_PART)) {
    const urls = (inspirationRows.data ?? [])
      .filter((r) => (r as { slot_key?: string }).slot_key === slotKey)
      .map((r) => (r as { image_url?: string }).image_url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    if (urls.length > 0) inspirationByPart[partId] = urls;
  }
  // ── MB15 · A PART THE SUPPLIER AGREED TO STOPS MOVING HERE TOO ───────────
  // The mood board's section 03 shows the handshake and links here to EDIT the
  // design. Until now the editor it links to knew nothing about it: a couple
  // could re-dress a ceiling their stylist had already signed off, in the only
  // place `reception_design` is edited, and neither surface would say a word.
  //
  // 🔑 ONE PREDICATE. `finalizedPartsNow` reads `isPartFinalized` — the same
  // function section 02/03's panel reads through `partFinalizationStateOf`.
  // Resolved to RECEPTION part ids here, on the server, through the registry:
  // `renderPartById` composes MB10's trade map on the way in, and a client
  // component that imported it would fail the production build.
  const vendorNameById = new Map<string, string>();
  for (const v of vendorNameRes.data ?? []) {
    const name = ((v as { vendor_name: string | null }).vendor_name ?? '').trim();
    if (name) vendorNameById.set((v as { vendor_id: string }).vendor_id, name);
  }
  const finalizedByPart: Record<string, { vendorName: string | null; agreedAt: string | null }> = {};
  for (const [partId, who] of finalizedPartsNow(
    (finalizationRes.data ?? []) as unknown as PartFinalizationRecord[],
    vendorNameById,
  )) {
    const part = renderPartById(partId);
    // Only ROOM parts have a reception zone to freeze. A `people:` or `place:`
    // agreement freezes colours, which `role_palette` already carries — it has
    // no design chip in this editor and must not silently claim one.
    if (!part || part.group !== 'room') continue;
    finalizedByPart[part.sourceKey] = who;
  }

  // MB15 — THE COUPLE'S OWN NAME FOR THIS ROOM. `events.moodboard_theme_name`
  // is what they typed on the mood board ("Coastal Dusk"); the lab has always
  // labelled the room from `display_name` or from nothing at all. Trimmed to
  // null so an empty string never renders as a blank heading.
  const themeName =
    ((eventRow.data as { moodboard_theme_name?: string | null } | null)?.moodboard_theme_name ?? '').trim() ||
    null;
  const venueSettingRaw = (eventRow.data as Record<string, unknown> | null)?.venue_setting;
  const venueSetting = typeof venueSettingRaw === 'string' && venueSettingRaw ? venueSettingRaw : 'banquet_hall';
  // WHICH theme family produced this board (events.moodboard_style_family,
  // migration 20271197327520) — written by applyMoodboardTemplate in both apply
  // modes. The reception decor AI-image layer pilot needs it: resolveDecorLayer
  // returns the flat SVG for a null family, which is what EVERY event got before
  // this column existed. Re-validated here against the shipped vocabulary rather
  // than trusted from the row, so a taxonomy the app no longer knows degrades to
  // "no family" (flat SVG) instead of reaching the lookup as an unknown key.
  const styleFamilyRaw = (eventRow.data as Record<string, unknown> | null)?.moodboard_style_family;
  const styleFamily: MoodboardStyleFamily | null = isMoodboardStyleFamily(styleFamilyRaw)
    ? styleFamilyRaw
    : null;

  const guests: Lab3DGuest[] = guestsRaw.map((g) => {
    const seat = seatByGuest.get(g.guest_id);
    const rsvp = (['attending', 'pending', 'maybe', 'declined'] as const).includes(
      g.rsvp_status as 'attending' | 'pending' | 'maybe' | 'declined',
    )
      ? (g.rsvp_status as 'attending' | 'pending' | 'maybe' | 'declined')
      : 'pending';
    const attire = resolveGuestAttire(g.role, g.attire);
    return {
      id: g.guest_id,
      name: guestDisplayName(g),
      seatedTableId: seat?.table_id ?? null,
      seatNumber: seat?.seat_number ?? null,
      tier: guestTier(g.role, g.group_category, g.seating_priority, roleSet),
      seatingPriority: g.seating_priority ?? null,
      groupId: memberships.get(g.guest_id)?.[0] ?? null,
      rsvp,
      side: g.side,
      plusOneAllowed: Boolean(g.plus_one_allowed),
      plusOneOfGuestId: g.plus_one_of_guest_id ?? null,
      photoUrl: g.photo_url ? photoDisplayUrls[g.photo_url] ?? null : null,
      attire,
      // Neutral silhouettes keep the RSVP-coloured token body (no motif); gown /
      // suit silhouettes resolve their motif through the taxonomy-v2 attire chain.
      attireColor:
        attire === 'neutral'
          ? null
          : resolveAttirePaletteColor(g.role, displayPalette, sideAttireColor(displayPalette, g.side)),
      // LAB-ONLY meal emote source (Fable §3.6): meal_preference already rides
      // the couple-scoped fetchGuestsByEvent select (RLS scopes it to this
      // member's event, same as every guest field above) — boil it to a
      // boolean so only "picked a meal", never the choice, reaches the scene.
      mealChosen: g.meal_preference != null,
    };
  });

  // Custom guest groups (for "seat this whole group at a table"). Only groups
  // that actually have members are worth offering.
  const groups: Lab3DGroup[] = groupsRaw
    .filter((gr) => gr.member_count > 0)
    .map((gr) => ({ id: gr.group_id, label: gr.label, memberCount: gr.member_count }));

  const floor: Lab3DFloor = {
    venueWidthM: floorPlan.venue_width_m ?? null,
    venueLengthM: floorPlan.venue_length_m ?? null,
    stage: { xPct: floorPlan.stage_x, yPct: floorPlan.stage_y, wPct: floorPlan.stage_w, hPct: floorPlan.stage_h },
    entrance: {
      enabled: floorPlan.entrance_enabled,
      xPct: floorPlan.entrance_x,
      yPct: floorPlan.entrance_y,
      kind: floorPlan.entrance_kind,
      depthM: floorPlan.entrance_depth_m,
    },
    dance: {
      enabled: floorPlan.dance_enabled,
      xPct: floorPlan.dance_x,
      yPct: floorPlan.dance_y,
      wPct: floorPlan.dance_w,
      hPct: floorPlan.dance_h,
    },
    published: floorPlan.published_at != null,
  };

  // Fields the lab doesn't edit but must preserve on save (saveFloorPlan writes
  // the whole row) — the service door + the cocktail/waiting room.
  const floorExtras: Lab3DFloorExtras = {
    serviceEntranceEnabled: floorPlan.service_entrance_enabled,
    serviceEntranceX: floorPlan.service_entrance_x,
    serviceEntranceY: floorPlan.service_entrance_y,
    cocktailEnabled: floorPlan.cocktail_enabled,
    cocktailX: floorPlan.cocktail_x,
    cocktailY: floorPlan.cocktail_y,
    cocktailW: floorPlan.cocktail_w,
    cocktailH: floorPlan.cocktail_h,
    cocktailLabel: floorPlan.cocktail_label,
    cocktailVendorEdit: floorPlan.cocktail_vendor_edit,
    cocktailLinked: floorPlan.cocktail_linked,
  };

  // Placed venue fixtures — rendered read-only in 3D (the 2D editor owns edits).
  // Guard scene-object kinds against the canonical catalog so a future DB kind
  // (or a stale row) never breaks the union type; unknown kinds are dropped.
  const knownKinds = new Set<string>(VENUE_OBJECT_CATALOG.map((o) => o.kind));
  const sceneObjects: Lab3DSceneObject[] = sceneObjectsRaw
    .filter((o) => knownKinds.has(o.kind))
    .map((o) => ({
      id: o.object_id,
      kind: o.kind as VenueObjectKind,
      label: o.label,
      xPct: o.x_pct,
      yPct: o.y_pct,
      rotationDeg: o.rotation_deg,
    }));
  // Booths carry their offerings copy + booked-vendor business identity (Slice
  // B fields) so the lab's scene data matches the guest surfaces. Logo refs
  // resolve to display URLs the same way guest photos do above. Card items
  // (the kind-aware Menu / Set list / inclusions lines, booth-kit slice 4)
  // resolve through the couple-authed client: event_vendor → vendor_services →
  // vendor_service_inclusions, with package_inclusions + host_inclusions
  // fallbacks — RLS scopes every read to this member's event.
  const boothLogoRefs = [...new Set(boothsRaw.map((b) => b.vendor?.logo_url).filter((r): r is string => !!r))];
  const [boothLogoUrlEntries, boothCardItems] = await Promise.all([
    Promise.all(boothLogoRefs.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const)),
    fetchBoothCardItems(supabase, boothsRaw),
  ]);
  const boothLogoUrls: Record<string, string> = Object.fromEntries(
    boothLogoUrlEntries.filter((e): e is [string, string] => e[1] !== null),
  );
  const booths: Lab3DBooth[] = boothsRaw.map((b) => ({
    id: b.booth_id,
    kind: b.booth_type,
    label: b.label,
    xPct: b.x_pos,
    yPct: b.y_pos,
    offerings: b.offerings,
    cardItems: boothCardItems.get(b.booth_id) ?? null,
    vendor: b.vendor
      ? {
          name: b.vendor.vendor_name,
          category: b.vendor.category,
          logoUrl: b.vendor.logo_url ? boothLogoUrls[b.vendor.logo_url] ?? null : null,
          tier: b.vendor.tier,
          slug: b.vendor.slug,
          bookable: b.vendor.bookable,
          // Paid 3D Booth add-on entitlement (owner 2026-07-22) → gates branding
          // in the couple's own lab, same boothIsBranded gate as the guest walk.
          boothAddonActive: b.vendor.boothAddonActive,
        }
      : null,
  }));
  const signs: Lab3DSign[] = signsRaw.map((s) => ({
    id: s.sign_id,
    label: s.label,
    xPct: s.x_pos,
    yPct: s.y_pos,
    rotationDeg: s.rotation_deg,
  }));

  // The couple's canonical mark for the 3D floor medallion. Precedence mirrors
  // the public hero (owner rule 2026-06-15): an uploaded SVG outranks the
  // AI/Cipher mark, which outranks the lettered lockup/initials. resolveMonogram
  // derives initials from display_name when no monogram_text is set, so the
  // config branch always yields a mark — no separate fallback needed. null only
  // when the event row is missing (e.g. RLS/race) → the scene renders mark-free.
  const event = eventRow.data;
  // SEC-3: gated on read — events.monogram_* are host-writable via PostgREST.
  const bespoke = resolveEventMonogramSvg(event);
  const monogram: Lab3DMonogram = event
    ? bespoke
      ? { kind: 'svg', svg: bespoke }
      : { kind: 'config', monogram: resolveMonogram(event) }
    : null;

  // Paid ANIMATED_MONOGRAM gate — when owned, the floor medallion blooms in as
  // the Play-mode camera settles (free events keep the static mark, so the
  // seat-plan tool stays free). A missing orders table/column resolves to false
  // (no bloom); other read errors propagate, matching the codebase pattern.
  const ownsAnimatedMonogram = await eventAnimatedMonogramActive(supabase, eventId);

  // 3D Booth Ads · Part A (slice 9, flag-gated): dashed "ghost booths" for the
  // vendor categories this couple hasn't booked, placed on free perimeter wall
  // (never overlapping real booths/tables). DERIVED — never persisted; couple
  // lab ONLY (the guest walk never receives these). The read is skipped entirely
  // when the flag is off, so single-player is byte-identical + no new-column
  // dependency until the flag flips.
  let ghostBooths: GhostBooth3D[] = [];
  let ghostBoothsEnabled = true;
  if (PLAN3D_BOOTH_ADS_ENABLED) {
    const [{ data: vendorRows, error: vendorRowsError }, { data: gbPrefs, error: gbPrefsError }] = await Promise.all([
      supabase.from('event_vendors').select('category').eq('event_id', eventId),
      supabase
        .from('event_floor_plan')
        .select('ghost_booths_enabled, ghost_booths_dismissed')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);
    if (vendorRowsError) {
      logQueryError('SeatingLabPage.vendorRows', vendorRowsError, { event_id: eventId }, 'graceful_degrade');
    }
    if (gbPrefsError) {
      logQueryError('SeatingLabPage.gbPrefs', gbPrefsError, { event_id: eventId }, 'graceful_degrade');
    }
    ghostBoothsEnabled = (gbPrefs?.ghost_booths_enabled as boolean | null) ?? true;
    ghostBooths = placedGhostBooths({
      bookedCategories: ((vendorRows ?? []) as { category: VendorCategory | null }[])
        .map((r) => r.category)
        .filter((c): c is VendorCategory => !!c),
      dismissed: ((gbPrefs?.ghost_booths_dismissed as VendorCategory[] | null) ?? []),
      enabled: ghostBoothsEnabled,
      occupied: [
        ...booths.map((b) => ({ xPct: b.xPct, yPct: b.yPct })),
        ...tables.map((t) => ({ xPct: t.xPct, yPct: t.yPct })),
      ],
    });
  }

  return (
    <section className="relative space-y-3">
      {/* Couple-facing acknowledgement: "your 3D Plan upgrade was unlocked by
          <vendor>" when a booked vendor with an active 3D Booth add-on unlocked
          the discounted 3D Plan. Renders null when there's no vendor unlock. */}
      <Couple3dPlanUnlockNotice eventId={eventId} />

      {/* The live "Add the 3D Plan" buy CTA — flows through the same apply-then-pay
          SEATING_3D checkout every couple SKU uses. Priced ₱1,000 when a vendor
          unlocked it (see notice above), else ₱2,999. Renders an owned/pending/
          unlocked state instead of a duplicate button when already purchased. */}
      <Couple3dPlanBuy eventId={eventId} />

      {/* The mirrored LIST | 2D | 3D segment now lives INSIDE the lab chrome,
          stacked above the Build/Play toggle (owner 2026-07-17 · chrome overlap
          fix) — no longer an overlay that crowds the Build panel. */}
      <SeatingLabLoader
        eventId={eventId}
        ghostBooths={ghostBooths}
        ghostBoothsEnabled={ghostBoothsEnabled}
        tables={tables}
        floor={floor}
        guests={guests}
        rolePalette={rolePalette}
        receptionDesign={receptionDesign}
        inspirationByPart={inspirationByPart}
        finalizedByPart={finalizedByPart}
        themeName={themeName}
        styleFamily={styleFamily}
        venueSetting={venueSetting}
        monogram={monogram}
        animatedMonogram={ownsAnimatedMonogram}
        me={{
          id: user.id,
          name:
            (user.user_metadata?.display_name as string | undefined) ||
            (user.user_metadata?.full_name as string | undefined) ||
            user.email?.split('@')[0] ||
            'Someone',
        }}
        keepApart={constraints}
        priorityOrder={floorPlan.priority_order ?? defaultPriorityOrder(roleSet)}
        roleSetKey={roleSet.key}
        groups={groups}
        floorExtras={floorExtras}
        sceneObjects={sceneObjects}
        booths={booths}
        signs={signs}
      />
    </section>
  );
}
