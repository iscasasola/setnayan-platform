import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuestSession } from "@/lib/server/guest-session";
import { generateGuestQrSvg } from "@/lib/server/qr";
import type {
  Event,
  Guest,
  GuestRsvpExtras,
  Household,
} from "@/lib/db/types";
import { InvitationShell } from "./_components/invitation-shell";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ "event-slug": string }>;
  searchParams: Promise<{ invite?: string }>;
}

export default async function EventInvitationPage({ params }: RouteParams) {
  const { "event-slug": slug } = await params;

  // The middleware handles `?invite=<token>` upfront — validates, signs the
  // cookie, logs the scan, and 302s to the clean URL. By the time we render
  // here either the cookie is set (signed-in guest) or there's nothing
  // (generic landing).
  const admin = createAdminClient();

  // Lookup the event (case-insensitive on slug, mirroring the DB unique index).
  const { data: eventRow } = await admin
    .from("events")
    .select(
      "event_id, slug, couple_user_id_1, couple_user_id_2, " +
        "bride_first_name, bride_last_name, groom_first_name, groom_last_name, " +
        "event_date, ceremony_type, ceremony_venue, reception_venue, " +
        "guest_count_estimate, status, tier, monogram_svg, rsvp_deadline, " +
        "photos_released_at, created_at, updated_at",
    )
    .ilike("slug", slug)
    .maybeSingle<Event>();

  if (!eventRow) notFound();
  const event = eventRow;

  // Read the guest session cookie (set by middleware on /<slug>?invite=<token>).
  let guest: Guest | null = null;
  const session = await readGuestSession();
  if (session && session.event_id === event.event_id) {
    const { data } = await admin
      .from("guests")
      .select("*")
      .eq("guest_id", session.guest_id)
      .eq("qr_token", session.qr_token) // token rotation invalidates the session
      .is("deleted_at", null)
      .maybeSingle<Guest>();
    if (data) guest = data;
  }

  // Generate the QR SVG up front (cached). Origin from headers — works
  // identically on localhost and prod without env-var coupling.
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  // Load the household + partner + rsvp extras for the guest, if signed in.
  let household: Household | null = null;
  let partner: Guest | null = null;
  let rsvpExtras: GuestRsvpExtras | null = null;
  let qrSvg: string | null = null;

  if (guest) {
    const [householdRes, partnerRes, extrasRes, qr] = await Promise.all([
      guest.household_id
        ? admin
            .from("households")
            .select("household_id, event_id, name, address, created_at, updated_at")
            .eq("household_id", guest.household_id)
            .maybeSingle<Household>()
        : Promise.resolve({ data: null }),
      guest.pair_with_guest_id
        ? admin
            .from("guests")
            .select("*")
            .eq("guest_id", guest.pair_with_guest_id)
            .maybeSingle<Guest>()
        : Promise.resolve({ data: null }),
      admin
        .from("guest_rsvp_extras")
        .select("*")
        .eq("guest_id", guest.guest_id)
        .maybeSingle<GuestRsvpExtras>(),
      generateGuestQrSvg({
        origin,
        event_id: event.event_id,
        event_slug: event.slug,
        guest_id: guest.guest_id,
        qr_token: guest.qr_token,
      }),
    ]);
    household = householdRes.data ?? null;
    partner = partnerRes.data ?? null;
    rsvpExtras = extrasRes.data ?? null;
    qrSvg = qr;
  }

  return (
    <InvitationShell
      event={event}
      guest={guest}
      partner={partner}
      household={household}
      rsvpExtras={rsvpExtras}
      qrSvg={qrSvg}
      // V1: all guests are "public" tier. Registered tier ships with the Tayo native app (Phase 2).
      isRegistered={false}
    />
  );
}
