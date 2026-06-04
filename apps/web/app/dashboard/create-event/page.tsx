import Link from 'next/link';
import { EventTypePicker } from './_components/event-type-picker';
/* Retired 2026-05-28 V2 cutover — CONCIERGE_ENABLED import removed.
   V2 has no Concierge choice card on create-event; every new event
   lands in DIY by default. */

export const metadata = { title: 'Create event' };

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please give the event a name.',
  invalid_type:
    "That event type isn't available yet — pick one to continue.",
  missing_ceremony_type:
    'Pick a wedding type so we can match vendors compatible with your ceremony.',
  missing_sub_type: 'Pick a tradition for the ceremony type you chose.',
  missing_secondary: 'Pick a secondary ceremony for your interfaith wedding.',
};

type SearchParams = Promise<{ error?: string }>;

export default async function CreateEventPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawError = params.error ? decodeURIComponent(params.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href="/dashboard"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to events
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What kind of event are you planning?
        </h1>
        <p className="text-base text-ink/60">
          Tap a type to begin.
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

      <EventTypePicker />
    </div>
  );
}
