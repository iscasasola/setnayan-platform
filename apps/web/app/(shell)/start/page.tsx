/**
 * `/start` — "What kind of event are you planning?", BEFORE sign-up.
 *
 * Owner, 2026-10-25 (answering the front-door PR #6907): the home page's
 * "Start your event — free" opens a public type picker, and each type goes
 * straight to its own `/onboarding/<type>`; the account is asked for where each
 * onboarding already asks for it. It is NOT a new picker: the grid is the
 * shipped create-event `EventTypePhotoPicker`, the roster is the same
 * `getCreatableEventTypes()`, the words are the shipped heading, and where a
 * tap goes is the shared rule (`startHrefFor` → `onboardingRouteFor`, the one
 * the signed-in picker uses), always an onboarding, never sign-up first. What it leaves out is everything that needs an account (who it is for,
 * the wedding-in-planning router, the inline form, samahan).
 *
 * Signed in, the full picker already exists — `/dashboard/create-event`.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { experienceQuizEnabled } from '@/lib/experience-quiz';
import { startHrefFor } from '@/app/dashboard/(account)/create-event/_components/event-types';
import { StartTypeGrid } from './_components/start-type-grid';

export const metadata: Metadata = {
  title: 'Start your event',
  description: 'Pick the kind of event you are planning — free to start.',
  alternates: { canonical: '/start' },
};

export default async function StartPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user && !user.is_anonymous) redirect('/dashboard/create-event');

  const types = await getCreatableEventTypes();
  const quizOn = experienceQuizEnabled();
  /*
    Every tile goes to its own `/onboarding/<type>` — no sign-up in front. Owner
    2026-10-25: "Yes they can create an event. But saving an event must link by
    logging in." Each onboarding asks for the account at its save, as it always has.
  */
  const hrefs: Record<string, string> = {};
  for (const t of types) hrefs[t.key] = startHrefFor(t, quizOn);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8" data-start-picker="">
      <header className="mb-8 space-y-2">
        <h1 className="sn-h1">What kind of event are you planning?</h1>
        <p className="text-base text-ink/65">Tap a type to begin.</p>
      </header>
      <StartTypeGrid types={types} hrefs={hrefs} />
    </div>
  );
}
