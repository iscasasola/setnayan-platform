import Link from 'next/link';
import { EventTypePicker } from './_components/event-type-picker';

export const metadata = { title: 'Create event' };

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please give the event a name.',
  invalid_type: 'Only weddings are supported in V1. The other event types are coming soon.',
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
          Weddings ship first in V1. The other categories are on the roadmap — swipe through to see what is coming.
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
