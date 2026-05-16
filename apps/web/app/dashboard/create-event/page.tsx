import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { createWeddingEvent } from './actions';

export const metadata = { title: 'Create event' };

const EVENT_TYPES = [
  { key: 'wedding', label: 'Weddings', emoji: '💍', enabled: true },
  { key: 'birthday', label: 'Birthday', emoji: '🎂', enabled: false },
  { key: 'celebration', label: 'Celebration', emoji: '🥂', enabled: false },
  { key: 'travel', label: 'Travel', emoji: '✈️', enabled: false },
  { key: 'corporate', label: 'Corporate', emoji: '🏢', enabled: false },
  { key: 'burial', label: 'Burial', emoji: '🕊️', enabled: false },
] as const;

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
          Weddings ship first in V1. The other five categories are on the roadmap.
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

      <section
        aria-label="Event type"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {EVENT_TYPES.map((type) => (
          <div
            key={type.key}
            className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 ${
              type.enabled
                ? 'border-ink/15 bg-cream'
                : 'cursor-not-allowed border-ink/10 bg-ink/[0.03] opacity-60'
            }`}
            aria-disabled={!type.enabled}
          >
            <span aria-hidden className="text-2xl">
              {type.emoji}
            </span>
            <span className="text-base font-medium text-ink">{type.label}</span>
            {!type.enabled ? (
              <span className="absolute right-3 top-3 rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
                Coming soon
              </span>
            ) : (
              <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
                V1
              </span>
            )}
          </div>
        ))}
      </section>

      <form action={createWeddingEvent} className="mt-10 space-y-5">
        <input type="hidden" name="event_type" value="wedding" />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="display_name">
            Event name <span className="text-terracotta">*</span>
          </label>
          <input
            autoComplete="off"
            className="input-field"
            id="display_name"
            name="display_name"
            placeholder="Maria &amp; Juan"
            required
            type="text"
          />
          <p className="text-xs text-ink/50">
            Usually both names. Date and venue are added later from event settings.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Creating event…">
            Create wedding event
          </SubmitButton>
          <Link className="button-secondary w-full sm:w-auto" href="/dashboard">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
