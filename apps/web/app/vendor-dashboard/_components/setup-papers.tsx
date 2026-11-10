'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, ChevronRight, FileText, ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FileUpload, filenameFromRef } from '@/app/_components/file-upload';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { InfoTip } from '@/app/_components/info-tip';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { formatCount } from '@/lib/format-number';
import { PAPER_FILES, PAPER_MAX_MB, PAPER_STATE_WORD, PAPER_TYPES, papersIn, type SetupPaper } from '@/lib/setup-papers';
import { loadInlineDocs, updateDocUploadInline } from '../shop/inline-docs-actions';
import { CouldNotLoad } from '../shop/_components/could-not-load';

/**
 * 🧾 STEP 5 · SEND YOUR DOCUMENTS — one row per required paper (owner 7 Nov 2026, prototype `open-shop-redesign.html`
 * v21 `paneDocs` / `docRow`; the rows are `lib/setup-papers.ts`, i.e. `REQUIRED_DOC_SLOT_KEYS`).
 *
 *   · A ROW WITH NO FILE IS ONE TAP: number tile · name · "Required · n of 4 · PDF / JPG / PNG up to 15 MB" · an
 *     **Add** pill that opens the file picker straight away. No row to open first.
 *   · A ROW WITH A FILE: a small thumbnail · name · "✓ Saved · <file name>". Tapping it opens the preview, with
 *     **Replace** and **Remove** under it — the prototype's DTI row.
 *   · Papers Setnayan holds (Under review · Approved) say so as the row's line; nothing to press.
 *   · A SAVED PAPER SWIPES LEFT TO REMOVE, WITH UNDO (house T14, owner 2026-11-03 "SWIPE LEFT TO DELETE ON EVERY LIST
 *     ROW"; v21 `docRow` `data-swipe="doc:…"`, Build 5 item T). The swipe and the Remove inside the preview are ONE
 *     remove: the row goes back to "Add" at once, the Undo toast stands for its window, and only then is the empty
 *     ref written (`deleteWithUndo`). A new file picked inside the window writes the remove FIRST (`flush`), so the
 *     late remove can never wipe the new copy. The one `UndoToastHost` is mounted here, once per Today.
 *
 * The upload is the SHIPPED one — `FileUpload` into the private `vendor-verification` bucket under
 * `vendors/<id>/verification/<slot>`, saved by the shipped `updateDocUploadInline` (the path `verify-pairs.tsx`
 * `PaperSide` uses). It is drawn only as the pill, the way the Studio's poster photo drives it
 * (`studio-prints-six.tsx` `pick`): its own picker, its own checks, its own watchdog.
 *
 * Each file saves the moment it is in. Saves run ONE AT A TIME (`queue`): the first save of a fresh shop makes its
 * draft application, and two first saves at once would each make one (the race `loadInlineDocs` documents).
 * A refused read is said as such (`CouldNotLoad`), never as four empty rows.
 */
let queue: Promise<unknown> = Promise.resolve();

type Local = { url: string; image: boolean; name: string };

const isImageName = (name: string) => /\.(png|jpe?g|webp)$/i.test(name);

export function SetupPapers({
  papers,
  vendorProfileId,
  reason,
  displayUrls,
}: {
  /** NULL: the application read was refused. */
  papers: readonly SetupPaper[] | null;
  vendorProfileId: string;
  /** Setnayan's reason, when the papers came back. */
  reason: string | null;
  /** ref → display URL. Given by the lab; on Today the private papers are signed on demand (`loadInlineDocs`). */
  displayUrls?: Record<string, string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>(displayUrls ?? {});
  const wantsSigning = displayUrls === undefined && (papers ?? []).some((p) => p.ref);
  useEffect(() => {
    if (!wantsSigning) return;
    let live = true;
    // The shipped signer for this shop's own private folder — a thumbnail that cannot be signed draws the file icon.
    loadInlineDocs()
      .then((d) => live && setSigned(d.seedDisplayUrls ?? {}))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [wantsSigning]);

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
          saves the moment it’s in; you send them to Setnayan from <b>Get verified</b>, below. <b>Optional, after
          these</b> — portfolio samples, past client references and your social links, on Your details.
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
            displayUrl={p.ref ? (signed[p.ref] ?? null) : null}
            vendorProfileId={vendorProfileId}
          />
        ))}
      </ul>
      <UndoToastHost />
    </div>
  );
}

