'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import {
  PabuyaCardList,
  PabuyaTrustNote,
  type PabuyaMethodCard,
} from '@/app/_components/pabuya/pabuya-card-list';
import {
  EGIFT_METHOD_KINDS,
  egiftKindMeta,
  type EgiftMethodKind,
} from '@/lib/egift-kinds';
import {
  deleteEgiftMethod,
  moveEgiftMethod,
  saveEgiftMethod,
  setEgiftMethodEnabled,
  type EgiftActionResult,
} from '../actions';

/** A saved method as handed down from the server page. */
export type ManagerMethod = {
  egift_method_id: string;
  method_kind: EgiftMethodKind;
  label: string;
  account_name: string | null;
  handle: string | null;
  qr_r2_key: string | null;
  note: string | null;
  is_enabled: boolean;
  qrDisplayUrl: string | null;
};

type DraftState = {
  kind: EgiftMethodKind;
  label: string;
  accountName: string;
  handle: string;
  note: string;
  /** r2://… ref (new upload or seeded existing), or '' for none. */
  qrRef: string;
};

const EMPTY_DRAFT: DraftState = {
  kind: 'gcash',
  label: egiftKindMeta('gcash').defaultLabel,
  accountName: '',
  handle: '',
  note: '',
  qrRef: '',
};

