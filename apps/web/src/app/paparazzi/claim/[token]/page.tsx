import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, PaparazziSeat } from "@/lib/db/types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export default async function PaparazziClaimPage({ params }: RouteParams) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) notFound();

  const admin = createAdminClient();
  const { data: seatRow } = await admin
    .from("paparazzi_seats")
    .select(
      "seat_id, event_id, seat_index, role_label, claim_qr_token, " +
        "claimer_user_id, claimer_label, claimed_at, device_platform, device_app_build, " +
        "last_seen_at, battery_pct_last, handed_off_to_seat_id, revoked_at, " +
        "created_at, updated_at",
    )
    .eq("claim_qr_token", token)
    .is("revoked_at", null)
    .maybeSingle<PaparazziSeat>();

  if (!seatRow) notFound();

  const { data: eventRow } = await admin
    .from("events")
    .select(
      "event_id, slug, bride_first_name, groom_first_name, event_date, " +
        "ceremony_venue, reception_venue",
    )
    .eq("event_id", seatRow.event_id)
    .maybeSingle<
      Pick<
        Event,
        "event_id" | "slug" | "bride_first_name" | "groom_first_name" | "event_date" | "ceremony_venue" | "reception_venue"
      >
    >();

  if (!eventRow) notFound();

  const claimed = !!seatRow.claimed_at;
  const eventDate = new Date(`${eventRow.event_date}T00:00:00`).toLocaleDateString(
    "en-PH",
    { month: "long", day: "numeric", year: "numeric" },
  );

  // Deep link spec: tayo:paparazzi/claim?token=<hex>. Native app handles
  // the actual claim POST; webapp only hands off the token.
  const deepLink = `tayo://paparazzi/claim?token=${encodeURIComponent(token)}`;
  const iosStoreLink = "https://apps.apple.com/app/tayo/id-pending";
  const androidStoreLink = "https://play.google.com/store/apps/details?id=app.tayo";

  return (
    <main className="min-h-screen bg-page-bg">
      <div className="mx-auto max-w-xl px-4 py-12 lg:py-16">
        <div className="rounded-3xl border border-rule-strong bg-surface px-6 py-8 lg:px-8">
          <p className="meta-label mb-2">Tayo Paparazzi</p>
          <h1 className="display-title text-balance">
            You&apos;re a paparazzo for {eventRow.bride_first_name} &amp;{" "}
            {eventRow.groom_first_name}
          </h1>
          <p className="mt-2 text-[13px] text-ink-soft">
            {eventDate}
            {eventRow.reception_venue ? ` · ${eventRow.reception_venue}` : ""}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-rule bg-page-bg-soft px-4 py-3">
            <div>
              <p className="meta-label">Seat</p>
              <p className="mt-0.5 text-[14px] font-medium text-ink">
                #{seatRow.seat_index}
                {seatRow.role_label ? (
                  <span className="ml-1 font-normal text-ink-soft">· {seatRow.role_label}</span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="meta-label">Status</p>
              <p
                className={`mt-0.5 text-[14px] font-medium ${
                  claimed ? "text-ink-soft" : "text-[var(--accent-deep)]"
                }`}
              >
                {claimed ? "Already claimed" : "Ready to claim"}
              </p>
            </div>
          </div>

          {claimed ? (
            <div className="mt-6 rounded-2xl border border-rule bg-surface px-4 py-3 text-[13px] text-ink-soft">
              This seat was claimed{" "}
              {seatRow.claimed_at
                ? new Date(seatRow.claimed_at).toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : ""}
              {seatRow.claimer_label ? ` by ${seatRow.claimer_label}` : ""}.
              <p className="mt-2">
                If that wasn&apos;t you, ask the couple to reissue the QR from their
                gallery dashboard.
              </p>
            </div>
          ) : (
            <>
              <ol className="mt-6 list-decimal pl-5 text-[13px] text-ink-soft">
                <li className="mb-1.5">
                  Install the <span className="font-medium text-ink">Tayo Paparazzi</span>{" "}
                  app — iOS 16+ or Android 11+.
                </li>
                <li className="mb-1.5">
                  Tap <span className="font-medium text-ink">Open in Tayo</span> below to
                  claim this seat.
                </li>
                <li>
                  Shoot photos and 5-second clips through the night. Tag guests with their
                  QR or table card.
                </li>
              </ol>

              <div className="mt-5 flex flex-col gap-2">
                <a href={deepLink} className="btn-primary text-[13px]">
                  Open in Tayo
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={iosStoreLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-default text-[12px]"
                  >
                    Get for iOS
                  </a>
                  <a
                    href={androidStoreLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-default text-[12px]"
                  >
                    Get for Android
                  </a>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-ink-faint">
                Native app launches with V1.5. If you got here before then, hold tight —
                we&apos;ll email you when it&apos;s available.
              </p>
            </>
          )}

          <div className="mt-6 border-t border-rule pt-4 text-center">
            <Link href={`/${eventRow.slug}`} className="text-[12px] text-ink-soft hover:text-ink">
              ← {eventRow.bride_first_name} &amp; {eventRow.groom_first_name}&apos;s
              invitation
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
