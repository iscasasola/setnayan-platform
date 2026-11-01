import Link from 'next/link';
import { Share } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { importGuestsCsv } from './actions';
import { GuestImportForm } from './import-form';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { eventHasSides } from '@/lib/guest-side-question';
import { guestTemplateFor } from '@/lib/guest-import-file';

export const metadata = { title: 'Import guests' };

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function ImportGuestsPage({ params }: Props) {
  const { eventId } = await params;

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
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Import guests from a file</h1>
        <p className="text-sm text-ink/60">
          Get the guest list file, fill it in, and upload it. You&rsquo;ll see everyone before anything is added.
        </p>
      </header>

      <section className="rounded-lg border border-ink/10 bg-cream p-4">
        <h2 className="text-base font-semibold text-ink">1 · Get the guest list file</h2>
        <p className="mt-1 text-sm text-ink/70">
          Fill it in with Excel, Numbers or Google Sheets — one person per row.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* 📥 Saved, never shown in place — the app's web view renders a file with no way back (owner 2026-10-27). */}
          <SaveFileLink href={template.xlsx} filename={template.xlsx.split('/').pop() ?? 'setnayan-guest-list.xlsx'} className="button-primary inline-flex items-center gap-1.5">
            <Share aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Download for Excel / Numbers
          </SaveFileLink>
          <a
            href={template.googleSheets}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-terracotta-700 hover:underline"
          >
            Open in Google Sheets
          </a>
          <SaveFileLink
            href={template.csv}
            filename={template.csv.split('/').pop() ?? 'setnayan-guest-list.csv'}
            className="text-sm font-medium text-terracotta-700 hover:underline"
          >
            CSV
          </SaveFileLink>
        </div>
      </section>

      <GuestImportForm action={action} />
    </div>
  );
}
