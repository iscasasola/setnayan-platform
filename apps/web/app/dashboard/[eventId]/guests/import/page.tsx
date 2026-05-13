import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { importGuestsCsv } from './actions';

export const metadata = { title: 'Import guests' };

const TEMPLATE_CSV = `first_name,last_name,side,group,role,household,plus_one_allowed,email,mobile,rsvp_status
Maria,Santos,bride,family,principal_sponsor,Santos household,false,maria.santos@example.ph,+639171234567,pending
Juan,Reyes,groom,friends,best_man,,false,juan.reyes@example.ph,+639179876543,attending
Anna,Cruz,bride,school,bridesmaid,,true,anna.cruz@example.ph,,pending`;

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ImportGuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const errorMessage = search.error ? decodeURIComponent(search.error) : null;

  const action = importGuestsCsv.bind(null, eventId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          ‹ Back to guest list
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Import guests from CSV</h1>
        <p className="text-sm text-ink/60">
          Paste up to 200 rows. First row must be a header. Empty cells use defaults
          (side &rarr; both · group &rarr; friends · role &rarr; guest · rsvp_status &rarr; pending).
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

      <section className="rounded-lg border border-ink/10 bg-cream p-4">
        <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-ink/55">
          Accepted columns
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          <code>first_name</code> · <code>last_name</code> · <code>side</code> · <code>group</code> ·
          <code> role</code> · <code>household</code> · <code>plus_one_allowed</code> ·
          <code> email</code> · <code>mobile</code> · <code>rsvp_status</code>
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-terracotta hover:underline">
            Show template
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-ink/5 p-3 text-[11px] leading-relaxed text-ink/80">
{TEMPLATE_CSV}
          </pre>
        </details>
      </section>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="csv" className="block text-sm font-medium text-ink">
            CSV content
          </label>
          <textarea
            id="csv"
            name="csv"
            rows={14}
            placeholder={TEMPLATE_CSV}
            className="input-field min-h-[260px] resize-y py-3 font-mono text-xs leading-relaxed"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton className="button-primary" pendingLabel="Importing…">
            Import guests
          </SubmitButton>
          <Link
            href={`/dashboard/${eventId}/guests`}
            className="button-secondary"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
