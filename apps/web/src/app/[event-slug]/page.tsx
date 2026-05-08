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
import { PlusOneOnboarding } from "./_components/plus-one-onboarding";

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
        "photos_released_at, palette_finalized_at, qr_color_dark, qr_color_light, " +
        "monogram_source, monogram_uploaded_url, monogram_uploaded_format, monogram_uploaded_at, " +
        "created_at, updated_at",
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

  // 0002 v2: TBA +1 onboarding. If this guest is a +1 (plus_one_of_guest_id
  // set) AND has no first_name yet, intercept BEFORE rendering the regular
  // invitation site. Show the name-capture screen.
  if (guest && guest.plus_one_of_guest_id && !guest.first_name?.trim()) {
    const { data: hostRow } = await admin
      .from("guests")
      .select("*")
      .eq("guest_id", guest.plus_one_of_guest_id)
      .maybeSingle<Guest>();
    if (hostRow) {
      return <PlusOneOnboarding event={event} guest={guest} host={hostRow} />;
    }
  }

  // Generate the QR SVG up front (cached). Origin from headers — works
  // identically on localhost and prod without env-var coupling.
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const hostHeader = headerList.get("host") ?? "localhost:3000";
  const origin = `${proto}://${hostHeader}`;

  // Load the household + partner + rsvp extras + (if applicable) the +1's host
  // primary record + the QR SVG.
  let household: Household | null = null;
  let partner: Guest | null = null;
  let rsvpExtras: GuestRsvpExtras | null = null;
  let host: Guest | null = null;
  let qrSvg: string | null = null;

  if (guest) {
    const [householdRes, partnerRes, extrasRes, hostRes, qr] = await Promise.all([
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
      // 0002 v2 — when this guest is a +1, look up the primary host so the
      // Limited variant + the personal site greeting can reference them.
      guest.plus_one_of_guest_id
        ? admin
            .from("guests")
            .select("*")
            .eq("guest_id", guest.plus_one_of_guest_id)
            .maybeSingle<Guest>()
        : Promise.resolve({ data: null }),
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
    host = hostRes.data ?? null;
    qrSvg = qr;
  }

  const isLimitedPlusOne = !!(
    guest && guest.plus_one_of_guest_id && guest.plus_one_mode === "limited"
  );

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
      isLimitedPlusOne={isLimitedPlusOne}
      host={host}
    />
  );
}
