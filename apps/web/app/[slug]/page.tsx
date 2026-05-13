import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  clearGuestSession,
  readGuestSession,
  setGuestSession,
} from '@/lib/guest-session';
import { formatEventDate } from '@/lib/events';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { submitRsvp } from './actions';

function displayNameOf(g: {
  first_name: string;
  last_name: string;
  display_name: string | null;
}): string {
  return g.display_name?.trim() || `${g.first_name} ${g.last_name}`.trim();
}

export const dynamic = 'force-dynamic';

const RESERVED_TOP_LEVEL = new Set([
  'admin',
  'api',
  'auth',
  'dashboard',
  'health',
  'help',
  'join',
  'legal',
  'login',
  'logout',
  'manifest.json',
  'privacy',
  'register',
  'settings',
  'signup',
  'support',
  'sw.js',
  'terms',
  'about',
  'contact',
  'vendor',
  'v',
  '_next',
]);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
};

export default async function PublicInvitationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const invite = (search.invite ?? '').trim();

  if (!slug || RESERVED_TOP_LEVEL.has(slug)) notFound();

  const admin = createAdminClient();

  // Look up the event by slug.
  const { data: event } = await admin
    .from('events')
    .select(
      'event_id, public_id, display_name, event_date, venue_name, venue_address, event_type, slug',
    )
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) notFound();
  if (event.event_type !== 'wedding') notFound();

  // Resolve guest identity: prefer the invite token, fall back to existing cookie.
  let session = await readGuestSession();
  let landedViaToken = false;

  if (invite) {
    const { data: guestByToken } = await admin
      .from('guests')
      .select('guest_id, event_id, qr_token')
      .eq('qr_token', invite)
      .is('deleted_at', null)
      .maybeSingle();

    if (guestByToken && guestByToken.event_id === event.event_id) {
      await setGuestSession({
        guest_id: guestByToken.guest_id,
        event_id: guestByToken.event_id,
        qr_token: guestByToken.qr_token,
      });
      session = {
        guest_id: guestByToken.guest_id,
        event_id: guestByToken.event_id,
        qr_token: guestByToken.qr_token,
      };
      landedViaToken = true;

      // Record the scan (admin client; visitor isn't authenticated).
      const headerList = await headers();
      const userAgent = headerList.get('user-agent') ?? null;
      const xff = headerList.get('x-forwarded-for') ?? '';
      const ipFull = xff.split(',')[0]?.trim() ?? '';
      const ipAnon = ipFull
        ? ipFull.split('.').slice(0, 3).join('.') + '.0'
        : null;
      await admin.from('scan_events').insert({
        event_id: guestByToken.event_id,
        guest_id: guestByToken.guest_id,
        source: 'browser',
        user_agent: userAgent,
        ip_anon: ipAnon,
        context: { entry: 'invite_link' },
      });
    } else {
      // Bad token — clear any stale cookie and bail with a public landing.
      await clearGuestSession();
      return <PublicLanding event={event} reason="invalid_invite" />;
    }
  }

  // If we landed via the ?invite= token, drop the param from the URL.
  if (landedViaToken) {
    redirect(`/${slug}`);
  }

  // No session and no token → show a public landing pitching the QR.
  if (!session) {
    return <PublicLanding event={event} />;
  }

  // Cookie session is for a different event → ignore it for this URL.
  if (session.event_id !== event.event_id) {
    await clearGuestSession();
    return <PublicLanding event={event} reason="wrong_event" />;
  }

  // Load the guest row.
  const { data: guest } = await admin
    .from('guests')
    .select(
      'guest_id, first_name, last_name, display_name, role, side, group_category, plus_one_of_guest_id, plus_one_mode, rsvp_status, meal_preference, dietary_restrictions, notes, custom_tags, qr_token',
    )
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!guest) {
    await clearGuestSession();
    return <PublicLanding event={event} reason="invalid_invite" />;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const qrSvg = await renderInvitationQrSvg({
    appUrl,
    slug,
    qrToken: guest.qr_token,
  });
  const invitationUrl = buildInvitationUrl({ appUrl, slug, qrToken: guest.qr_token });

  return (
    <InvitationSite
      event={event}
      guest={guest}
      qrSvg={qrSvg}
      invitationUrl={invitationUrl}
    />
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type EventRow = {
  event_id: string;
  public_id: string;
  display_name: string;
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  slug: string;
};

type GuestRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  role: GuestRole;
  side: 'bride' | 'groom' | 'both';
  group_category: string;
  plus_one_of_guest_id: string | null;
  plus_one_mode: 'full' | 'limited' | null;
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
  meal_preference: string | null;
  dietary_restrictions: string | null;
  notes: string | null;
  custom_tags: string[];
  qr_token: string;
};

function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-xs font-semibold text-cream"
            >
              S
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
            Invitation
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      <footer className="border-t border-ink/10 px-4 py-6 text-center text-xs text-ink/50">
        Powered by Setnayan · setnayan.com
      </footer>
    </main>
  );
}

