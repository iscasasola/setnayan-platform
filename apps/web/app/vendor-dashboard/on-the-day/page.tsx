import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import {
  ArrowRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  Circle,
  Clapperboard,
  Images,
  Lock,
  Music,
  PackageCheck,
  Star,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { WEDDING_TILE_LABEL, type WeddingTile } from '@/lib/taxonomy';
import { resolveDayOfConsoleKind, type DayOfConsoleKind } from '@/lib/vendor-day-of';
import { GuestReviewQr } from './_components/guest-review-qr';
import { ShotList } from './_components/shot-list';
import { IssuesLog } from './_components/issues-log';

export const metadata = { title: 'On the Day · Vendor · Setnayan' };

/**
 * Vendor "On the Day" console — reskinned to the finalized 6-menu vendor
 * prototype (editorial `--m-*` palette). A free, CATEGORY-CONDITIONAL day-of
 * hub that surfaces only on an event day (T-1h → T+8h in production; always
 * visible here for design, behind an explanatory amber banner).
 *
 * Every number is wired LIVE — nothing is hardcoded to the prototype's sample:
 *   • The dark event card = the vendor's own booked event dated TODAY, resolved
 *     from fetchVendorPoolBookings (RLS-scoped) + get_vendor_event_brief (the
 *     SECURITY DEFINER booked-vendor brief RPC) for the couple / date / venue.
 *   • Delivery-to-the-couple progress = the real completion handshake + the
 *     posted delivery handovers (booking_handovers) — a 3-stage derivation, not
 *     an invented percent.
 *   • Guests N / M pax = brief.pax.attending / brief.pax.invited (live RSVPs).
 *   • Recap clips + portfolio photos = editorial_vendor_media rows this vendor
 *     has added for THIS event (media_type clip / photo).
 *   • The guest-review QR encodes the vendor's own public page (/v/[slug]).
 *
 * Where a value has no live source yet (e.g. the vendor isn't published, or the
 * couple hasn't built their timeline), the section renders a clearly-labelled
 * empty / zero state — never a fabricated number.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');
const MAX_MEDIA_PER_TYPE = 3; // mirrors editorial-vendor-media MAX_PER_TYPE

/** The four day-of console personas shown as pills (order matters for display). */
const CATEGORY_PILLS: { kind: DayOfConsoleKind; label: string; icon: typeof Camera }[] = [
  { kind: 'photo', label: 'Photo / Video', icon: Camera },
  { kind: 'coordinator', label: 'Coordinator', icon: UserCheck },
  { kind: 'caterer', label: 'Caterer', icon: UtensilsCrossed },
  { kind: 'band', label: 'Band / DJ', icon: Music },
];

type Brief = {
  event: {
    display_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    ceremony_type: string | null;
  };
  booked_categories: string[];
  pax: { invited: number; attending: number; maybe: number; pending: number; declined: number };
};

/** PH wall-clock today (UTC+8, no DST) as 'YYYY-MM-DD' — booked_date is stored in
 *  the same PH civil-day convention, so string comparison is exact. */
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Up to two uppercase initials from a couple/event name for the dark card avatar. */
function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SN';
  if (words.length === 1) return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** The vendor's own primary category label (first recognised service tile). */
function primaryServiceLabel(services: readonly string[] | null | undefined): string | null {
  for (const s of services ?? []) {
    const label = WEDDING_TILE_LABEL[s as WeddingTile];
    if (label) return label;
  }
  return null;
}

export default async function VendorOnTheDayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/on-the-day');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard/verify');

  const kind = resolveDayOfConsoleKind(profile.services);
  const today = phToday();

  // The vendor's booked events (RLS-scoped) → keep the one dated TODAY. A vendor
  // may hold several pool slots on the same event; collapse to one card/event.
  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);
  const todaysBooking =
    bookings.find((b) => b.bookedDate === today) ?? null;

  // Live brief for today's event (couple / date / venue / pax). The booked gate
  // + aggregation live inside the SECURITY DEFINER RPC; a null means we couldn't
  // read a brief (unbooked / not built) → we degrade to the booking basics.
  let brief: Brief | null = null;
  if (todaysBooking) {
    const { data } = await supabase.rpc('get_vendor_event_brief', {
      p_event_id: todaysBooking.eventId,
    });
    if (data) brief = data as Brief;
  }

  // Delivery-to-the-couple + editorial-media counts — both keyed on today's
  // event. Admin reads (couple-scoped tables); the vendor is already booked-
  // gated by the RPC / pool read above.
  let deliveryStage: 0 | 1 | 2 = 0; // 0 = not started · 1 = in progress · 2 = delivered
  let clipCount = 0;
  let photoCount = 0;
  let reviewState: 'awaiting_vendor' | 'awaiting_confirm' | 'confirmed' | 'disputed' =
    'awaiting_vendor';
  if (todaysBooking) {
    const admin = createAdminClient();
    const [completionRes, handoverRes, mediaRes] = await Promise.all([
      admin
        .from('event_vendors')
        .select('completion_status, service_marked_complete_at, customer_confirmed_received_at')
        .eq('event_id', todaysBooking.eventId)
        .eq('marketplace_vendor_id', profile.vendor_profile_id)
        .maybeSingle(),
      admin
        .from('booking_handovers')
        .select('status, couple_acknowledged_at')
        .eq('event_id', todaysBooking.eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id),
      admin
        .from('editorial_vendor_media')
        .select('media_type')
        .eq('event_id', todaysBooking.eventId)
        .eq('vendor_profile_id', profile.vendor_profile_id),
    ]);

    const c = completionRes.data as {
      completion_status: string | null;
      service_marked_complete_at: string | null;
      customer_confirmed_received_at: string | null;
    } | null;
    const handovers = (handoverRes.data ?? []) as {
      status: string | null;
      couple_acknowledged_at: string | null;
    }[];

    const confirmed =
      c?.completion_status === 'confirmed' ||
      c?.completion_status === 'auto_confirmed' ||
      Boolean(c?.customer_confirmed_received_at) ||
      handovers.some((h) => Boolean(h.couple_acknowledged_at));
    const started =
      Boolean(c?.service_marked_complete_at) || handovers.length > 0;
    deliveryStage = confirmed ? 2 : started ? 1 : 0;

    if (c?.completion_status === 'disputed') reviewState = 'disputed';
    else if (confirmed) reviewState = 'confirmed';
    else if (started) reviewState = 'awaiting_confirm';
    else reviewState = 'awaiting_vendor';

    for (const m of (mediaRes.data ?? []) as { media_type: string }[]) {
      if (m.media_type === 'clip') clipCount += 1;
      else if (m.media_type === 'photo') photoCount += 1;
    }
  }

  // Guest-review QR — the vendor's own public page (verified vendors only have a
  // live public page). Encoded server-side; the fullscreen/print actions are a
  // small client component.
  const reviewSlug = profile.business_slug;
  const reviewUrl = reviewSlug ? `${SITE_URL}/v/${reviewSlug}#reviews` : null;
  const reviewQrSvg = reviewUrl
    ? await QRCode.toString(reviewUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 200,
        color: { dark: '#1E2229', light: '#FBFBFA' },
      })
    : null;

  const coupleName = brief?.event.display_name ?? todaysBooking?.eventName ?? null;
  const place = brief?.event.venue_name ?? null;
  const myCategory = primaryServiceLabel(profile.services);
  const invited = brief?.pax.invited ?? 0;
  const attending = brief?.pax.attending ?? 0;

  const DELIVERY_PCT = [0, 60, 100][deliveryStage];
  const DELIVERY_LABEL = ['Not started yet', 'In progress', 'Delivered'][deliveryStage];

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      {/* 1 · Amber info banner — the design-time visibility explainer. */}
      <div
        className="flex items-start gap-3 rounded-xl border px-4 py-3.5"
        style={{
          borderColor: 'var(--m-orange-3)',
          background: 'var(--m-orange-4)',
          color: 'var(--m-orange-2)',
        }}
      >
        <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed">
          Shows automatically on an event day (T-1h → T+8h). Visible here for design — normally
          hidden until you have an event today.
        </p>
      </div>

      {/* 2 · Dark event card — today's booked event, or the no-event state. */}
      {todaysBooking ? (
        <div
          className="rounded-xl p-5 sm:p-6"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--m-paper)' }}
              >
                {deriveInitials(coupleName ?? 'Event')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{coupleName ?? 'Your event today'}</p>
                <p className="mt-0.5 truncate text-sm" style={{ color: 'rgba(251,251,250,0.62)' }}>
                  {fmtDate(brief?.event.event_date ?? todaysBooking.bookedDate)}
                  {place ? ` · ${place}` : ''}
                  {myCategory ? ` · ${myCategory}` : ''}
                </p>
              </div>
            </div>
            <Link
              href={`/vendor-dashboard/clients/${todaysBooking.eventId}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-white/10"
              style={{ borderColor: 'rgba(255,255,255,0.22)', color: 'var(--m-paper)' }}
            >
              Change event <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border border-dashed p-8 text-center"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
        >
          <CalendarClock
            aria-hidden
            className="mx-auto h-8 w-8"
            style={{ color: 'var(--m-slate-3)' }}
            strokeWidth={1.5}
          />
          <p className="mt-3 text-base font-medium" style={{ color: 'var(--m-ink)' }}>
            No event today
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--m-slate-2)' }}>
            When a couple books you and holds a date, that day lights up here — with your live day-of
            console. Until then, this is a preview.
          </p>
          <Link
            href="/vendor-dashboard/customers"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
            style={{ background: 'var(--m-ink)' }}
          >
            See your customers <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      )}

      {/* 3 · Category pills + category-conditional console. */}
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
          Day-of tools adapt to your service{' '}
          <ArrowRight aria-hidden className="inline h-3.5 w-3.5" strokeWidth={1.75} />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_PILLS.map((pill) => {
            const active = pill.kind === kind;
            const Icon = pill.icon;
            return (
              <span
                key={pill.kind}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium"
                style={
                  active
                    ? { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' }
                    : { background: 'var(--m-paper)', color: 'var(--m-slate-2)', borderColor: 'var(--m-line)' }
                }
              >
                <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                {pill.label}
              </span>
            );
          })}
        </div>

        {/* Photo / Video console — delivery progress + guests headcount. */}
        {kind === 'photo' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* Delivery to the couple — 3-stage handshake, rendered as % done. */}
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--m-line)', background: 'white' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  aria-hidden
                  className="h-5 w-5"
                  style={{ color: 'var(--m-sage-deep)' }}
                  strokeWidth={1.75}
                />
                <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                  Delivery to the couple
                </p>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
                  {DELIVERY_PCT}%
                </span>
                <span className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
                  done · {DELIVERY_LABEL}
                </span>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full"
                style={{ background: 'var(--m-line-soft)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${DELIVERY_PCT}%`, background: 'var(--m-sage-deep)' }}
                />
              </div>
              <p className="mt-3 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                {todaysBooking
                  ? 'They see these updates live. Post your gallery link + mark complete from the brief.'
                  : 'This tracks live once you have an event today.'}
              </p>
            </div>

            {/* Guests — live RSVP headcount. */}
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: 'var(--m-line)', background: 'white' }}
            >
              <div className="flex items-center gap-2">
                <Users
                  aria-hidden
                  className="h-5 w-5"
                  style={{ color: 'var(--m-orange-2)' }}
                  strokeWidth={1.75}
                />
                <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                  Guests
                </p>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
                  {attending} / {invited}
                </span>
                <span className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
                  pax
                </span>
              </div>
              <p className="mt-3 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                {todaysBooking
                  ? 'Attending of invited — pulled live from the couple’s RSVPs. Know the headcount before you set up.'
                  : 'Headcount pulls in live once you have an event today.'}
              </p>
            </div>
          </div>
        ) : (
          <NonPhotoConsole kind={kind} eventId={todaysBooking?.eventId ?? null} />
        )}
      </div>

      {/* 4 · Shot list — syncs to the couple (personal, device-local for now). */}
      {kind === 'photo' ? (
        <ShotListSection eventId={todaysBooking?.eventId ?? null} eventName={coupleName} />
      ) : null}

      {/* 5 · Capture for your website + their recap. */}
      <div>
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Capture for your website + their recap
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <CaptureCard
            icon={Clapperboard}
            title="Recap capture"
            value={`${clipCount} ${clipCount === 1 ? 'clip' : 'clips'}`}
            sub="5s each · up to 3"
            href={todaysBooking ? `/vendor-dashboard/clients/${todaysBooking.eventId}/editorial-media` : null}
            hint={clipCount >= MAX_MEDIA_PER_TYPE ? 'Limit reached' : null}
          />
          <CaptureCard
            icon={Images}
            title="Photos"
            value={`${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`}
            sub="for your portfolio · up to 3"
            href={todaysBooking ? `/vendor-dashboard/clients/${todaysBooking.eventId}/editorial-media` : null}
            hint={photoCount >= MAX_MEDIA_PER_TYPE ? 'Limit reached' : null}
          />
          <CaptureCard
            icon={reviewState === 'confirmed' ? Star : Circle}
            title="Review the couple"
            value={
              reviewState === 'confirmed'
                ? 'Ready'
                : reviewState === 'awaiting_confirm'
                  ? 'Awaiting couple'
                  : reviewState === 'disputed'
                    ? 'On hold'
                    : 'Not yet'
            }
            sub={
              reviewState === 'confirmed'
                ? 'They’ve confirmed — reviews are open'
                : reviewState === 'awaiting_confirm'
                  ? 'Waiting for them to confirm delivery'
                  : reviewState === 'disputed'
                    ? 'A dispute is open on this booking'
                    : 'Opens once you mark complete'
            }
            href={todaysBooking ? `/vendor-dashboard/clients/${todaysBooking.eventId}` : '/vendor-dashboard/reviews'}
            hint={null}
          />
        </div>
      </div>

      {/* 6 · Instant reviews from guests — the review QR. */}
      <div>
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Instant reviews from guests
        </h2>
        <div className="mt-3">
          {reviewQrSvg && reviewUrl ? (
            <GuestReviewQr
              qrSvg={reviewQrSvg}
              reviewUrl={reviewUrl}
              businessName={profile.business_name}
            />
          ) : (
            <div
              className="flex items-start gap-3 rounded-xl border p-5"
              style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
            >
              <Star
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0"
                style={{ color: 'var(--m-slate-3)' }}
                strokeWidth={1.75}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                  Your review QR appears once your page is live
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--m-slate-2)' }}>
                  When your business is verified and your Setnayan page is published, a QR shows here
                  — display or print it at the event so guests can scan and review you.
                </p>
                <Link
                  href="/vendor-dashboard/verify"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                  style={{ color: 'var(--m-orange-2)' }}
                >
                  Get verified <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Section 4 wrapper — the shot list only makes sense with an event. */
function ShotListSection({
  eventId,
  eventName,
}: {
  eventId: string | null;
  eventName: string | null;
}) {
  if (!eventId) {
    return (
      <div>
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Shot list · syncs to the couple
        </h2>
        <p
          className="mt-3 rounded-xl border px-4 py-4 text-sm"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)', color: 'var(--m-slate-2)' }}
        >
          Your must-get shot list appears here on an event day, ready to check off as you shoot.
        </p>
      </div>
    );
  }
  // localStorage-backed, offline-tolerant client component.
  return (
    <div>
      <h2
        className="font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{ color: 'var(--m-slate-3)' }}
      >
        Shot list · syncs to the couple
      </h2>
      <div className="mt-3">
        <ShotList eventId={eventId} eventName={eventName ?? 'this event'} />
      </div>
    </div>
  );
}

