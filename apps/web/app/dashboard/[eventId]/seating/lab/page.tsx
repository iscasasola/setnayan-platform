import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
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
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  sanitizeRolePalette,
  resolveAttirePaletteColor,
  sideAttireColor,
} from '@/lib/mood-board';
import { sanitizeReceptionDesign } from '@/lib/reception-scene';
import { SeatingLabLoader } from './_components/seating-lab-loader';
import { Couple3dPlanUnlockNotice } from './_components/couple-3d-plan-unlock-notice';

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

  const [tablesRaw, assignments, guestsRaw, floorPlan, constraints, sceneObjectsRaw, boothsRaw, signsRaw, groupsRaw, memberships, eventRow, roleSet] = await Promise.all([
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
        'display_name, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, role_palette, reception_design, venue_setting',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    // Iteration 0053 P4 Unit 6: per-event-type role set for the 3D tier annotation.
    resolveRoleSetForEvent(eventId),
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
  const photoDisplayUrls: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(
        guestsRaw
          .filter((g) => g.photo_url)
          .map(async (g) => [g.photo_url!, await displayUrlForStoredAsset(g.photo_url)] as const),
      )
    ).filter((e): e is [string, string] => e[1] !== null),
  );

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
  // Wave 2b: the couple's saved reception treatments + room archetype reach the
  // 3D lab (sanitized against the RECEPTION_PARTS vocabulary; default banquet_hall).
  const receptionDesign = sanitizeReceptionDesign((eventRow.data as Record<string, unknown> | null)?.reception_design);
  const venueSettingRaw = (eventRow.data as Record<string, unknown> | null)?.venue_setting;
  const venueSetting = typeof venueSettingRaw === 'string' && venueSettingRaw ? venueSettingRaw : 'banquet_hall';

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
          : resolveAttirePaletteColor(g.role, rolePalette, sideAttireColor(rolePalette, g.side)),
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
  const bespoke =
    (typeof event?.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null) ??
    (typeof event?.monogram_custom_svg === 'string' && event.monogram_custom_svg.trim()
      ? event.monogram_custom_svg
      : null);
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
    const [{ data: vendorRows }, { data: gbPrefs }] = await Promise.all([
      supabase.from('event_vendors').select('category').eq('event_id', eventId),
      supabase
        .from('event_floor_plan')
        .select('ghost_booths_enabled, ghost_booths_dismissed')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);
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