function PublicLanding({
  event,
  reason,
}: {
  event: EventRow;
  reason?: 'invalid_invite' | 'wrong_event';
}) {
  return (
    <InvitationShell>
      <div className="space-y-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          You&rsquo;re invited
        </p>
        <h1 className="font-sans text-5xl font-semibold tracking-tight sm:text-6xl">
          {event.display_name}
        </h1>
        <p className="text-base text-ink/60">
          {[formatEventDate(event.event_date), event.venue_name]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {reason === 'invalid_invite' ? (
          <p className="mx-auto max-w-prose rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
            That invite link doesn&rsquo;t look right. Ask the couple to send you a fresh
            one — every guest has their own personal link.
          </p>
        ) : reason === 'wrong_event' ? (
          <p className="mx-auto max-w-prose rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You&rsquo;re signed in to a different event&rsquo;s invitation. Open your own
            QR or invite link to switch.
          </p>
        ) : (
          <p className="mx-auto max-w-prose text-sm text-ink/70">
            This is a Setnayan invitation page. Scan your personal QR or open the link
            the couple sent you to see your invitation.
          </p>
        )}
      </div>
    </InvitationShell>
  );
}

function InvitationSite({
  event,
  guest,
  qrSvg,
  invitationUrl,
}: {
  event: EventRow;
  guest: GuestRow;
  qrSvg: string;
  invitationUrl: string;
}) {
  const sideLabel =
    guest.side === 'both'
      ? 'Both sides'
      : guest.side === 'bride'
        ? "Bride's side"
        : "Groom's side";

  const isLimitedPlusOne =
    guest.plus_one_of_guest_id !== null && guest.plus_one_mode === 'limited';

  return (
    <InvitationShell>
      <article className="space-y-12">
        {/* Hero */}
        <section className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            You are invited
          </p>
          <div
            aria-hidden
            className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-terracotta bg-cream font-serif text-2xl italic text-terracotta"
          >
            M &amp; J
          </div>
          <h1 className="mt-6 font-sans text-5xl font-semibold tracking-tight sm:text-6xl">
            {event.display_name}
          </h1>
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
            {formatEventDate(event.event_date)}
          </p>
          <hr className="mx-auto mt-6 w-24 border-t border-ink/20" />
        </section>

        {/* Greeting */}
        <section className="space-y-4 text-center">
          <p className="text-2xl italic text-ink">Hi, {guest.first_name}.</p>
          <p className="mx-auto max-w-prose text-base text-ink/70">
            We&rsquo;d love to celebrate with you on{' '}
            <span className="font-medium text-ink">{formatEventDate(event.event_date)}</span>
            {event.venue_name ? (
              <>
                {' '}
                — at <span className="font-medium text-ink">{event.venue_name}</span>
              </>
            ) : null}
            . You&rsquo;re joining us as{' '}
            <span className="font-medium text-ink">{ROLE_LABELS[guest.role]}</span> ·{' '}
            <span className="text-ink/80">{sideLabel}</span>.
          </p>
        </section>

        {/* QR card */}
        <section className="rounded-2xl border border-ink/10 bg-cream p-6 text-center shadow-sm sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Your invitation QR
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">For tagging &amp; pickup</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-ink/60">
            Save this to your phone. Wedding-day photographers will scan it to tag the
            photos they take of you — and you&rsquo;ll be able to grab those photos here
            after the event.
          </p>
          <div
            aria-label={`QR code for ${displayNameOf(guest)}`}
            className="mx-auto mt-6 inline-block rounded-xl bg-white p-3 shadow-sm"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-4 break-all font-mono text-[10px] uppercase tracking-[0.1em] text-ink/40">
            {invitationUrl}
          </p>
        </section>

        {/* RSVP */}
        <RsvpWidget guest={guest} eventId={event.event_id} limited={isLimitedPlusOne} />

        {/* Event details */}
        <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Event details
          </p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detail label="Date" value={formatEventDate(event.event_date) || '—'} />
            <Detail label="Venue" value={event.venue_name ?? '—'} />
            {event.venue_address ? (
              <Detail label="Address" value={event.venue_address} className="sm:col-span-2" />
            ) : null}
            <Detail label="Your role" value={ROLE_LABELS[guest.role]} />
            <Detail label="Side" value={sideLabel} />
          </dl>
        </section>

        {isLimitedPlusOne ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            You&rsquo;re joining as a +1. Photos taken of you will appear in your inviter&rsquo;s
            gallery — ask them to share. In-app features like Shutter and Photo Challenges
            require a full Setnayan account, which the couple hasn&rsquo;t enabled for +1s on
            this wedding.
          </section>
        ) : null}

        {/* Footer with sign-out */}
        <section className="border-t border-ink/10 pt-6 text-center text-xs text-ink/50">
          <form action={`/${event.slug}/sign-out`} method="post">
            <button type="submit" className="underline-offset-4 hover:underline">
              Sign out of this invitation
            </button>
          </form>
        </section>
      </article>
    </InvitationShell>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </dt>
      <dd className="mt-0.5 text-base text-ink">{value}</dd>
    </div>
  );
}

