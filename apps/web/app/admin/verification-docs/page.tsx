import { FileWarning, ShieldCheck, HelpCircle } from 'lucide-react';

import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { buildVerificationDocsReport } from '@/lib/verification-docs-server';
import { formatDocSize } from '@/lib/verification-docs';
import { deleteVerificationDoc, viewVerificationDoc } from './actions';

/**
 * ADMIN · Vendor verification documents.
 *
 * What a vendor uploaded to prove who they are: a government ID, a DTI
 * certificate, a BIR 2303, a mayor's permit, a bank proof. The most sensitive
 * personal data on the platform, in its own bucket, on its own page — a
 * passport photo has no business sitting in a screen called "Website media".
 *
 * The page answers one question per file: **is anything still pointing at
 * this?** In use = a vendor record names it. Left over = nothing does, because
 * it was replaced by a re-upload or the application was abandoned. Not sure =
 * the key is a shape we do not recognise, and that file is deliberately NOT
 * deletable — if we cannot say whose it is, we do not remove it.
 *
 * 🪤 **Prose is not a safety mechanism.** An earlier media page carried a
 * paragraph explaining that a section was "probably left over" while a live
 * file sat inside it with Delete switched on. Here the label and the button
 * come from the SAME check, re-derived at press time, so they cannot disagree.
 */

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  nokey: 'Nothing happened — that request carried no file.',
  refs: 'Nothing was deleted. The check for what is still in use could not run, so no file could be proven safe to remove.',
  inuse:
    'Nothing was deleted. That file is still referenced by a vendor record, or its name is a shape this page does not recognise.',
  delete: 'The file could not be deleted. Nothing changed.',
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function VerificationDocsPage({ searchParams }: Props) {
  const params = await searchParams;
  const errorKey = first(params.error);
  const deleted = first(params.deleted) === '1';

  const report = await buildVerificationDocsReport();
  const inUse = report.docs.filter((d) => d.state === 'in_use');
  const leftOver = report.docs.filter((d) => d.state === 'left_over');
  const unknown = report.docs.filter((d) => d.state === 'unrecognised');

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/55">
          Admin · Identity documents
        </p>
        <h1 className="text-2xl font-semibold text-ink">Vendor verification documents</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
          What vendors uploaded to prove who they are — government IDs, permits, bank proofs.
          Each file is checked against every vendor record: if nothing points at it any more,
          it is left over and you can remove it. Deleting is permanent and there is no undo.
        </p>
      </header>

      {deleted ? (
        <p className="rounded-lg border border-success-700/20 bg-success-100 px-4 py-3 text-sm text-success-900">
          Deleted. That file is gone from storage.
        </p>
      ) : null}
      {errorKey && ERRORS[errorKey] ? (
        <p className="rounded-lg border border-danger-900/20 bg-danger-100 px-4 py-3 text-sm text-danger-900">
          {ERRORS[errorKey]}
        </p>
      ) : null}

      {report.listingError ? (
        <p className="rounded-lg border border-danger-900/20 bg-danger-100 px-4 py-3 text-sm text-danger-900">
          Storage could not be read, so this page is showing nothing rather than an empty
          list that would look like &ldquo;there is nothing here&rdquo;. ({report.listingError})
        </p>
      ) : null}

      {/* The reason deletion is refused, stated where the buttons would be. An
          empty reference set from a FAILED read is indistinguishable from "no
          file is in use" — and acting on it would erase a live ID. */}
      {!report.referencesComplete ? (
        <p className="rounded-lg border border-danger-900/20 bg-danger-100 px-4 py-3 text-sm text-danger-900">
          Deleting is switched off on this page right now: the check for which files are still
          in use did not finish, so nothing can be proven safe to remove.{' '}
          {report.referenceError ? <span className="opacity-70">({report.referenceError})</span> : null}
        </p>
      ) : null}

      <Group
        title="Left over"
        icon={<FileWarning aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} />}
        blurb="Nothing points at these any more — replaced by a newer upload, or an application that was never finished."
        docs={leftOver}
        deletable={report.referencesComplete}
      />
      <Group
        title="In use"
        icon={<ShieldCheck aria-hidden className="h-4 w-4 text-success-700" strokeWidth={1.75} />}
        blurb="A vendor record still points at these. They cannot be deleted here."
        docs={inUse}
        deletable={false}
      />
      {unknown.length > 0 ? (
        <Group
          title="Not sure"
          icon={<HelpCircle aria-hidden className="h-4 w-4 text-ink/50" strokeWidth={1.75} />}
          blurb="These do not look like the usual upload, so this page will not guess whose they are. Look before doing anything with them."
          docs={unknown}
          deletable={false}
        />
      ) : null}

      {report.truncated ? (
        <p className="text-xs text-ink/55">
          There are more files than this page listed. What you see is a partial list.
        </p>
      ) : null}
    </section>
  );
}

function Group({
  title,
  icon,
  blurb,
  docs,
  deletable,
}: {
  title: string;
  icon: React.ReactNode;
  blurb: string;
  docs: Awaited<ReturnType<typeof buildVerificationDocsReport>>['docs'];
  deletable: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-ink">
          {title} <span className="font-normal text-ink/50">· {docs.length}</span>
        </h2>
      </div>
      <p className="text-xs leading-relaxed text-ink/60">{blurb}</p>
      {docs.length === 0 ? (
        <p className="rounded-lg border border-ink/10 bg-cream/60 px-4 py-3 text-sm text-ink/55">
          Nothing here.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10">
          {docs.map((d) => (
            <li key={d.key} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-ink">{d.key}</p>
                <p className="mt-0.5 text-xs text-ink/55">
                  {d.slot ? `${d.slot.replace(/_/g, ' ')} · ` : ''}
                  {formatDocSize(d.size)}
                  {d.lastModified ? ` · uploaded ${d.lastModified.slice(0, 10)}` : ''}
                </p>
              </div>
              <form action={viewVerificationDoc}>
                <input type="hidden" name="key" value={d.key} />
                <SubmitButton
                  pendingLabel="Opening…"
                  className="rounded-md bg-ink/5 px-2.5 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10"
                >
                  Download
                </SubmitButton>
              </form>
              {deletable ? (
                <ConfirmForm
                  action={deleteVerificationDoc}
                  message={`Permanently delete this file?\n\n${d.key}\n\nThis is someone's identity document. It cannot be recovered.`}
                >
                  <input type="hidden" name="key" value={d.key} />
                  <SubmitButton
                    pendingLabel="Deleting…"
                    className="rounded-md bg-ink/5 px-2.5 py-1.5 text-xs font-medium text-ink/70 hover:bg-danger-100 hover:text-danger-900"
                  >
                    Delete
                  </SubmitButton>
                </ConfirmForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
