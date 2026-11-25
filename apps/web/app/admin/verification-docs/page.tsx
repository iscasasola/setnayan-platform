import { PageMasthead } from '@/app/_components/page-masthead';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { buildVerificationDocsReport } from '@/lib/verification-docs-server';
import { verificationDocSupplierNames } from '@/lib/verification-doc-suppliers.server';
import {
  formatDocSize,
  verificationDocShelves,
  type VerificationDoc,
} from '@/lib/verification-docs';
import { deleteVerificationDoc, viewVerificationDoc } from './actions';
import { DOC_SLOTS } from '@/lib/vendor-verification';
import { actionButtonClass } from '@/components/action-button-class';
import {
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';

/**
 * ADMIN · Vendor verification documents.
 *
 * What a vendor uploaded to prove who they are: a government ID, a DTI
 * certificate, a BIR 2303, a mayor's permit — and, from before they were retired
 * (2026-07-03, 2026-11-14), a government ID or a bank proof. The most sensitive
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

export const metadata = { title: 'Verification documents · Admin' };

export const dynamic = 'force-dynamic';

/** The paper's own name, from the shop's verification list — null when the slot is not one we know. */
function paperName(slot: string | null): string | null {
  if (!slot) return null;
  // The ID is asked on its own step, not in `DOC_SLOTS`.
  if (slot === 'government_id') return 'Government ID';
  return DOC_SLOTS.find((s) => s.key === slot)?.label ?? null;
}

/** An upload's day in Manila (the storage stamp is UTC). */
function manilaDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

const ERRORS: Record<string, string> = {
  nokey: 'Nothing happened — that request carried no file.',
  refs: 'Nothing was deleted. The check for what is still in use could not run, or could not be read all the way to the end, so no file could be proven safe to remove.',
  inuse:
    'Nothing was deleted. That file is still referenced by a supplier record, or its name is a shape this page does not recognise, or no supplier record could be found pointing at anything at all — which is not proof the file is unused.',
  delete: 'The file could not be deleted. Nothing changed.',
};

/**
 * Titles and blurbs only. ⚖ Deliberately carries NO `deletable` — that
 * answer travels with the rows it applies to, from `verificationDocShelves`.
 */
const SHELVES: Record<
  VerificationDoc['state'],
  { title: string; blurb: string }
> = {
  left_over: {
    title: 'Left over',
    blurb:
      'Nothing points at these any more — replaced by a newer upload, or an application that was never finished.',
  },
  in_use: {
    title: 'In use',
    blurb: 'A supplier record still points at these. They cannot be deleted here.',
  },
  unrecognised: {
    title: 'Not sure',
    blurb:
      'These do not look like the usual upload, so this page will not guess whose they are. Look before doing anything with them.',
  },
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
  // 🛡 WHICH SHELF MAY OFFER A DELETE IS NOT DECIDED HERE. Both halves of that
  // binding — the rows and the permission — come from one object built in
  // `verificationDocShelves`, which a test CALLS. This file used to type
  // `deletable={...}` three times by hand, and two of those literals were
  // sabotaged GREEN at 90/90: the left-over shelf hardcoded to `true` (Delete
  // beside every file while every gate said no) and the IN-USE shelf hardcoded
  // to `true` (Delete beside a live government ID). A React server component is
  // not renderable by `node:test`, so those were unguardable where they sat.
  const shelves = verificationDocShelves(report);
  // 🏷 F-A-08: each paper names its supplier.
  const supplierNames = await verificationDocSupplierNames(report.docs.map((d) => d.vendorProfileId ?? ''));

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      {/* 📐 ADMIN CLEAN PORT (owner "ok", 19 Nov 2026 — reposition only): template sections and hairline rows. The
          lede moved VERBATIM behind the ⓘ of the one shelf that can delete — these are strangers&apos; government IDs
          and the only control is a permanent delete with no undo, so the sentence survives whole. */}
      <PageMasthead title="Supplier verification documents" />

      {deleted ? (
        <p role="status" className="mb-2 text-sm text-success-800">
          Deleted. That file is gone from storage.
        </p>
      ) : null}
      {errorKey && ERRORS[errorKey] ? (
        <p role="alert" className="mb-2 text-sm" style={{ color: 'rgb(var(--color-danger))' }}>
          {ERRORS[errorKey]}
        </p>
      ) : null}

      {report.listingError ? (
        <TemplateFail retryHref="/admin/verification-docs" data="listing">
          Storage could not be read, so this page is showing nothing rather than an empty
          list that would look like &ldquo;there is nothing here&rdquo;. ({report.listingError})
        </TemplateFail>
      ) : null}

      {/* The reason deletion is refused, stated where the buttons would be. An
          empty reference set is indistinguishable from "no file is in use" —
          whether it came from a FAILED read or from a reader that could not
          read the shape it was given, and acting on either would erase a live
          ID. Both now land here, and the sentence has to be true of both. */}
      {!report.referencesComplete ? (
        <TemplateFail retryHref="/admin/verification-docs" data="references">
          Deleting is switched off on this page right now: nothing here can be proven safe to
          remove, so nothing is offered for removal.{' '}
          {report.referenceError ? <span className="opacity-70">({report.referenceError})</span> : null}
        </TemplateFail>
      ) : null}

      {/* A8·E-11: a storage failure draws only the TemplateFail above — never "Nothing here." under it. */}
      {report.listingError ? null : shelves.map((shelf, i) =>
        // "Not sure" is hidden when empty; the other two always show, so an
        // empty shelf reads as "nothing here" rather than as a missing section.
        shelf.state === 'unrecognised' && shelf.docs.length === 0 ? null : (
          <Group
            key={shelf.state}
            first={i === 0}
            supplierNames={supplierNames}
            title={SHELVES[shelf.state].title}
            blurb={
              shelf.state === 'left_over' ? (
                <>
                  <span className="block">
                    What suppliers uploaded to prove who they are — registration papers and permits, and older government IDs and bank proofs.
                    Each file is checked against every supplier record: if nothing points at it any more,
                    it is left over and you can remove it. Deleting is permanent and there is no undo.
                  </span>
                  <span className="mt-2 block">{SHELVES[shelf.state].blurb}</span>
                </>
              ) : (
                SHELVES[shelf.state].blurb
              )
            }
            docs={shelf.docs}
            deletable={shelf.deletable}
          />
        ),
      )}

      {report.truncated ? (
        <p className={`pt-2 ${TEMPLATE_SUBLINE}`}>
          There are more files than this page listed. What you see is a partial list.
        </p>
      ) : null}
    </div>
  );
}

