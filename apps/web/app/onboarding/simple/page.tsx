import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { SubmitButton } from '@/app/_components/submit-button';
import { commitSimpleEvent } from './actions';

export const metadata = { title: 'Create a Simple Event' };

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please give your event a name.',
  missing_date: 'Please pick a date for your event.',
};

type SearchParams = Promise<{ error?: string }>;

/**
 * /onboarding/simple — the lean, date-only onboarding for a Simple Event (owner
 * 2026-06-27). A Simple Event is vendor-free: the only things we ask are a name
 * and a date; everything after is the in-app Setnayan services. The create-event
 * picker jumps here via event_type_vocab.onboarding_href when "Simple Event" is
 * chosen. Login-required (the picker is an authed surface).
 */
export default async function SimpleOnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/onboarding/simple');

  // If the type isn't live in the create-roster, send them back to the picker.
  const creatable = await getCreatableEventTypes();
  if (!creatable.some((t) => t.key === 'simple_event')) {
    redirect('/dashboard/create-event');
  }

  const params = await searchParams;
  const errorMessage = params.error ? (ERROR_COPY[params.error] ?? params.error) : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href="/dashboard/create-event"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Let’s set the date.
        </h1>
        <p className="text-base text-ink/60">
          A name and a date are all we need — everything else is Setnayan’s in-app services.
        </p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <form action={commitSimpleEvent} className="space-y-6">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="display_name">
            Event name <span className="text-terracotta">*</span>
          </label>
          <input
            autoComplete="off"
            autoFocus
            className="input-field"
            id="display_name"
            name="display_name"
            placeholder="Our celebration"
            required
            type="text"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="event_date">
            Date <span className="text-terracotta">*</span>
          </label>
          <input
            className="input-field"
            id="event_date"
            name="event_date"
            required
            type="date"
          />
          <p className="text-xs text-ink/50">You can change this later in event settings.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Creating event…">
            Create event
          </SubmitButton>
          <Link className="button-secondary w-full sm:w-auto" href="/dashboard">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