export function PabuyaManager({
  eventId,
  coupleName,
  slug,
  visibility,
  publicRouteEnabled,
  initialMethods,
  qrDisplayUrls,
}: {
  eventId: string;
  coupleName: string | null;
  slug: string | null;
  visibility: string | null;
  publicRouteEnabled: boolean;
  initialMethods: ManagerMethod[];
  qrDisplayUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state. `formOpen` shows the add/edit panel; `editingId` distinguishes
  // "edit this row" (non-null) from "add new" (null).
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  function openNew() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(m: ManagerMethod) {
    setEditingId(m.egift_method_id);
    setDraft({
      kind: m.method_kind,
      label: m.label,
      accountName: m.account_name ?? '',
      handle: m.handle ?? '',
      note: m.note ?? '',
      qrRef: m.qr_r2_key ?? '',
    });
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  // Run a server action from a plain FormData, then refresh so the server
  // page re-reads the fresh set. Surfaces the action's error on failure.
  function run(
    action: (fd: FormData) => Promise<EgiftActionResult>,
    fd: FormData,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await action(fd);
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function submitDraft() {
    const fd = new FormData();
    fd.set('event_id', eventId);
    if (editingId) fd.set('egift_method_id', editingId);
    fd.set('method_kind', draft.kind);
    fd.set('label', draft.label);
    fd.set('account_name', draft.accountName);
    fd.set('handle', draft.handle);
    fd.set('note', draft.note);
    fd.set('qr_r2_key', draft.qrRef);
    run(saveEgiftMethod, fd, closeForm);
  }

  function rowAction(
    action: (fd: FormData) => Promise<EgiftActionResult>,
    id: string,
    extra?: Record<string, string>,
  ) {
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('egift_method_id', id);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    run(action, fd);
  }

  // ---- Live preview: what guests will see ---------------------------------
  // Enabled saved methods, with the in-progress draft overlaid live: when
  // editing, the draft replaces its row; when adding, it's appended. So the
  // preview reflects the couple's typing before they even save.
  const previewCards: PabuyaMethodCard[] = useMemo(() => {
    const draftCard = (): PabuyaMethodCard => ({
      kind: draft.kind,
      label: draft.label || egiftKindMeta(draft.kind).defaultLabel,
      accountName: draft.accountName || null,
      handle: draft.handle || null,
      note: draft.note || null,
      qrUrl: draft.qrRef ? qrDisplayUrls[draft.qrRef] ?? null : null,
    });

    const base: PabuyaMethodCard[] = [];
    for (const m of initialMethods) {
      if (formOpen && editingId === m.egift_method_id) {
        base.push(draftCard()); // replace edited row with live draft
      } else if (m.is_enabled) {
        base.push({
          kind: m.method_kind,
          label: m.label,
          accountName: m.account_name,
          handle: m.handle,
          note: m.note,
          qrUrl: m.qrDisplayUrl,
        });
      }
    }
    if (formOpen && editingId === null) base.push(draftCard());
    return base;
  }, [initialMethods, formOpen, editingId, draft, qrDisplayUrls]);

  const publicHref = publicRouteEnabled && slug ? `/${slug}/pabuya` : null;
  const isPrivate = (visibility ?? 'private') === 'private';

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      {/* ── LEFT: manager ──────────────────────────────────────────────── */}
      <div className="space-y-5">
        <PabuyaTrustNote audience="couple" />

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800"
          >
            {error}
          </p>
        ) : null}

        {/* Saved methods list */}
        <section aria-label="Your e-gift methods" className="space-y-3">
          {initialMethods.length === 0 && !formOpen ? (
            <p className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-8 text-center text-sm text-ink/60">
              No e-gift methods yet. Add your first account so guests can send
              you a gift.
            </p>
          ) : null}

          {initialMethods.map((m, i) => {
            const meta = egiftKindMeta(m.method_kind);
            return (
              <article
                key={m.egift_method_id}
                className={`rounded-2xl border p-4 shadow-sm ${
                  m.is_enabled
                    ? 'border-ink/10 bg-white'
                    : 'border-ink/10 bg-cream/70 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg italic text-ink">
                      {m.label || meta.defaultLabel}
                      {!m.is_enabled ? (
                        <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                          Hidden
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                      {meta.defaultLabel}
                    </p>
                    {m.account_name ? (
                      <p className="mt-1 text-sm text-ink/70">{m.account_name}</p>
                    ) : null}
                    {m.handle ? (
                      <p className="mt-0.5 break-all font-mono text-[13px] text-mulberry">
                        {m.handle}
                      </p>
                    ) : null}
                    {m.qr_r2_key ? (
                      <p className="mt-1 text-xs text-ink/50">QR code attached</p>
                    ) : null}
                  </div>
                  {m.qrDisplayUrl ? (
                    <span className="inline-flex h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-cream">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.qrDisplayUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => openEdit(m)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-50"
                  >
                    <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      rowAction(setEgiftMethodEnabled, m.egift_method_id, {
                        is_enabled: (!m.is_enabled).toString(),
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-50"
                  >
                    {m.is_enabled ? (
                      <>
                        <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Show
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isPending || i === 0}
                    onClick={() =>
                      rowAction(moveEgiftMethod, m.egift_method_id, {
                        direction: 'up',
                      })
                    }
                    aria-label={`Move ${m.label} up`}
                    className="inline-flex items-center rounded-full border border-ink/15 bg-cream p-1.5 text-ink/75 transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending || i === initialMethods.length - 1}
                    onClick={() =>
                      rowAction(moveEgiftMethod, m.egift_method_id, {
                        direction: 'down',
                      })
                    }
                    aria-label={`Move ${m.label} down`}
                    className="inline-flex items-center rounded-full border border-ink/15 bg-cream p-1.5 text-ink/75 transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (
                        typeof window !== 'undefined' &&
                        !window.confirm(`Remove “${m.label}” from your e-gifts?`)
                      )
                        return;
                      rowAction(deleteEgiftMethod, m.egift_method_id);
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-danger-200 bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-800 transition-colors hover:border-danger-300 disabled:opacity-50"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {/* Add / edit form */}
        {formOpen ? (
          <section
            aria-label={editingId ? 'Edit e-gift method' : 'Add e-gift method'}
            className="rounded-2xl border border-terracotta/30 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl italic text-ink/85">
                {editingId ? 'Edit e-gift method' : 'Add an e-gift method'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-md p-1 text-ink/55 hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Kind picker */}
              <div>
                <label className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  Payment method
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EGIFT_METHOD_KINDS.map((k) => {
                    const meta = egiftKindMeta(k);
                    const selected = draft.kind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            kind: k,
                            // Keep a custom label the couple typed; otherwise
                            // track the kind's default label.
                            label:
                              d.label.length === 0 ||
                              d.label === egiftKindMeta(d.kind).defaultLabel
                                ? meta.defaultLabel
                                : d.label,
                          }))
                        }
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'border-mulberry bg-mulberry text-white'
                            : 'border-ink/15 bg-cream text-ink/75 hover:border-mulberry/50'
                        }`}
                      >
                        {meta.defaultLabel}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-ink/55">
                  {egiftKindMeta(draft.kind).blurb}
                </p>
              </div>

              {/* Label */}
              <Field label="Label (shown to guests)">
                <input
                  type="text"
                  value={draft.label}
                  maxLength={60}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, label: e.target.value }))
                  }
                  placeholder={egiftKindMeta(draft.kind).defaultLabel}
                  className="input-field h-11"
                />
              </Field>

              {/* Account name */}
              <Field label="Account name (optional)">
                <input
                  type="text"
                  value={draft.accountName}
                  maxLength={80}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, accountName: e.target.value }))
                  }
                  placeholder="The name on the account"
                  className="input-field h-11"
                />
              </Field>

              {/* Handle */}
              <Field label={`${egiftKindMeta(draft.kind).handleLabel} (optional)`}>
                <input
                  type="text"
                  value={draft.handle}
                  maxLength={200}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, handle: e.target.value }))
                  }
                  placeholder={egiftKindMeta(draft.kind).handlePlaceholder}
                  className="input-field h-11"
                />
              </Field>

              {/* QR upload */}
              <div>
                <FileUpload
                  bucket="media"
                  pathPrefix={`events/${eventId}/pabuya`}
                  label="QR code image (optional)"
                  help="Upload the QR from your GCash / Maya / bank app so guests can scan to send."
                  acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                  maxSizeMB={5}
                  variant="square"
                  currentValue={draft.qrRef || null}
                  initialDisplayUrls={qrDisplayUrls}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      qrRef: typeof v === 'string' ? v : '',
                    }))
                  }
                />
              </div>

              {/* Note */}
              <Field label="Note for guests (optional)">
                <input
                  type="text"
                  value={draft.note}
                  maxLength={240}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, note: e.target.value }))
                  }
                  placeholder="e.g. Please put our names in the message"
                  className="input-field h-11"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={isPending}
                  className="button-primary px-5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending
                    ? 'Saving…'
                    : editingId
                      ? 'Save changes'
                      : 'Add method'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isPending}
                  className="button-secondary px-5 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={openNew}
            disabled={isPending}
            className="button-primary inline-flex items-center gap-2 px-5 disabled:opacity-60"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Add an e-gift method
          </button>
        )}
      </div>

      {/* ── RIGHT: live preview ────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl border border-ink/10 bg-cream/70 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Guest preview
            </p>
            {publicHref ? (
              <a
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta hover:underline"
              >
                Open ↗
              </a>
            ) : null}
          </div>

          <div className="rounded-2xl bg-white/60 p-4">
            <div className="mb-4 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
                Pabuya
              </p>
              <p className="mt-1 font-display text-xl italic text-ink">
                {coupleName ? `A blessing for ${coupleName}` : 'A blessing for the couple'}
              </p>
            </div>
            <PabuyaCardList
              methods={previewCards}
              emptyHint="Add a method to see how guests will send you a gift."
            />
            <div className="mt-4">
              <PabuyaTrustNote audience="guest" />
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink/50">
            {isPrivate
              ? 'Your event page is private — launch it to make this live for guests.'
              : 'This is what guests see on your event page.'}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        {label}
      </label>
      {children}
    </div>
  );
}
