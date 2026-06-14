import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Zap, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { QuickAddList } from './_components/quick-add-list';
import { FormFlash } from '@/app/_components/forms/form-flash';

export const metadata = { title: 'Quick add guests' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const ERROR_COPY: Record<string, string> = {
  missing: 'No guest data was submitted. Try again.',
  parse: 'We could not read the guest list. Try again.',
  empty: 'Add at least one name before uploading.',
  too_many: 'Up to 500 names per upload — split into multiple batches.',
};

export default async function QuickAddGuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const errorKey = search.error ?? null;
  const errorMsg = errorKey
    ? (ERROR_COPY[errorKey] ?? decodeURIComponent(errorKey))
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to guest list
      </Link>

      <header className="mb-6 space-y-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          <Zap aria-hidden className="h-3 w-3" strokeWidth={2} />
          Quick add
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          List your guests, one row at a time.
        </h1>
        <p className="text-base text-ink/65">
          Type a first name &rarr; press{' '}
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">
            Enter
          </kbd>{' '}
          &rarr; type a last name &rarr; press{' '}
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">
            Enter
          </kbd>{' '}
          again. Repeat until you&rsquo;re done, then click{' '}
          <span className="inline-flex items-center gap-1 font-medium">
            <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Upload to guest list
          </span>
          .
        </p>
      </header>

      {errorMsg ? (
        <FormFlash tone="error">
          {errorMsg}
        </FormFlash>
      ) : null}

      <QuickAddList eventId={eventId} />

      <p className="mt-6 text-xs text-ink/55">
        Need more control? Use{' '}
        <Link
          href={`/dashboard/${eventId}/guests/new`}
          className="text-terracotta underline-offset-4 hover:underline"
        >
          Add full guest
        </Link>{' '}
        to set role, side, RSVP, meal, plus-one, and notes at create time. Or{' '}
        <Link
          href={`/dashboard/${eventId}/guests/import`}
          className="text-terracotta underline-offset-4 hover:underline"
        >
          import a CSV
        </Link>{' '}
        if you already have a spreadsheet.
      </p>
    </div>
  );
}
