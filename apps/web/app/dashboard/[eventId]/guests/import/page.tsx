import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { importGuestsCsv } from './actions';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { eventHasSides } from '@/lib/guest-side-question';
import { guestTemplateFor } from '@/lib/guest-import-file';

export const metadata = { title: 'Import guests' };

const TEMPLATE_CSV = `first_name,last_name,side,group,role,household,plus_one_allowed,email,mobile,rsvp_status
Maria,Santos,bride,family,principal_sponsor_ninang,Santos household,false,maria.santos@example.ph,+639171234567,pending
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
  // A wedding gets the file with the Side column; every other type the general one.
  const template = guestTemplateFor(eventHasSides(await resolveRoleSetForEvent(eventId)));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <Link
          href={`/dashboard/${eventId}/guests`}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta-700"
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
        <h2 className="text-base font-semibold text-ink">1 · Get the guest list file</h2>
        <p className="mt-1 text-sm text-ink/70">
          Fill it in with Excel, Numbers or Google Sheets — one person per row.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href={template.xlsx} download className="button-primary">
            Download for Excel / Numbers
          </a>
          <a href={template.csv} download className="text-sm font-medium text-terracotta-700 hover:underline">
            CSV
          </a>
        </div>
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
