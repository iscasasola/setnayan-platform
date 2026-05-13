import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { formatEventDate } from '@/lib/events';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { submitRsvp } from './actions';
import { CountdownWidget } from './_components/countdown';

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
  searchParams: Promise<{ invite?: string; invite_error?: string }>;
};

export default async function PublicInvitationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const invite = (search.invite ?? '').trim();
  const inviteError = search.invite_error ?? null;

  if (!slug || RESERVED_TOP_LEVEL.has(slug)) notFound();

  // If an invite token is in the URL, hand off to the redeem route handler
  // which can write the session cookie (Server Components in Next 15 can't).
  if (invite) {
    redirect(
      `/${slug}/redeem?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(invite)}`,
    );
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select(
      'event_id, public_id, display_name, event_date, venue_name, venue_address, event_type, slug',
    )
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) notFound();
  if (event.event_type !== 'wedding') notFound();

  // Read the guest-session cookie (read-only — pages can't write cookies).
  const session = await readGuestSession();

  if (!session) {
    return (
      <PublicLanding
        event={event}
        reason={inviteError === 'invalid_token' ? 'invalid_invite' : null}
      />
    );
  }

  // Cookie session is for a different event → bail to public landing.
  // (Sign-out from the footer is how a guest swaps between events.)
  if (session.event_id !== event.event_id) {
    return <PublicLanding event={event} reason="wrong_event" />;
  }

  const { data: guest } = await admin
    .from('guests')
    .select(
      'guest_id, first_name, last_name, display_name, role, side, group_category, plus_one_of_guest_id, plus_one_mode, plus_one_name_confirmed_at, rsvp_status, meal_preference, dietary_restrictions, notes, custom_tags, qr_token',
    )
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!guest) {
    return <PublicLanding event={event} reason="invalid_invite" />;
  }

  // TBA +1 still hasn't confirmed their name — re-route them to onboarding.
  const isUnconfirmedTba =
    guest.plus_one_of_guest_id !== null &&
    !guest.plus_one_name_confirmed_at &&
    (!guest.first_name || guest.first_name.toLowerCase() === 'tba');
  if (isUnconfirmedTba) {
    redirect(`/${slug}/welcome`);
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
  reason?: 'invalid_invite' | 'wrong_event' | null;
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

        {/* Countdown — client-side ticking widget. Auto-hides once the wedding starts. */}
        {event.event_date ? <CountdownWidget targetIso={event.event_date} /> : null}

        {/* Venues */}
        <VenueWidget event={event} />

        {/* Dress code */}
        <DressCodeWidget />

        {/* Photo moments */}
        <PhotoMomentsWidget />

        {/* Your photos (placeholder) */}
        <YourPhotosWidget limited={isLimitedPlusOne} />

        {/* Public vs Registered tier comparison */}
        <TierComparisonWidget limited={isLimitedPlusOne} />

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

// ---------------------------------------------------------------------------
// Additional widgets (closing 0002 deferrals)
// ---------------------------------------------------------------------------

function VenueWidget({ event }: { event: EventRow }) {
  const mapsHref = event.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}`
    : null;

  return (
    <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Venue</p>
      <div className="overflow-hidden rounded-lg border border-ink/10">
        <div className="h-32 bg-gradient-to-br from-terracotta/30 via-amber-100 to-emerald-100" />
        <div className="space-y-2 bg-cream p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
            Ceremony &amp; Reception
          </p>
          <h3 className="text-xl font-semibold tracking-tight">
            {event.venue_name ?? 'Venue to be confirmed'}
          </h3>
          {event.venue_address ? (
            <p className="text-sm text-ink/65">{event.venue_address}</p>
          ) : null}
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary mt-2 inline-flex"
            >
              Get directions
            </a>
          ) : null}
          <p className="mt-2 text-xs text-ink/45">
            Pro tier ships Waze + Google Maps deep links via iteration 0004 widgets.
          </p>
        </div>
      </div>
    </section>
  );
}

function DressCodeWidget() {
  const palette = [
    { name: 'Cream', hex: '#FAF7F2' },
    { name: 'Champagne', hex: '#E8D9B3' },
    { name: 'Capiz', hex: '#F0E1D2' },
    { name: 'Terracotta', hex: '#C97B4B' },
    { name: 'Midnight', hex: '#1A1A1A' },
  ];

  return (
    <section className="space-y-5 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Dress code</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">Look magical</h3>
      </header>
      <p className="text-sm text-ink/70">
        Formal evening wear. Lean into the palette. A little sparkle, sequins, or velvet —
        encouraged. Dress like the night was made for you.
      </p>
      <div className="flex flex-wrap gap-3">
        {palette.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-xs text-ink/70">
            <span
              aria-hidden
              className="inline-block h-6 w-6 rounded-full ring-1 ring-ink/10"
              style={{ backgroundColor: p.hex }}
            />
            {p.name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em]">Do</p>
          <ul className="space-y-1">
            <li>· Long gowns, ternos, tuxedos, well-cut suits</li>
            <li>· Lean into the palette</li>
            <li>· A little sparkle, sequins, or velvet</li>
          </ul>
        </div>
        <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em]">Don&rsquo;t</p>
          <ul className="space-y-1">
            <li>· No barong tagalog</li>
            <li>· No white or ivory — reserved for the bride</li>
            <li>· No jeans / t-shirts</li>
            <li>· No flash photography during the Mass</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function PhotoMomentsWidget() {
  const moments = [
    { time: '3:00 PM', label: 'Ceremony', title: 'The Bridal Walk', note: 'Processional · everyone stands' },
    { time: '3:45 PM', label: 'Ceremony', title: 'The Kiss', note: 'After the vows · cheer when ready' },
    { time: '6:30 PM', label: 'Reception', title: 'First Entrance', note: 'Newlyweds entering the reception' },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
          Savour the moments
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">Phone-down moments</h3>
      </header>
      <p className="text-sm text-ink/70">
        We&rsquo;ll have <strong>shutterbugs</strong> around to make sure you have photos
        of the event — so we&rsquo;d love it if you&rsquo;d savour these moments with us,
        and skip the videos. Just witness them.
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {moments.map((m) => (
          <li
            key={m.title}
            className="space-y-1 rounded-lg border border-ink/10 bg-cream p-4 text-sm"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
              {m.time} · {m.label}
            </p>
            <p className="font-medium text-ink">{m.title}</p>
            <p className="text-xs text-ink/60">{m.note}</p>
          </li>
        ))}
      </ul>
      <p className="rounded-lg border border-dashed border-ink/20 bg-cream p-3 text-center text-xs italic text-ink/60">
        Shutterbugs cover the angles. Your job is to clap, cheer, and be in the room.
      </p>
    </section>
  );
}

function YourPhotosWidget({ limited }: { limited: boolean }) {
  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Your photos</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">All curated for you</h3>
      </header>

      <div className="rounded-lg border border-dashed border-ink/20 bg-cream p-5 text-center text-sm text-ink/60">
        All your photos will appear here after the event.
      </div>

      <div className="rounded-lg border border-ink/10 bg-cream p-5 text-sm">
        <p className="font-medium text-ink">Make sure a shutterbug snaps you on the wedding day</p>
        <p className="mt-1 text-ink/60">
          Your first tagged photo automatically becomes your profile picture in the gallery.
        </p>
      </div>

      {limited ? (
        <p className="text-xs text-ink/55">
          Your photos will be visible in your inviter&rsquo;s gallery.
        </p>
      ) : (
        <div className="rounded-lg border border-terracotta/30 bg-gradient-to-br from-terracotta/10 to-cream p-5 text-sm">
          <p className="font-medium text-ink">Add more via Shutter</p>
          <p className="mt-1 text-ink/65">
            You can also add your own photos and videos through Shutter, our in-app camera.
            Tag up to 5 guests per post — the couple is tagged for you automatically.
          </p>
          <p className="mt-3 text-xs italic text-ink/45">
            Shutter ships with the Setnayan native app (Phase 2).
          </p>
        </div>
      )}
    </section>
  );
}

function TierComparisonWidget({ limited }: { limited: boolean }) {
  if (limited) {
    return (
      <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your access
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">Two ways to celebrate</h3>
        </header>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&rsquo;re a +1 to your inviter. Your photos will appear in their gallery —
          ask them to show you. Want full access? You can register your own Setnayan account
          anytime — but for this wedding, you&rsquo;re invited as their +1.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-dashed border-ink/15 bg-cream p-5 opacity-55">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              Public
            </p>
            <p className="text-sm text-ink/60">View invitation · RSVP · 3-day photo window</p>
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-terracotta/30 bg-cream p-5 opacity-55">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
              Registered (locked for +1s)
            </p>
            <p className="text-sm text-ink/60">
              Shutter · Selfie Camera · Photo Challenges · Saved Forever · Reel builder
            </p>
          </div>
        </div>
        <a
          href="https://setnayan.com"
          className="button-secondary inline-flex"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more about Setnayan
        </a>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Your access</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">Two ways to celebrate</h3>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-ink/15 bg-cream p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
            Public · As you are now
          </p>
          <p className="font-medium text-ink">Free · No sign-up needed</p>
          <ul className="space-y-1 text-sm text-ink/70">
            <li>· View this invitation</li>
            <li>· RSVP for the wedding</li>
            <li>· See your tagged photos for <strong>3 days</strong></li>
            <li>· Save your QR to your phone</li>
          </ul>
          <p className="text-xs italic text-ink/50">
            Photos delete from your view after 3 days unless you sign up.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-terracotta/40 bg-gradient-to-br from-terracotta/10 to-cream p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
            With Setnayan account
          </p>
          <p className="font-medium text-ink">Free · One-tap sign-up</p>
          <ul className="space-y-1 text-sm text-ink/75">
            <li>· Everything in Public</li>
            <li>· <strong>Shutter</strong> — capture &amp; tag photos as a guest</li>
            <li>· <strong>Selfie Camera</strong> — branded wedding selfie cam</li>
            <li>· <strong>Photo &amp; Video Challenges</strong> — fun mini-quests</li>
            <li>· <strong>Saved Forever</strong> — photos kept permanently</li>
            <li>· Build your own souvenir reel</li>
          </ul>
          <Link href="/signup" className="button-primary inline-flex">
            Sign up free →
          </Link>
        </div>
      </div>
    </section>
  );
}
