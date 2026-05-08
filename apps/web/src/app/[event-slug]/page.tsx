import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readGuestSession,
  setGuestSessionCookie,
  signGuestSession,
} from "@/lib/server/guest-session";
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

export default async function EventInvitationPage({ params, searchParams }: RouteParams) {
  const { "event-slug": slug } = await params;
  const { invite } = await searchParams;

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

  // Identify the guest. Priority:
  // 1. ?invite=<token> in the URL — fresh QR scan; validate, set cookie, then redirect to clean URL.
  // 2. tayo_guest_session cookie — returning guest.
  // 3. Neither — render a generic "use your invite link" page.
  let guest: Guest | null = null;

  if (invite) {
    const { data } = await admin
      .from("guests")
      .select("*")
      .eq("event_id", event.event_id)
      .eq("qr_token", invite)
      .is("deleted_at", null)
      .maybeSingle<Guest>();

    if (!data) {
      // Invalid / revoked token — fall through to generic page.
    } else {
      guest = data;
      const jwt = await signGuestSession({
        guest_id: guest.guest_id,
        event_id: guest.event_id,
        qr_token: guest.qr_token,
      });
      await setGuestSessionCookie(jwt);

      // Log the scan. Best-effort — don't fail the page if logging errors.
      const headerList = await headers();
      const ua = headerList.get("user-agent");
      const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ipAnon = ip ? ip.split(".").slice(0, 3).join(".") + ".0" : null;
      if (!guest.scan_tracking_opt_out) {
        await admin.from("scan_events").insert({
          event_id: guest.event_id,
          guest_id: guest.guest_id,
          source: "browser",
          context: { from: "qr_or_link" },
          user_agent: ua,
          ip_anon: ipAnon,
        });
      }

      // Drop the query param from the URL — the cookie now identifies the guest.
      redirect(`/${event.slug}`);
    }
  }

  // No fresh invite param. Try cookie.
  if (!guest) {
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