/** A single capture tile in section 5. */
function CaptureCard({
  icon: Icon,
  title,
  value,
  sub,
  href,
  hint,
}: {
  icon: typeof Camera;
  title: string;
  value: string;
  sub: string;
  href: string | null;
  hint: string | null;
}) {
  const inner = (
    <div
      className="flex h-full flex-col rounded-xl border p-5 transition"
      style={{ borderColor: 'var(--m-line)', background: 'white' }}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="h-5 w-5" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
        <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          {title}
        </p>
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
      {hint ? (
        <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--m-sage-deep)' }}>
          {hint}
        </p>
      ) : null}
      {href ? (
        <span
          className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Open <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
      ) : null}
    </div>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}

/** The non-photo console variants (coordinator / caterer / band / general).
 *  Each routes into the surface that already owns its day-of tool, so the
 *  console stays honest to what exists — no duplicated data plumbing. */
function NonPhotoConsole({
  kind,
  eventId,
}: {
  kind: Exclude<DayOfConsoleKind, 'photo'>;
  eventId: string | null;
}) {
  const target = eventId
    ? kind === 'caterer'
      ? `/vendor-dashboard/clients/${eventId}/production-sheet`
      : `/vendor-dashboard/clients/${eventId}`
    : kind === 'band'
      ? '/vendor-dashboard/repertoire'
      : '/vendor-dashboard/customers';

  const copy: Record<
    Exclude<DayOfConsoleKind, 'photo'>,
    { icon: typeof Camera; title: string; sub: string }
  > = {
    coordinator: {
      icon: UserCheck,
      title: 'Run the floor',
      sub: 'Follow the live run-of-show, keep vendors moving, and log anything that comes up — all from the couple’s brief.',
    },
    caterer: {
      icon: UtensilsCrossed,
      title: 'Final headcount & meal splits',
      sub: 'Attending pax + per-part counts, pulled live from the couple’s RSVPs, with your portion math on the production sheet.',
    },
    band: {
      icon: Music,
      title: 'Your setlist',
      sub: 'The songs you play, ready against the couple’s requests so you go on knowing the room.',
    },
    general: {
      icon: PackageCheck,
      title: 'Your event brief',
      sub: 'Headcount, palette, the day-of timeline, and the delivery handover — everything for this booking in one place.',
    },
  };
  const c = copy[kind];
  const Icon = c.icon;

  return (
    <div className="mt-4 space-y-3">
      <Link
        href={target}
        className="flex items-center justify-between gap-4 rounded-xl border p-5 transition hover:bg-white sm:p-6"
        style={{ borderColor: 'var(--m-line)', background: 'white' }}
      >
        <span className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
          <span>
            <span className="block text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
              {c.title}
            </span>
            <span className="mt-0.5 block text-sm" style={{ color: 'var(--m-slate-2)' }}>
              {c.sub}
            </span>
          </span>
        </span>
        <ArrowRight aria-hidden className="h-5 w-5 shrink-0" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
      </Link>
      {/* Coordinators get their day-of issues log inline (device-local, offline
          tolerant) — the shipped command-center tool, preserved through the
          reskin. */}
      {kind === 'coordinator' && eventId ? <IssuesLog eventId={eventId} /> : null}
    </div>
  );
}
