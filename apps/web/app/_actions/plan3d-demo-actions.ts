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
import { fetchTables, fetchAssignments, fetchFloorPlan, defaultTablePosition } from '@/lib/seating';
import { guestDisplayName } from '@/lib/guests';
import { shapeHintFor, type Lab3DTable, type Lab3DFloor } from '@/lib/seating-3d';
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
};

export type Plan3DScene = {
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Plan3DGuest[];
  brideName: string;
  groomName: string;
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

  const [tablesRaw, assignments, floorPlan, guestResult] = await Promise.all([
    fetchTables(admin, eventId),
    fetchAssignments(admin, eventId),
    fetchFloorPlan(admin, eventId),
    admin
      .from('guests')
      .select('guest_id,first_name,last_name,display_name,side')
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
  };
  const guestRows = (guestResult.data ?? []) as GuestNameRow[];

  const guests: Plan3DGuest[] = guestRows
    .map((g) => {
      const seat = seatByGuest.get(g.guest_id);
      if (!seat) return null; // the demo only clicks guests who actually have a seat
      return {
        id: g.guest_id,
        name: guestDisplayName({ ...g, first_name: g.first_name ?? '', last_name: g.last_name ?? '' }),
        tableId: seat.table_id,
        seatNumber: seat.seat_number,
        side: toPlan3DSide(g.side),
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

  return {
    tables,
    floor,
    guests,
    brideName: ev.bride_name ?? 'Maria',
    groomName: ev.groom_name ?? 'Jose',
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