function Group({
  title,
  first,
  supplierNames,
  blurb,
  docs,
  deletable,
}: {
  title: string;
  first: boolean;
  /** Shop name per supplier id; null = the read was refused. */
  supplierNames: Map<string, string> | null;
  blurb: React.ReactNode;
  docs: VerificationDoc[];
  deletable: boolean;
}) {
  return (
    <TemplateSection label={title} tip={blurb} right={String(docs.length)} first={first} data={title}>
      {docs.length === 0 ? (
        <TemplateEmpty>Nothing here.</TemplateEmpty>
      ) : (
        <TemplateRows label={title}>
          {docs.map((d) => (
            <TemplateRow
              key={d.key}
              data={d.key}
              /* 📄 F-A-08 (admin walk 13 Nov 2026): titled by the paper's own name (`DOC_SLOTS`), never the raw storage
                 path; a file whose paper we cannot name keeps its path, the only thing that tells it apart. */
              title={paperName(d.slot) ? (
                <>{paperName(d.slot)}</>
              ) : (
                <span className="font-mono text-xs font-normal">{d.key}</span>
              )}
              line={
                <>
                  {d.vendorProfileId ? (
                    <span data-doc-supplier="">
                      {supplierNames === null
                        ? 'Supplier name couldn’t load'
                        : (supplierNames.get(d.vendorProfileId) ?? 'A supplier with no shop name')}
                      {' · '}
                    </span>
                  ) : null}
                  {formatDocSize(d.size)}
                  {d.lastModified ? ` · uploaded ${manilaDay(d.lastModified)}` : ''}
                </>
              }
              right={
                <>
                  <form action={viewVerificationDoc}>
                    <input type="hidden" name="key" value={d.key} />
                    <SubmitButton pendingLabel="Opening…" className={actionButtonClass('neutral')}>
                      Download
                    </SubmitButton>
                  </form>
                  {deletable ? (
                    <ConfirmForm
                      action={deleteVerificationDoc}
                      message={`Permanently delete this file?\n\n${d.key}\n\nThis is someone's identity document. It cannot be recovered.`}
                    >
                      <input type="hidden" name="key" value={d.key} />
                      <SubmitButton pendingLabel="Deleting…" className={actionButtonClass('danger', { quiet: true })}>
                        Delete
                      </SubmitButton>
                    </ConfirmForm>
                  ) : null}
                </>
              }
            />
          ))}
        </TemplateRows>
      )}
    </TemplateSection>
  );
}
