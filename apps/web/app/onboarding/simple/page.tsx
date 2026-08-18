import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { SubmitButton } from '@/app/_components/submit-button';
import { onboardingServicesStepEnabled } from '@/lib/onboarding/services-step-flag';
import { readServicesStepView } from '@/lib/onboarding/services-step-server';
import { PapicStepFields } from './_components/papic-step-fields';
import { commitSimpleEvent } from './actions';

export const metadata = { title: 'Create a Simple Event' };

import { SHOP_ACCOUNT_CANNOT_CREATE_COPY } from '@/lib/vendor-event-creation';

const ERROR_COPY: Record<string, string> = {
  shop_account: SHOP_ACCOUNT_CANNOT_CREATE_COPY,
  missing_name: 'Please give your event a name.',
  missing_date: 'Please pick a date for your event.',
  // Kept apart deliberately — see the same pair in the create-event picker.
  // `create_failed` = nothing survived, retrying is safe. `create_incomplete` =
  // a half-made event could not be rolled back, so "try again" would duplicate.
  create_failed:
    'We couldn’t create that event. Nothing was charged — please try again.',
  create_incomplete:
    'We couldn’t finish creating that event, and part of it may have been saved. Please contact us before trying again so we don’t make a duplicate.',
};

/** Anything we did not write copy for. NEVER the raw value — it was the
 *  database's own message, and this page used to print it to the customer. */
const GENERIC_ERROR =
  'We couldn’t create that event. Nothing was charged — please try again.';

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
  const errorMessage = params.error ? (ERROR_COPY[params.error] ?? GENERIC_ERROR) : null;

  // The services step. This route is NOT a wizard — it is one form — so "adding
  // the step" means adding the card beneath the form, not inserting a screen.
  //
  // It is a ONE-card step here and that is not a special case: `simple_event` is
  // `marketplaceEnabled = false`, so the vendor-free gate inside
  // readServicesStepView returns `ai: null` and the assistant card never
  // renders. Derived, never named by type — the same house rule as
  // lib/papic-event-access.ts. The page's own promise ("everything else is
  // Setnayan's in-app services") finally has something behind it.
  const servicesStepView = onboardingServicesStepEnabled()
    ? await readServicesStepView(supabase, 'simple_event')
    : null;

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

        {/* The Papic picker (owner 2026-08-11). INSIDE the form on purpose — it
            posts its picks as hidden inputs, which commitSimpleEvent reads. It
            sits ABOVE the submit button because it is now a question being
            asked, not a note being left after the decision. */}
        {servicesStepView ? (
          <PapicStepFields className="pt-2" view={servicesStepView} />
        ) : null}

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
