import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { formatEventDate } from '@/lib/events';
import { abandonPlusOneInvite, confirmPlusOneName } from './actions';

export const metadata = { title: 'Welcome' };
export const dynamic = 'force-dynamic';

const ERROR_COPY: Record<string, string> = {
  missing: 'Please enter both your first and last name.',
  too_long: 'Names can be at most 80 characters.',
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function WelcomePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

  const session = await readGuestSession();
  if (!session) redirect(`/${slug}`);

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('event_id, display_name, event_date, slug')
    .ilike('slug', slug)
    .maybeSingle();
  if (!event) notFound();

  if (event.event_id !== session.event_id) redirect(`/${slug}`);

  const { data: guest } = await admin
    .from('guests')
    .select(
      'guest_id, first_name, last_name, plus_one_of_guest_id, plus_one_name_confirmed_at',
    )
    .eq('guest_id', session.guest_id)
    .maybeSingle();
  if (!guest) redirect(`/${slug}`);

  // If they're not a +1, or already confirmed, bounce to the real invitation site.
  if (
    !guest.plus_one_of_guest_id ||
    guest.plus_one_name_confirmed_at ||
    (guest.first_name && guest.first_name.toLowerCase() !== 'tba')
  ) {
    redirect(`/${slug}`);
  }

  const { data: primary } = await admin
    .from('guests')
    .select('first_name, last_name, display_name')
    .eq('guest_id', guest.plus_one_of_guest_id)
    .maybeSingle();

  const primaryName =
    primary?.display_name?.trim() ||
    [primary?.first_name, primary?.last_name].filter(Boolean).join(' ') ||
    'the inviting guest';

  const errorKey = search.error ?? null;
  const errorMessage = errorKey ? (ERROR_COPY[errorKey] ?? errorKey) : null;

  const confirmAction = confirmPlusOneName.bind(null, slug);
  const abandonAction = abandonPlusOneInvite.bind(null, slug);

  return (
    <main className="min-h-dvh bg-cream text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
        <header className="space-y-3 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            You&rsquo;re invited!
          </p>
          <h1 className="font-serif text-3xl italic leading-tight text-ink sm:text-4xl">
            You are the +1 of {primaryName}
          </h1>
          <p className="mx-auto max-w-prose text-sm text-ink/65">
            {primary?.first_name ?? 'They'} didn&rsquo;t have your details yet when they
            sent in their RSVP, so let&rsquo;s get you set up. This takes 10 seconds.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">
            {event.display_name} · {formatEventDate(event.event_date)}
          </p>
        </header>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
          >
            {errorMessage}
          </p>
        ) : null}

        <form action={confirmAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink" htmlFor="first_name">
                First name
              </label>
              <input
                id="first_name"
                name="first_name"
                autoComplete="given-name"
                required
                maxLength={80}
                className="input-field"
                placeholder="Andres"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink" htmlFor="last_name">
                Last name
              </label>
              <input
                id="last_name"
                name="last_name"
                autoComplete="family-name"
                required
                maxLength={80}
                className="input-field"
                placeholder="Tan"
              />
            </div>
          </div>

          <p className="text-xs italic text-ink/50">
            This name will appear on your invitation, in the couple&rsquo;s guest list, and
            on photos you&rsquo;re tagged in.
          </p>

          <button type="submit" className="button-primary h-14 w-full text-base">
            Correct — that&rsquo;s me
          </button>
        </form>

        <form action={abandonAction} className="text-center">
          <button
            type="submit"
            className="text-sm text-ink/60 underline-offset-4 hover:underline"
          >
            This isn&rsquo;t me — I scanned the wrong code
          </button>
        </form>
      </div>
    </main>
  );
}