function RsvpWidget({
  guest,
  eventId,
  limited,
}: {
  guest: GuestRow;
  eventId: string;
  limited: boolean;
}) {
  const action = submitRsvp.bind(null, eventId, guest.guest_id);

  return (
    <form
      action={action}
      className="space-y-5 rounded-2xl border border-terracotta/30 bg-gradient-to-b from-terracotta/5 to-cream p-6 sm:p-8"
    >
      <header className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          RSVP
        </p>
        <RsvpPill status={guest.rsvp_status} />
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(
          [
            { key: 'attending', label: "I'll be there", tone: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' },
            { key: 'maybe', label: 'Maybe', tone: 'bg-cream text-ink border-ink/20 hover:border-ink/40' },
            { key: 'declined', label: "Can't make it", tone: 'bg-cream text-ink border-ink/20 hover:border-ink/40' },
          ] as const
        ).map((option) => (
          <label
            key={option.key}
            className={`flex h-16 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:checked]:ring-2 has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-cream ${
              guest.rsvp_status === option.key
                ? 'border-terracotta bg-terracotta text-cream ring-2 ring-terracotta'
                : option.tone
            }`}
          >
            <input
              type="radio"
              name="rsvp_status"
              value={option.key}
              defaultChecked={guest.rsvp_status === option.key}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="meal_preference"
          label="Meal preference"
          defaultValue={guest.meal_preference ?? 'no_preference'}
          options={[
            ['no_preference', 'No preference'],
            ['beef', 'Beef'],
            ['chicken', 'Chicken'],
            ['fish', 'Fish'],
            ['vegetarian', 'Vegetarian'],
            ['vegan', 'Vegan'],
            ['kids', 'Kids'],
          ]}
        />
        <Field
          id="dietary_restrictions"
          label="Dietary notes"
          defaultValue={guest.dietary_restrictions ?? ''}
          placeholder="halal · nut allergy · …"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="block text-sm font-medium text-ink">
          A note to the couple (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={guest.notes ?? ''}
          className="input-field min-h-[88px] resize-y py-2"
          placeholder="Anything you'd like Maria &amp; Juan to know."
        />
      </div>

      {limited ? null : (
        <p className="text-xs text-ink/50">
          You&rsquo;ll be able to add a song request, dance style, and Photo Challenge
          opt-in when you sign up for a free Setnayan account.
        </p>
      )}

      <button type="submit" className="button-primary w-full sm:w-auto">
        Save RSVP
      </button>
    </form>
  );
}

function RsvpPill({ status }: { status: GuestRow['rsvp_status'] }) {
  const tone: Record<GuestRow['rsvp_status'], string> = {
    attending: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    declined: 'bg-rose-100 text-rose-800',
    maybe: 'bg-ink/10 text-ink/70',
  };
  const label =
    status === 'attending'
      ? 'Going'
      : status === 'pending'
        ? 'Pending'
        : status === 'declined'
          ? 'Declined'
          : 'Maybe';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone[status]}`}>
      {label}
    </span>
  );
}

function Field({
  id,
  label,
  defaultValue,
  placeholder,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

function Select({
  id,
  label,
  options,
  defaultValue,
}: {
  id: string;
  label: string;
  options: [string, string][];
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="input-field appearance-none bg-cream pr-8"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
