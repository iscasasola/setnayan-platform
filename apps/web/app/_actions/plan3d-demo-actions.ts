'use server';

/**
 * Server actions behind the homepage 3D Plan live demo (owner spec,
 * DECISION_LOG 2026-07-03 — reuses the `demo_sessions` scaffold PR-1 shipped
 * for Papic). Kept in `app/_actions/` (not under `app/dashboard/**`) for the
 * same reason `demo-session-actions.ts` is: homepage-owned plumbing, never
 * part of the real couple-facing seating product.
 *
 * The 3D Plan demo is read-only end to end. It shows the public Maria & Jose
 * sample event's PUBLISHED seat plan — fictional guests, zero privacy surface
 * (DECISION_LOG 2026-07-03 "the lightest demo"). Nothing here ever writes to
 * `event_tables` / `event_seat_assignments` / `event_floor_plan` / `guests`;
 * the only write is the ephemeral `demo_sessions` bookkeeping row minted per
 * guest click, identical in shape to the Papic/Panood mint (PR-1) except it
 * carries ONE token bound to a guest id instead of a synced phone pair.
 */

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSampleEvent, getSampleEventId } from '@/app/tour/_lib/sample-event';
import { fetchTables, fetchAssignments, fetchFloorPlan, fetchSceneObjects, fetchBooths, fetchSigns, defaultTablePosition } from '@/lib/seating';
import { guestDisplayName } from '@/lib/guests';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  shapeHintFor,
  VENUE_OBJECT_CATALOG,
  type Lab3DTable,
  type Lab3DFloor,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
  type Lab3DCocktail,
  type VenueObjectKind,
} from '@/lib/seating-3d';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { sanitizeReceptionDesign, type ReceptionDesign } from '@/lib/reception-scene';
import { createDemoSession, purgeExpiredDemoSessions, resolveDemoToken } from '@/lib/demo-sessions';
import { renderUrlQrSvg } from '@/lib/qr';

/** Display-safe seated-guest slice for the 3D demo — name + seat + side only
 *  (never contact info / qr_token / meal), same PII discipline as `/tour/seating`. */
export type Plan3DGuest = {
  id: string;
  name: string;
  tableId: string;
  seatNumber: number | null;
  side: 'bride' | 'groom' | 'both';
  /** Resolved display URL of the guest's own `photo_url` (sanctioned avatar
   *  source — never face-enrollment biometrics). Null → initials/token fallback.
   *  The sample event's guests are fictional, so photos here are privacy-clean. */
  photoUrl?: string | null;
};

export type Plan3DScene = {
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Plan3DGuest[];
  /** Placed venue fixtures — rendered read-only in the demo (same shared module
   *  as the couple lab + guest walk). Zero PII: room layout only. */
  sceneObjects: Lab3DSceneObject[];
  booths: Lab3DBooth[];
  signs: Lab3DSign[];
  cocktail: Lab3DCocktail;
  brideName: string;
  groomName: string;
  /** The sample couple's saved mood-board palette (events.role_palette),
   *  sanitized. Drives the "Apply mood board" recolour — same field + shape the
   *  couple-facing venue walk (`guest-venue-3d.tsx`) themes from. Empty object
   *  when the event never set one (→ scene falls back to the neutral default). */
  rolePalette: RolePalette;
  /** The couple's saved reception treatments (events.reception_design), sanitized
   *  against the RECEPTION_PARTS vocabulary. Drives the Wave-2b 3D decor (ceiling
   *  chandeliers / draped or floral backdrop / centrepieces …). Empty {} → the
   *  DEFAULT_DESIGN treatments render (via `sel()`). Themed toggle gates it. */
  receptionDesign: ReceptionDesign;
  /** The room ARCHETYPE (events.venue_setting, default 'banquet_hall') — drives
   *  the Wave-2b `VenueShell` swap (garden greenery / chapel windows / barn …). */
  venueSetting: string;
};

function toPlan3DSide(side: string | null): 'bride' | 'groom' | 'both' {
  return side === 'bride' || side === 'groom' ? side : 'both';
}

