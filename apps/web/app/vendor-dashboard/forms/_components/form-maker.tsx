'use client';

import { useEffect, useId, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { formatCount } from '@/lib/format-number';
import { GripVertical, ListChecks, Plus, Send, Video } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SwitchTrack, SWITCH_BUTTON } from '@/app/_components/switch-track';
import { InfoTip } from '@/app/_components/info-tip';
import { TypedRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import { FileUpload } from '@/app/_components/file-upload';
import { dragBandOf, dragEdgeStep, dragScrollBy, dragScrollerOf } from '@/lib/drag-edge-scroll';
import {
  CHOICE_TYPES,
  FORM_ANSWER_TYPES,
  FORM_MEDIA_PER_ITEM_MAX,
  answerTypeLabel,
  validateFormDraft,
  type FormAnswerType,
  type FormDraft,
  type FormItemDraft,
} from '@/lib/vendor-forms';
import { formsAction, type FormsActionState } from '../actions';

/**
 * 📋 THE FORM MAKER (THE ONE BUILD · C3 Forms; v113 "New form"; v111 item 18 — owner verbatim: Title / Add Media files /
 * Add Video Link / Add a Question Line / Link to Service Card / Save to Library / Send to Chat).
 *
 * One house sheet. Title · the items (tap opens the item in place · swipe left removes, with Undo · ⠿ drag reorders by
 * POINTER, so a finger on an iPhone moves it — the ProposalMaker's HTML5 `draggable` does not) · "Add… ▾" (Question line
 * · Media files · Video link — ONE PickMenu) · "Link to service card" (ONE PickMenu, pick as many) · pinned
 * Save to library + Send to chat (Send only when opened from a client).
 *
 * FORM MEDIA BY PLAN (DECISION_LOG 2026-10-28): a locked kind is still listed and names the plan it needs — never a
 * dead button. The server checks the same caps (`formsAction` → `tierCaps`).
 *
 * 💾 A save never resets the screen: Save to library keeps the sheet open on the saved form (its id is kept, so the next
 * save updates it). Edits live in the sheet until saved — a removed item is only retired on save.
 */

export type FormMakerCard = { id: string; title: string };
export type FormMakerLocks = { media: string | null; video: string | null };

type Row = FormItemDraft & { key: string };

let seq = 0;
const nextKey = () => `i${++seq}`;

function asRows(items: FormItemDraft[]): Row[] {
  return items.map((it) => ({ ...it, key: it.id ?? nextKey() }));
}

export function FormMaker({
  open,
  onClose,
  initial,
  cards,
  locks,
  eventId,
  returnPath,
  onSaved,
  shopId,
  coupleName,
}: {
  open: boolean;
  onClose: () => void;
  /** The saved form being edited, or null for a new one. */
  initial: FormDraft | null;
  cards: readonly FormMakerCard[];
  /** The plan each locked kind needs ("Pro"), or null when this shop has it. */
  locks: FormMakerLocks;
  /** Opened from a client: Send to chat sends into this event. */
  eventId?: string | null;
  returnPath: string;
  onSaved?: (formId: string) => void;
  /** The shop's id — its media files go to its own folder (`vendors/<shop>/forms`, public media bucket). */
  shopId: string;
  /**
   * 📋 Piece 3a: the couple's name, when `initial.forEventId` is set (an Edit from a client's page) — the save reads
   * "Save for Ana & Miguel" and the sheet carries "Also keep in my library".
   */
  coupleName?: string;
}) {
  const titleId = useId();
  const [formId, setFormId] = useState<string | undefined>(initial?.formId);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [rows, setRows] = useState<Row[]>(() => asRows(initial?.items ?? []));
  const [serviceIds, setServiceIds] = useState<string[]>(initial?.serviceIds ?? []);
  const forEventId = initial?.forEventId;
  const [inLibrary, setInLibrary] = useState<boolean>(initial?.inLibrary ?? false);
  // Once the event's copy is saved with the switch ON, it is in the library for good (the database never lets it out).
  const [libraryLocked, setLibraryLocked] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [state, setState] = useState<FormsActionState>({ status: 'idle' });
  const [pending, start] = useTransition();

  // A different form opened → load it (the sheet is reused across forms).
  useEffect(() => {
    if (!open) return;
    setFormId(initial?.formId);
    setTitle(initial?.title ?? '');
    setRows(asRows(initial?.items ?? []));
    setServiceIds(initial?.serviceIds ?? []);
    setInLibrary(initial?.inLibrary ?? false);
    setLibraryLocked(false);
    setOpenKey(null);
    setState({ status: 'idle' });
  }, [open, initial]);

  const draft = (): FormDraft => ({
    formId,
    title,
    items: rows.map(({ key: _k, ...it }) => it as FormItemDraft),
    serviceIds: forEventId && !inLibrary ? [] : serviceIds,
    ...(forEventId ? { forEventId, editedFromFormId: initial?.editedFromFormId, inLibrary } : {}),
  });
  const problems = validateFormDraft(draft());

  const run = (op: 'save' | 'send') => {
    if (problems.length) {
      setState({ status: 'error', message: problems[0]!.message });
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set('op', 'save');
      fd.set('draft', JSON.stringify(draft()));
      fd.set('return_path', returnPath);
      const saved = await formsAction({ status: 'idle' }, fd);
      if (saved.status !== 'saved') {
        // A half-saved NEW form keeps its id, so the next Save updates it instead of making a second one.
        if (saved.status === 'error' && saved.formId) setFormId(saved.formId);
        setState(saved);
        return;
      }
      setFormId(saved.formId);
      if (forEventId && inLibrary) setLibraryLocked(true);
      onSaved?.(saved.formId);
      if (op === 'save' || !eventId) {
        setState(saved);
        return;
      }
      const sd = new FormData();
      sd.set('op', 'send');
      sd.set('form_id', saved.formId);
      sd.set('event_id', eventId);
      sd.set('return_path', returnPath);
      setState(await formsAction({ status: 'idle' }, sd));
    });
  };

  const add = (kind: string) => {
    const key = nextKey();
    const row: Row =
      kind === 'media'
        ? { key, kind: 'media', caption: '', mediaKeys: [] }
        : kind === 'video_link'
          ? { key, kind: 'video_link', caption: '', url: '' }
          : { key, kind: 'question', prompt: '', answerType: 'short_answer', required: false };
    setRows((r) => [...r, row]);
    setOpenKey(key);
  };
  const patch = (key: string, p: Partial<FormItemDraft>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? ({ ...r, ...p } as Row) : r)));

  const addOptions: PickOption[] = [
    { key: 'question', label: '＋ Question line' },
    locks.media
      ? { key: 'media', label: '＋ Media files', disabledNote: `Media files come with ${locks.media}.` }
      : { key: 'media', label: '＋ Media files' },
    locks.video
      ? { key: 'video_link', label: '＋ Video link', disabledNote: `Video links come with ${locks.video}.` }
      : { key: 'video_link', label: '＋ Video link' },
  ];

  const cardOptions: PickOption[] = cards.map((c) => ({ key: c.id, label: c.title }));
  const cardButton =
    serviceIds.length === 0
      ? 'None yet'
      : serviceIds.length === 1
        ? (cards.find((c) => c.id === serviceIds[0])?.title ?? '1 card')
        : `${serviceIds.length} cards`;

  // ⠿ POINTER REORDER — a finger or a mouse, one path.
  const listRef = useRef<HTMLUListElement>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const drag = useRef<{ key: string; pid: number; y: number; scroller: HTMLElement | null; raf: number } | null>(null);
  const onHandleDown = (e: ReactPointerEvent<HTMLButtonElement>, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const scroller = listRef.current ? dragScrollerOf(listRef.current) : null;
    drag.current = { key, pid: e.pointerId, y: e.clientY, scroller, raf: 0 };
    setDragKey(key);
    const tick = () => {
      const d = drag.current;
      if (!d) return;
      if (d.scroller) {
        const v = dragEdgeStep(d.y, dragBandOf(d.scroller));
        if (v) dragScrollBy(d.scroller, v);
      }
      d.raf = requestAnimationFrame(tick);
    };
    drag.current.raf = requestAnimationFrame(tick);
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    d.y = e.clientY;
    const list = listRef.current;
    if (!list) return;
    const els = [...list.querySelectorAll<HTMLElement>('[data-fm-row]')];
    let to = els.length - 1;
    for (let i = 0; i < els.length; i++) {
      const r = els[i]!.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        to = i;
        break;
      }
    }
    setRows((rs) => {
      const from = rs.findIndex((r) => r.key === d.key);
      if (from < 0 || from === to) return rs;
      const next = [...rs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  };
  const onHandleUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    cancelAnimationFrame(d.raf);
    drag.current = null;
    setDragKey(null);
  };
  const moveBy = (key: string, delta: number) =>
    setRows((rs) => {
      const from = rs.findIndex((r) => r.key === key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });

  const said =
    state.status === 'error'
      ? { tone: 'text-danger-700', words: state.message }
      : state.status === 'saved' || state.status === 'sent'
        ? { tone: 'text-success-700', words: state.message }
        : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledById={titleId}
      rise
      page
      foot={
        <div className="flex items-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3" data-form-maker-foot>
          <ActionButton
            tone="neutral"
            icon={ListChecks}
            label={forEventId ? `Save for ${coupleName?.trim() || 'this event'}` : 'Save to library'}
            onClick={() => run('save')}
            waiting={pending}
            className="flex-1"
            data-testid="form-maker-save"
          />
          {eventId ? (
            <ActionButton
              tone="brand"
              main
              icon={Send}
              label="Send to chat"
              onClick={() => run('send')}
              waiting={pending}
              className="flex-1"
              data-testid="form-maker-send"
            />
          ) : null}
        </div>
      }
    >
      <UndoToastHost />
      <div className="space-y-4 px-4 pb-4 pt-3" data-form-maker>
        <h2 id={titleId} className="pr-12 text-[19px] font-semibold text-ink">
          {forEventId && !formId ? 'Edit · saves as a new form' : formId ? 'Edit form' : 'New form'}
        </h2>
        {forEventId ? (
          <p className="text-[13px] text-ink/70" data-form-maker-for-event>
            Saved for {coupleName?.trim() || 'this event'} only. The original in your library, and anything already sent, stay as
            they were.
          </p>
        ) : null}
        <TypedRow name="Title" value={title} empty="Name this form" placeholder="Name this form" maxLength={120} onKeep={(t) => setTitle(t)} data="form-maker-title" />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">
            Items · {rows.length} · tap to open · swipe left to remove · ⠿ drag to reorder
          </p>
          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-ink/70">Nothing yet. Add a question, media files or a video link.</p>
          ) : (
            <ul ref={listRef} className="mt-2 space-y-2" data-form-maker-items>
              {rows.map((r, i) => (
                <SwipeToDelete
                  key={r.key}
                  as="li"
                  label={`Remove ${rowName(r)}`}
                  word="Remove"
                  surfaceClass="bg-paper"
                  onDelete={() => {
                    const before = rows;
                    deleteWithUndo({
                      label: `“${rowName(r)}” removed`,
                      hide: () => setRows(before.filter((x) => x.key !== r.key)),
                      restore: () => setRows(before),
                      commit: () => undefined, // nothing is written until Save — the form is the sheet's until then
                    });
                  }}
                >
                  <div
                    data-fm-row={r.key}
                    data-dragging={dragKey === r.key ? '' : undefined}
                    className={`rounded-xl bg-ink/[0.04] ${dragKey === r.key ? 'shadow-md ring-1 ring-sn-accent/40' : ''}`}
                  >
                    <div className="flex min-h-14 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${rowName(r)} — drag, or use the arrow keys`}
                        className="flex h-11 w-9 flex-none touch-none items-center justify-center text-ink/70"
                        onPointerDown={(e) => onHandleDown(e, r.key)}
                        onPointerMove={onHandleMove}
                        onPointerUp={onHandleUp}
                        onPointerCancel={onHandleUp}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            moveBy(r.key, -1);
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            moveBy(r.key, 1);
                          }
                        }}
                        data-fm-handle
                      >
                        <GripVertical className="h-4 w-4" aria-hidden />
                      </button>
                      <RevealHead open={openKey === r.key} onToggle={() => setOpenKey((k) => (k === r.key ? null : r.key))} index={i}>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-medium text-ink">{rowName(r) || 'Untitled'}</span>
                          <span className="block text-xs text-ink/70">{rowLine(r)}</span>
                        </span>
                        {r.kind === 'video_link' ? <Video className="h-4 w-4 flex-none text-ink/70" aria-hidden /> : null}
                      </RevealHead>
                    </div>
                    {openKey === r.key ? <ItemEditor row={r} shopId={shopId} onChange={(p) => patch(r.key, p)} /> : null}
                  </div>
                </SwipeToDelete>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
          <span className="inline-flex items-center gap-1.5 text-[15px] font-medium text-ink">
            <Plus className="h-4 w-4" aria-hidden /> Add
          </span>
          <PickMenu label="Add an item" value={null} buttonText="Add…" options={addOptions} onPick={add} dataAttr="data-form-maker-add" />
        </div>

        {forEventId ? (
          <div className="flex min-h-12 items-center justify-between gap-3 border-t border-ink/10 pt-3" data-form-maker-keep>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ink">Also keep in my library</p>
              <p className="text-xs text-ink/70">Reuse it with other clients</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={inLibrary}
              aria-label="Also keep in my library"
              disabled={libraryLocked}
              className={SWITCH_BUTTON}
              onClick={() => setInLibrary((v) => !v)}
              data-testid="form-maker-keep"
            >
              <SwitchTrack on={inLibrary} />
            </button>
          </div>
        ) : null}

        {forEventId && !inLibrary ? null : (
        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
          <div className="min-w-0">
            <InfoTip label="Link to service card" labelAs="p" labelClassName="text-[15px] font-medium text-ink" align="start">
              Sent to the couple automatically when they book this service — once their first payment is confirmed.
            </InfoTip>
            <p className="text-xs text-ink/70">Pick as many</p>
          </div>
          {cards.length === 0 ? (
            <p className="text-[13px] text-ink/70">No service cards yet</p>
          ) : (
            <PickMenu
              label="Link to service card"
              value={null}
              buttonText={cardButton}
              options={cardOptions}
              picked={serviceIds}
              doneButton
              onPick={(k) => setServiceIds((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
              dataAttr="data-form-maker-cards"
              menuMinWidth={220}
            />
          )}
        </div>
        )}

        {said ? (
          <p role="status" className={`text-sm ${said.tone}`} data-testid="form-maker-said">
            {said.words}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function rowName(r: FormItemDraft): string {
  if (r.kind === 'question') return r.prompt.trim();
  return r.caption.trim() || (r.kind === 'media' ? 'Media files' : 'Video link');
}

function rowLine(r: FormItemDraft): string {
  if (r.kind === 'question') return `Question line · ${answerTypeLabel(r.answerType)}${r.required ? ' · required' : ''}`;
  if (r.kind === 'media') return `Media files · ${formatCount(r.mediaKeys.length)} file${r.mediaKeys.length === 1 ? '' : 's'}`;
  return `Video link${r.url.trim() ? ' · preview' : ''}`;
}

/** The item, opened in place. */
function ItemEditor({ row, shopId, onChange }: { row: FormItemDraft; shopId: string; onChange: (p: Partial<FormItemDraft>) => void }) {
  if (row.kind === 'question') {
    const choice = CHOICE_TYPES.has(row.answerType);
    return (
      <div className="space-y-1 border-t border-ink/10 px-3 pb-3 pt-2" data-fm-editor="question">
        <TypedRow name="Question" value={row.prompt} empty="Write the question" placeholder="What do you want to ask?" maxLength={200} onKeep={(t) => onChange({ prompt: t })} />
        <TypedRow name="Hint" value={row.hint ?? ''} empty="Optional" placeholder="e.g. Names and how they are related" maxLength={200} onKeep={(t) => onChange({ hint: t })} />
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-[15px] text-ink">Type</span>
          <PickMenu
            label="Answer type"
            value={row.answerType}
            options={FORM_ANSWER_TYPES.map((t) => ({ key: t.key, label: t.label }))}
            onPick={(k) => onChange({ answerType: k as FormAnswerType })}
            dataAttr="data-fm-type"
          />
        </div>
        {choice ? (
          <TypedRow
            name="Choices"
            about={{ words: 'One choice per line.' }}
            value={(row.options ?? []).join('\n')}
            empty="Add the choices"
            placeholder={'First kiss\nEntrance\nFirst dance'}
            long
            boxed
            maxLength={3000}
            onKeep={(t) => onChange({ options: t.split('\n') })}
          />
        ) : null}
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-[15px] text-ink">Required</span>
          <button
            type="button"
            role="switch"
            aria-checked={row.required}
            aria-label="Required"
            className={SWITCH_BUTTON}
            onClick={() => onChange({ required: !row.required })}
          >
            <SwitchTrack on={row.required} />
          </button>
        </div>
      </div>
    );
  }
  if (row.kind === 'video_link') {
    return (
      <div className="space-y-1 border-t border-ink/10 px-3 pb-3 pt-2" data-fm-editor="video_link">
        <TypedRow name="What it shows" value={row.caption} empty="Add" placeholder="e.g. How we shoot the entrance" maxLength={200} onKeep={(t) => onChange({ caption: t })} />
        <TypedRow
          name="Link"
          about={{ words: 'YouTube and Vimeo play inside the form; Facebook opens outside.' }}
          value={row.url}
          empty="Paste a link"
          placeholder="https://"
          inputMode="url"
          autoCapitalize="off"
          maxLength={500}
          onKeep={(t) => onChange({ url: t })}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1 border-t border-ink/10 px-3 pb-3 pt-2" data-fm-editor="media">
      <TypedRow name="What they are" value={row.caption} empty="Add" placeholder="e.g. Our sample albums" maxLength={200} onKeep={(t) => onChange({ caption: t })} />
      {/* The shipped uploader (compress-first, size limits) into the shop's own folder. Kept while the form exists
          (THE ONE BUILD §4) — not the chat's 90-day expiry, because a library form is sent to many couples. */}
      <FileUpload
        bucket="media"
        pathPrefix={`vendors/${shopId}/forms`}
        multiple
        maxFiles={FORM_MEDIA_PER_ITEM_MAX}
        maxSizeMB={25}
        acceptedTypes={['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf']}
        compressImage
        compressVideo
        label="Files"
        help="Photos, short videos or a PDF — up to 10."
        currentValue={row.mediaKeys.length ? row.mediaKeys : null}
        onChange={(v) => onChange({ mediaKeys: Array.isArray(v) ? v : v ? [v] : [] })}
      />
    </div>
  );
}

/** A row's head that opens the item IN PLACE — and, like every fold, glides it into view (the shared reveal-on-open). */
function RevealHead({ open, onToggle, index, children }: { open: boolean; onToggle: () => void; index: number; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: ref.current, end: ref.current?.parentElement?.nextElementSibling ?? null }));
  return (
    <button
      ref={ref}
      type="button"
      className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-2 py-2 pr-3 text-left"
      aria-expanded={open}
      onClick={() => {
        intend();
        onToggle();
      }}
      data-fm-open={index}
    >
      {children}
    </button>
  );
}
