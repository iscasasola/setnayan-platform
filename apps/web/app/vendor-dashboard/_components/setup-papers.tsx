'use client';

import { useState, useTransition } from 'react';
import { Check, ChevronRight, Loader2 } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { FileUpload } from '@/app/_components/file-upload';
import { InfoTip } from '@/app/_components/info-tip';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatCount } from '@/lib/format-number';
import {
  PAPER_FILES,
  PAPER_MAX_MB,
  PAPER_STATE_WORD,
  PAPER_TYPES,
  papersIn,
  type PaperState,
  type SetupPaper,
} from '@/lib/setup-papers';
import { updateDocUploadInline } from '../shop/inline-docs-actions';
import { CouldNotLoad } from '../shop/_components/could-not-load';

/**
 * 🧾 STEP 5 · SEND YOUR DOCUMENTS — one row per required paper (owner 7 Nov 2026, prototype `open-shop-redesign.html`
 * v21 `paneDocs`; the rows are `lib/setup-papers.ts`, i.e. `REQUIRED_DOC_SLOT_KEYS`).
 *
 *   · Tap a row: it opens the SHIPPED upload for that paper — `FileUpload` into the private `vendor-verification`
 *     bucket under `vendors/<id>/verification/<slot>`, saved by the shipped `updateDocUploadInline` — the exact path
 *     Your details' papers use (`verify-pairs.tsx` `PaperSide`). No new bucket, no new table.
 *   · Each file saves the moment it is in. Saves run ONE AT A TIME (`queue`): the first save of a fresh shop makes its
 *     draft application, and two first saves at once would each make one (the race `loadInlineDocs` documents).
 *   · Each row says where its paper stands — Not sent yet · Uploaded · Under review · Approved · Needs a new copy — read
 *     off the latest application. A refused read is said as such (`CouldNotLoad`), never as four empty rows.
 */
let queue: Promise<unknown> = Promise.resolve();

const TONE: Readonly<Record<PaperState, BadgeTone>> = {
  none: 'quiet',
  uploaded: 'quiet',
  review: 'wait',
  approved: 'ok',
  new_copy: 'no',
};

function lineOf(p: SetupPaper, of: number): string {
  switch (p.state) {
    case 'none':
      return `Required · ${formatCount(p.n)} of ${formatCount(of)} · ${PAPER_FILES}`;
    case 'uploaded':
      return 'Saved · not sent for review yet';
    case 'review':
      return 'Sent · Setnayan checks it';
    case 'approved':
      return 'Setnayan approved it';
    case 'new_copy':
      return `Sent back · add a new copy · ${PAPER_FILES}`;
  }
}

export function SetupPapers({
  papers,
  vendorProfileId,
  reason,
}: {
  /** NULL: the application read was refused. */
  papers: readonly SetupPaper[] | null;
  vendorProfileId: string;
  /** Setnayan's reason, when the papers came back. */
  reason: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (papers === null) return <CouldNotLoad what="your papers" />;
  const of = papers.length;
  const sentBack = papers.some((p) => p.state === 'new_copy');
  return (
    <div className="space-y-2" data-setup-papers={formatCount(papersIn(papers))}>
      <p className="text-[13.5px] leading-snug text-ink/70">
        Setnayan checks them before you go live ·{' '}
        <InfoTip label={`${formatCount(papersIn(papers))} of ${formatCount(of)} in`} labelClassName="font-semibold text-ink" ariaLabel="About the documents" align="start">
          <b>The four required papers</b> — DTI or SEC · BIR 2303 · Mayor’s Permit · bank account proof. The name on the
          bank proof should match your DTI/SEC business name (or your own, if sole proprietor). {PAPER_FILES}. Each one
          saves the moment it’s in. <b>Optional, after these</b> — portfolio samples, past client references and your
          social links, on Your details.
        </InfoTip>
      </p>
      {sentBack && reason ? (
        <p role="alert" className="text-[13.5px] leading-snug text-danger-700" data-setup-papers-reason="">
          Setnayan sent them back: {reason}
        </p>
      ) : null}
      <ul className="divide-y divide-ink/10" data-setup-paper-rows="">
        {papers.map((p) => (
          <PaperRow
            key={p.key}
            paper={p}
            of={of}
            open={open === p.key}
            onToggle={() => setOpen((o) => (o === p.key ? null : p.key))}
            onSaved={() => setOpen(null)}
            vendorProfileId={vendorProfileId}
          />
        ))}
      </ul>
    </div>
  );
}

function PaperRow({
  paper: p,
  of,
  open,
  onToggle,
  onSaved,
  vendorProfileId,
}: {
  paper: SetupPaper;
  of: number;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
  vendorProfileId: string;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const done = p.state === 'uploaded' || p.state === 'review' || p.state === 'approved';

  const save = (ref: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set('slot_key', p.key);
      fd.set('r2_ref', ref);
      const run = queue.then(() => updateDocUploadInline(null, fd));
      queue = run.catch(() => undefined);
      try {
        const res = await run;
        if (res.ok) {
          toast.success(`${p.label} saved.`);
          onSaved();
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error('That did not save — check your connection and try again.');
      }
    });
  };

  const chip = (
    <span
      aria-hidden
      className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[14px] font-semibold ${done ? 'text-[rgb(var(--color-ok))]' : 'text-ink/70'}`}
      style={{
        background: done
          ? 'color-mix(in srgb, rgb(var(--color-ok)) 14%, transparent)'
          : 'color-mix(in srgb, rgb(var(--color-gild)) 16%, transparent)',
      }}
    >
      {done ? <Check className="h-[18px] w-[18px]" strokeWidth={2.2} /> : formatCount(p.n)}
    </span>
  );
  const words = (
    <span className="min-w-0 flex-1">
      <b className="block text-[15px] font-semibold leading-snug text-ink">{p.label}</b>
      <span className="block text-[13px] leading-snug text-ink/60" data-setup-paper-line="">
        {pending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
            Saving…
          </span>
        ) : (
          lineOf(p, of)
        )}
      </span>
    </span>
  );
  const badge = (
    <Badge tone={TONE[p.state]} data={`setup-paper-${p.key}`}>
      {PAPER_STATE_WORD[p.state]}
    </Badge>
  );

  return (
    <li data-setup-paper={p.key} data-paper-state={p.state} className="py-1">
      {p.editable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="sn-press flex min-h-[56px] w-full items-center gap-3 text-left"
          data-setup-paper-open=""
        >
          {chip}
          {words}
          {badge}
          <ChevronRight aria-hidden className={`h-4 w-4 flex-none text-ink/40 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} />
        </button>
      ) : (
        <div className="flex min-h-[56px] items-center gap-3">
          {chip}
          {words}
          {badge}
        </div>
      )}
      {open && p.editable ? (
        <div className="pb-3 pl-12" data-setup-paper-upload={p.key}>
          <FileUpload
            bucket="vendor-verification"
            pathPrefix={`vendors/${vendorProfileId}/verification/${p.key}`}
            name="r2_ref"
            unsavedHint={null}
            currentValue={p.ref}
            maxSizeMB={PAPER_MAX_MB}
            acceptedTypes={[...PAPER_TYPES]}
            variant="wide"
            disabled={pending}
            onChange={(val) => {
              const ref = Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
              save(ref);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}