/**
 * Loads the sample event's published seat plan for the 3D demo. Resolves the
 * event through the ONE trust boundary (`getSampleEvent`) and reads through
 * the service-role admin client, same as `/tour/seating` — this function is
 * called from both the desktop overlay (whole-room view) and the phone guest
 * view (single-guest walk), so it always returns the full scene and the
 * caller narrows to one guest when it needs to.
 */
export async function loadPlan3DDemoScene(): Promise<Plan3DScene> {
  const ev = await getSampleEvent();
  const eventId = ev.event_id;
  const admin = createAdminClient();

  const [tablesRaw, assignments, floorPlan, sceneObjectsRaw, boothsRaw, signsRaw, guestResult] = await Promise.all([
    fetchTables(admin, eventId),
    fetchAssignments(admin, eventId),
    fetchFloorPlan(admin, eventId),
    fetchSceneObjects(admin, eventId),
    fetchBooths(admin, eventId),
    fetchSigns(admin, eventId),
    admin
      .from('guests')
      .select('guest_id,first_name,last_name,display_name,side,photo_url')
      .eq('event_id', eventId)
      .is('deleted_at', null),
  ]);

  // Mirrors the couple-facing 3D lab's un-positioned-table fallback (page.tsx
  // in dashboard/[eventId]/seating/lab) so the demo room matches whatever the
  // sample event's real plan looks like, positioned or not.
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
  type GuestNameRow = {
    guest_id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    side: string | null;
    photo_url: string | null;
  };
  const guestRows = (guestResult.data ?? []) as GuestNameRow[];

  // Resolve each guest's stored `photo_url` (an r2:// ref or raw avatar URL) to
  // a display URL so the 3D avatars wear the guest's actual selfie — mirrors the
  // couple lab's resolver (seating/lab/page.tsx), signed in parallel. The sample
  // event's guests are fictional, so these photos carry zero privacy surface.
  const photoDisplayUrls: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(
        guestRows
          .filter((g) => g.photo_url)
          .map(async (g) => [g.photo_url!, await displayUrlForStoredAsset(g.photo_url)] as const),
      )
    ).filter((e): e is [string, string] => e[1] !== null),
  );

  const guests: Plan3DGuest[] = guestRows
    .map((g): Plan3DGuest | null => {
      const seat = seatByGuest.get(g.guest_id);
      if (!seat) return null; // the demo only clicks guests who actually have a seat
      return {
        id: g.guest_id,
        name: guestDisplayName({ ...g, first_name: g.first_name ?? '', last_name: g.last_name ?? '' }),
        tableId: seat.table_id,
        seatNumber: seat.seat_number,
        side: toPlan3DSide(g.side),
        photoUrl: g.photo_url ? photoDisplayUrls[g.photo_url] ?? null : null,
      };
    })
    .filter((g): g is Plan3DGuest => g !== null);

  const floor: Lab3DFloor = {
    venueWidthM: floorPlan.venue_width_m ?? null,
    venueLengthM: floorPlan.venue_length_m ?? null,
    stage: { xPct: floorPlan.stage_x, yPct: floorPlan.stage_y, wPct: floorPlan.stage_w, hPct: floorPlan.stage_h },
    entrance: { enabled: floorPlan.entrance_enabled, xPct: floorPlan.entrance_x, yPct: floorPlan.entrance_y },
    dance: {
      enabled: floorPlan.dance_enabled,
      xPct: floorPlan.dance_x,
      yPct: floorPlan.dance_y,
      wPct: floorPlan.dance_w,
      hPct: floorPlan.dance_h,
    },
    published: floorPlan.published_at != null,
  };

  // Placed venue fixtures — guard scene-object kinds against the canonical
  // catalog (drop any stray kind), map booths/signs, derive the cocktail room.
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
  // Resolve booked-vendor logos (raw stored refs) to display URLs, same as the
  // guest avatars above — booth vendor identity is PUBLIC business info, so no
  // token gate, but an r2:// ref still needs server-side resolution.
  const boothLogoRefs = [...new Set(boothsRaw.map((b) => b.vendor?.logo_url).filter((r): r is string => !!r))];
  const boothLogoUrls: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(boothLogoRefs.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const))
    ).filter((e): e is [string, string] => e[1] !== null),
  );
  const booths: Lab3DBooth[] = boothsRaw.map((b) => ({
    id: b.booth_id,
    kind: b.booth_type,
    label: b.label,
    xPct: b.x_pos,
    yPct: b.y_pos,
    offerings: b.offerings,
    vendor: b.vendor
      ? {
          name: b.vendor.vendor_name,
          category: b.vendor.category,
          logoUrl: b.vendor.logo_url ? boothLogoUrls[b.vendor.logo_url] ?? null : null,
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
  const cocktail: Lab3DCocktail = floorPlan.cocktail_enabled
    ? {
        xPct: floorPlan.cocktail_x,
        yPct: floorPlan.cocktail_y,
        wPct: floorPlan.cocktail_w,
        hPct: floorPlan.cocktail_h,
        label: floorPlan.cocktail_label,
      }
    : null;

  return {
    tables,
    floor,
    guests,
    sceneObjects,
    booths,
    signs,
    cocktail,
    brideName: ev.bride_name ?? 'Maria',
    groomName: ev.groom_name ?? 'Jose',
    rolePalette: sanitizeRolePalette(ev.role_palette ?? {}),
    receptionDesign: sanitizeReceptionDesign(ev.reception_design),
    venueSetting: typeof ev.venue_setting === 'string' && ev.venue_setting ? ev.venue_setting : 'banquet_hall',
  };
}

export type Plan3DGuestQr = {
  guestId: string;
  guestName: string;
  qrSvg: string;
  joinUrl: string;
  expiresAt: string;
};

/**
 * Mints a fresh 3D-Plan demo session bound to ONE clicked guest (owner spec:
 * "clicking a seated GUEST figure pops a QR bound to THAT person"). A brand
 * new token every click — never reused, mirroring the Papic/Panood mint rule.
 * Validates the guestId is actually a seated guest of the sample event before
 * minting anything, so a tampered client id can't bind a session to garbage.
 */
export async function mintPlan3DGuestQr(guestId: string, appUrl: string): Promise<Plan3DGuestQr | null> {
  const clean = guestId?.trim();
  if (!clean) return null;

  const eventId = await getSampleEventId();
  const admin = createAdminClient();
  const [{ data: guestRow }, assignments] = await Promise.all([
    admin
      .from('guests')
      .select('guest_id,first_name,last_name,display_name')
      .eq('event_id', eventId)
      .eq('guest_id', clean)
      .is('deleted_at', null)
      .maybeSingle(),
    fetchAssignments(admin, eventId),
  ]);
  if (!guestRow) return null;
  const isSeated = assignments.some((a) => a.guest_id === clean);
  if (!isSeated) return null;

  const session = await createDemoSession('3d_plan', clean);
  const joinUrl = `${appUrl}/3d_plan/demo/${session.tokenA}`;
  const qrSvg = await renderUrlQrSvg(joinUrl, 220);

  after(() => purgeExpiredDemoSessions());

  return {
    guestId: clean,
    guestName: guestDisplayName(guestRow),
    qrSvg,
    joinUrl,
    expiresAt: session.expiresAt,
  };
}

export type Plan3DGuestView = {
  scene: Plan3DScene;
  guest: Plan3DGuest;
};

export type ResolvePlan3DResult = { ok: true; view: Plan3DGuestView } | { ok: false };

/**
 * Phone-side resolve: turns a scanned token into the bound guest's view of the
 * sample scene. Fails closed the same way `/papic/demo/[token]` does — any
 * mismatch (wrong demo kind, no bound_ref, guest no longer seated) is just
 * "this demo ended," never a crash or a fallthrough to someone else's guest.
 */
export async function resolvePlan3DGuestToken(token: string): Promise<ResolvePlan3DResult> {
  const clean = token?.trim();
  const resolved = clean ? await resolveDemoToken(clean) : null;
  after(() => purgeExpiredDemoSessions());
  if (!resolved || resolved.demoKind !== '3d_plan' || !resolved.boundRef) return { ok: false };

  const scene = await loadPlan3DDemoScene();
  const guest = scene.guests.find((g) => g.id === resolved.boundRef);
  if (!guest) return { ok: false };

  return { ok: true, view: { scene, guest } };
}
