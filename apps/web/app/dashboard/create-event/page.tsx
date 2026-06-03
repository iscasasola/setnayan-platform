import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EventTypePicker } from './_components/event-type-picker';
import type { LaunchStatusRow } from './_components/wedding-type-picker';
/* Retired 2026-05-28 V2 cutover — CONCIERGE_ENABLED import removed.
   V2 has no Concierge choice card on create-event; every new event
   lands in DIY by default. */

export const metadata = { title: 'Create event' };

const ERROR_COPY: Record<string, string> = {
  missing_name: 'Please give the event a name.',
  invalid_type:
    'Setnayan is opening one event type at a time — pick Wedding to continue, or tap an upcoming tile to be notified when it opens.',
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

  // Iteration 0043 — read which faiths are active in this region so the
  // picker can render Coming Soon cards correctly. RLS lets anon + auth
  // read the table; if the query fails (auth blip, db hiccup) we fall
  // back to the all-active baseline (owner-directed 2026-06-03 "unlock all
  // religions"; migration 20260803000000 flips every row to 'active').
  const supabase = await createClient();
  const { data: launchRows } = await supabase
    .from('wedding_type_launch_status')
    .select('ceremony_type, status')
    .eq('region', 'all');

  const launchStatus: LaunchStatusRow[] = (launchRows as LaunchStatusRow[] | null) ?? [
    { ceremony_type: 'catholic',  status: 'active' },
    { ceremony_type: 'civil',     status: 'active' },
    { ceremony_type: 'christian', status: 'active' },
    { ceremony_type: 'inc',       status: 'active' },
    { ceremony_type: 'muslim',    status: 'active' },
    { ceremony_type: 'cultural',  status: 'active' },
  ];

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
          Weddings are live today. Swipe through to see the other event types
          on their way — tap one to be notified the moment it opens.
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

      <EventTypePicker launchStatus={launchStatus} />
    </div>
  );
}