function PaperRow({
  paper: p,
  of,
  open,
  onToggle,
  displayUrl,
  vendorProfileId,
}: {
  paper: SetupPaper;
  of: number;
  open: boolean;
  onToggle: () => void;
  displayUrl: string | null;
  vendorProfileId: string;
}) {
  const toast = useToast();
  const root = useRef<HTMLLIElement>(null);
  // The opened paper glides into view like every other fold (owner 2026-11-04, app-wide reveal-on-open).
  const intend = useRevealOnOpen(open, () => ({ head: root.current }));
  const [pending, start] = useTransition();
  const [pct, setPct] = useState<number | null>(null);
  const [local, setLocal] = useState<Local | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const picked = useRef(false);
  const landed = useRef(false);
  // 👈 A remove waiting out its Undo window: the row reads as empty until then (`deleteWithUndo` writes it after).
  const [removed, setRemoved] = useState(false);
  const pendingRemove = useRef<{ flush: () => Promise<void> } | null>(null);

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
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error('That did not save — check your connection and try again.');
      }
    });
  };
  const remove = () => {
    if (open) onToggle();
    const fd = new FormData();
    fd.set('slot_key', p.key);
    fd.set('r2_ref', '');
    const handle = deleteWithUndo({
      label: `${p.label} removed`,
      hide: () => setRemoved(true),
      restore: () => setRemoved(false),
      commit: async () => {
        if (pendingRemove.current === handle) pendingRemove.current = null;
        const run = queue.then(() => updateDocUploadInline(null, fd));
        queue = run.catch(() => undefined);
        const res = await run;
        if (res.ok) setLocal(null);
        return res;
      },
      failed: `Couldn’t remove your ${p.label}. It’s back — try again.`,
    });
    pendingRemove.current = handle;
  };
  const pick = () => {
    setProblem(null);
    root.current?.querySelector<HTMLInputElement>('[data-setup-paper-upload] input[type="file"]')?.click();
  };

  // What the row shows as its file: the one just picked (a local address) or the one on record.
  const name = local?.name ?? (p.ref ? filenameFromRef(p.ref) : null);
  const thumb = local ? (local.image ? local.url : null) : displayUrl && name && isImageName(name) ? displayUrl : null;
  const hasFile = p.editable && !removed && (p.ref != null || local != null);
  const held = p.state === 'review' || p.state === 'approved';
  const busy = pct !== null || pending;

  const line = busy ? (
    <span className="inline-flex items-center gap-1.5">
      <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2} />
      {pct !== null ? `Uploading · ${formatCount(pct)}%` : 'Saving…'}
    </span>
  ) : problem ? (
    <span className="text-danger-700">{problem}</span>
  ) : hasFile ? (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <Check aria-hidden className="h-3.5 w-3.5 flex-none text-[rgb(var(--color-ok))]" strokeWidth={2.4} />
      <span className="truncate">Saved · {name}</span>
    </span>
  ) : held ? (
    <span className="inline-flex items-center gap-1">
      <Check aria-hidden className="h-3.5 w-3.5 flex-none text-[rgb(var(--color-ok))]" strokeWidth={2.4} />
      {p.state === 'review' ? `${PAPER_STATE_WORD.review} · Setnayan checks it` : PAPER_STATE_WORD.approved}
    </span>
  ) : p.state === 'new_copy' ? (
    <span className="text-danger-700">{`${PAPER_STATE_WORD.new_copy} · ${PAPER_FILES}`}</span>
  ) : (
    `Required · ${formatCount(p.n)} of ${formatCount(of)} · ${PAPER_FILES}`
  );

  const tile = (
    <span
      aria-hidden
      className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-lg bg-ink/[0.06] text-ink/55"
      data-setup-paper-thumb={hasFile ? (thumb ? 'image' : 'file') : held ? 'held' : 'number'}
    >
      {hasFile ? (
        thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- the paper just picked (a local address) or its signed preview
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5" strokeWidth={1.8} />
        )
      ) : held ? (
        <Check className="h-[18px] w-[18px] text-[rgb(var(--color-ok))]" strokeWidth={2.2} />
      ) : (
        <span className="font-mono text-[13px]">{formatCount(p.n)}</span>
      )}
    </span>
  );
  const words = (
    <span className="min-w-0 flex-1">
      <b className="block text-[15px] font-semibold leading-snug text-ink">{p.label}</b>
      <span className="block text-[13px] leading-snug text-ink/60" data-setup-paper-line="">
        {line}
      </span>
    </span>
  );

  return (
    <li ref={root} data-setup-paper={p.key} data-paper-state={p.state} className="py-1">
      {hasFile ? (
        <SwipeToDelete label={`Remove ${p.label}`} word="Remove" onDelete={remove} disabled={busy} radiusClass="rounded-lg" surfaceClass="bg-cream">
          <button
            type="button"
            onClick={() => {
              intend();
              onToggle();
            }}
            aria-expanded={open}
            className="sn-press flex min-h-[56px] w-full items-center gap-3 text-left"
            data-setup-paper-open=""
          >
            {tile}
            {words}
            {open ? null : <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/40" />}
          </button>
        </SwipeToDelete>
      ) : (
        <div className="flex min-h-[56px] items-center gap-3">
          {tile}
          {words}
          {p.editable ? (
            <ActionButton
              tone="neutral"
              icon={<ImagePlus aria-hidden strokeWidth={1.9} />}
              label="Add"
              onClick={pick}
              disabled={busy}
              data-testid="setup-paper-add"
            />
          ) : null}
        </div>
      )}
      {hasFile && open ? (
        <div className="grid gap-2.5 pb-3" data-setup-paper-preview="">
          <div className="flex max-h-[220px] items-center justify-center gap-2 overflow-hidden rounded-xl bg-ink/[0.04] p-2.5 text-[13px] text-ink/70">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- the paper just picked (a local address) or its signed preview
              <img src={thumb} alt={`${p.label} — the copy on file`} className="block max-h-[200px] max-w-full object-contain" />
            ) : (
              <>
                <FileText aria-hidden className="h-5 w-5 flex-none" strokeWidth={1.8} />
                <span className="min-w-0 truncate">{name}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="neutral" icon={<RefreshCw aria-hidden strokeWidth={1.9} />} label="Replace" onClick={pick} disabled={busy} data-testid="setup-paper-replace" />
            <ActionButton tone="danger" icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Remove" onClick={remove} disabled={busy} data-testid="setup-paper-remove" />
          </div>
        </div>
      ) : null}
      {p.editable ? (
        // The ONE shipped upload — its own picker, its own checks; drawn here only as the Add / Replace pill.
        <div
          className="sr-only"
          aria-hidden
          data-setup-paper-upload={p.key}
          // The upload refuses a wrong type or an oversized file in its own (hidden) words, before anything is sent —
          // so the row checks the same two limits first and says why on the row.
          onChangeCapture={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            if (!(PAPER_TYPES as readonly string[]).includes(f.type)) setProblem('That isn’t a PDF, JPG or PNG — try another file.');
            else if (f.size > PAPER_MAX_MB * 1024 * 1024) setProblem(`That file is over ${formatCount(PAPER_MAX_MB)} MB — try a smaller copy.`);
            else setProblem(null);
          }}
        >
          <FileUpload
            bucket="vendor-verification"
            pathPrefix={`vendors/${vendorProfileId}/verification/${p.key}`}
            multiple={false}
            maxSizeMB={PAPER_MAX_MB}
            acceptedTypes={[...PAPER_TYPES]}
            variant="wide"
            disabled={busy}
            onFilePicked={(f) => {
              // A remove still in its Undo window is written NOW, ahead of this file's save in the queue.
              void pendingRemove.current?.flush();
              pendingRemove.current = null;
              setRemoved(false);
              picked.current = true;
              landed.current = false;
              setLocal({ url: URL.createObjectURL(f), image: f.type.startsWith('image/'), name: f.name });
            }}
            onProgress={setPct}
            onBusy={(b) => {
              // A file that stopped without landing says so — never a row that quietly goes back to "Add".
              if (b || !picked.current) return;
              picked.current = false;
              if (landed.current) return;
              setLocal(null);
              setProblem((s) => s ?? 'That did not upload — try again.');
            }}
            onChange={(v) => {
              const ref = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
              if (!ref) return;
              landed.current = true;
              setProblem(null);
              save(ref);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}
