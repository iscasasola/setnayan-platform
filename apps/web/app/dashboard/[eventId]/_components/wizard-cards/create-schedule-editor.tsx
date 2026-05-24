'use client';

/**
 * Card 15 Create Schedule · client editor.
 *
 * 2026-05-24 owner directive: render the two-level schedule hierarchy
 * with drag-to-reorder, add-block, delete-block, inline time edits, +
 * the final "Lock the rough schedule" mark-done CTA. Companion to the
 * async server shell at create-schedule-card.tsx · the shell does the
 * fetch + seed + group and hands this component the rendered payload.
 *
 * UX shape:
 *   ┌───────────────────────────────────────────────────────┐
 *   │ Sketch out the spine of your wedding day …            │
 *   ├───────────────────────────────────────────────────────┤
 *   │ ⋮  Ceremony            [14:00] → [15:30]  🗑          │
 *   │    ⋮  Procession       [14:00] → [14:08]  🗑          │
 *   │    ⋮  Opening prayer   [14:08] → [14:15]  🗑          │
 *   │    ⋮  Vows + rings     [14:15] → [14:23]  🗑          │
 *   │    [+ Add part]                                       │
 *   ├───────────────────────────────────────────────────────┤
 *   │ ⋮  Cocktail Hour       [16:00] → [17:00]  🗑          │
 *   ├───────────────────────────────────────────────────────┤
 *   │ ⋮  Reception           [17:00] → [22:00]  🗑          │
 *   │    ⋮  Grand entrance   [17:00] → [17:21]  🗑          │
 *   │    [+ Add part]                                       │
 *   ├───────────────────────────────────────────────────────┤
 *   │ ⋮  After Party         [22:00] → [23:59]  🗑          │
 *   ├───────────────────────────────────────────────────────┤
 *   │ [+ Add block]                                          │
 *   ├───────────────────────────────────────────────────────┤
 *   │ [ Lock the rough schedule ]                            │
 *   └───────────────────────────────────────────────────────┘
 *
 * Drag · HTML5 drag-drop API (no third-party lib). Drag a row by its
 * left-edge grip icon · drop on another row at the SAME level (top-level
 * onto top-level, sub-block onto sibling sub-block under the same
 * parent). Cross-level drag (sub-block → top-level OR top-level →
 * inside a parent) is intentionally blocked in V1 · deferred to V1.x
 * once we see whether hosts actually want it.
 *
 * Inline edit · debounced. Each time / label input writes to a local
 * state buffer; after 600ms idle the change fires updateScheduleBlock.
 * The OPTIMISTIC value is reflected immediately in the UI so the host
 * sees the edit land even before the server round-trip completes.
 *
 * Add · [+ Add part] (under each parent) and [+ Add block] (top-level)
 * trigger an inline form drawer with label + start + end inputs. Submit
 * fires createScheduleBlock and re-renders via revalidatePath. No modal
 * · drawer slides open inline below the [+ Add] CTA.
 *
 * Delete · trash icon per row. Confirms via window.confirm so the host
 * doesn't accidentally nuke their Ceremony. Cascade FK on parent_block_id
 * means deleting a parent removes all its children automatically.
 *
 * NO LINKS per [[feedback_setnayan_concierge_wizard_ux]] · search + lock
 * + add + delete all stay inline. Brand voice per
 * [[feedback_setnayan_no_dev_text_post_launch]].
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { ScheduleBlockRow } from '@/lib/schedule';
import { markTaskDone } from '../../wizard-actions';
import {
  updateScheduleBlock,
  deleteScheduleBlock,
  createScheduleBlock,
  reorderScheduleBlocks,
} from '../../schedule/actions';

type Props = {
  eventId: string;
  topLevel: ReadonlyArray<ScheduleBlockRow>;
  childrenByParent: Record<string, ScheduleBlockRow[]>;
};

/** Format an ISO timestamp as HH:MM for the local time input. */
function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Combine an existing block's date (from its current start_at ISO) with
 *  a new HH:MM time input · returns the merged ISO. Used when the host
 *  edits a time input · we preserve the date from the existing row and
 *  swap the hours/minutes. */
function mergeTimeInputWithIso(originalIso: string, timeInput: string): string {
  const d = new Date(originalIso);
  const [hStr, mStr] = timeInput.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return originalIso;
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Format an ISO timestamp as YYYY-MM-DDTHH:MM for the datetime-local
 *  input (used by the Add block form which needs a date+time combined
 *  picker, not just a time). */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function ScheduleEditor({ eventId, topLevel, childrenByParent }: Props) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocking, startLockTransition] = useTransition();

  /* ───────────  drag-to-reorder state  ─────────── */

  // Track which block_id is being dragged. Drop-target sibling computes
  // its position in the visual list and triggers the reorder.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Parent-key of the dragged block (NULL = top-level, UUID = child of
  // that parent). Used to constrain drops to same-level siblings.
  const [draggedParentKey, setDraggedParentKey] = useState<string | null>(null);

  function handleDragStart(blockId: string, parentKey: string | null) {
    setDraggedId(blockId);
    setDraggedParentKey(parentKey);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(targetBlockId: string, targetParentKey: string | null) {
    if (!draggedId || draggedId === targetBlockId) {
      setDraggedId(null);
      setDraggedParentKey(null);
      return;
    }
    // Constrain drops to same-level siblings · cross-level moves
    // deferred per V1 simplification.
    if (draggedParentKey !== targetParentKey) {
      setDraggedId(null);
      setDraggedParentKey(null);
      return;
    }

    // Compute the new ordered list of block_ids at this level.
    const siblings: ScheduleBlockRow[] =
      targetParentKey === null
        ? [...topLevel]
        : [...(childrenByParent[targetParentKey] ?? [])];

    const draggedIdx = siblings.findIndex((b) => b.block_id === draggedId);
    const targetIdx = siblings.findIndex((b) => b.block_id === targetBlockId);
    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedId(null);
      setDraggedParentKey(null);
      return;
    }

    // Remove dragged, splice at target index.
    const reordered = [...siblings];
    const [moved] = reordered.splice(draggedIdx, 1);
    if (moved) reordered.splice(targetIdx, 0, moved);

    setDraggedId(null);
    setDraggedParentKey(null);

    try {
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set(
        'ordered_block_ids',
        reordered.map((b) => b.block_id).join(','),
      );
      await reorderScheduleBlocks(formData);
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Couldn't save the new order. Try again.",
      );
    }
  }

  /* ───────────  mark-done handler  ─────────── */

  function handleLockSchedule() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'create_schedule');
    // Lightweight summary lives on wizard_state.create_schedule.meta so
    // the home Today's Focus card can show a one-line preview ("Ceremony
    // 14:00 · Reception 17:00 · …") without rejoining event_schedule_blocks.
    formData.set(
      'meta_rough_schedule',
      topLevel
        .map((b) => `${b.label}: ${isoToTimeInput(b.start_at)}`)
        .join(' · '),
    );
    startLockTransition(async () => {
      try {
        await markTaskDone(formData);
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Couldn't lock the schedule. Try again.",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink/75">
        Sketch out the spine of your wedding day. Drag to rearrange · tap
        the trash icon to remove a block · add a new block or part below.
        You can refine times later — your vendors will see this and align
        their day-of arrivals.
      </p>

      <div className="space-y-3">
        {topLevel.map((parent) => (
          <ParentBlockRow
            key={parent.block_id}
            eventId={eventId}
            block={parent}
            children_={childrenByParent[parent.block_id] ?? []}
            draggedId={draggedId}
            draggedParentKey={draggedParentKey}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onError={(msg) => setErrorMessage(msg)}
          />
        ))}

        <AddTopLevelBlockForm
          eventId={eventId}
          onError={(msg) => setErrorMessage(msg)}
          fallbackStartIso={
            topLevel.length > 0
              ? topLevel[topLevel.length - 1]!.end_at ??
                topLevel[topLevel.length - 1]!.start_at
              : new Date().toISOString()
          }
        />
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleLockSchedule}
        disabled={isLocking || topLevel.length === 0}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
        {isLocking ? 'Saving…' : 'Lock the rough schedule'}
      </button>

      <p className="text-xs text-ink/55">
        Edits here sync with your Schedule page · single source of truth
        across the dashboard, your vendors&rsquo; workspace, and your
        guests&rsquo; day-of view.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Parent block row (top-level) · renders the block itself + its nested
 * children + a [+ Add part] CTA under the children.
 * ──────────────────────────────────────────────────────────────────── */

function ParentBlockRow({
  eventId,
  block,
  children_,
  draggedId,
  draggedParentKey,
  onDragStart,
  onDragOver,
  onDrop,
  onError,
}: {
  eventId: string;
  block: ScheduleBlockRow;
  children_: ScheduleBlockRow[];
  draggedId: string | null;
  draggedParentKey: string | null;
  onDragStart: (blockId: string, parentKey: string | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetBlockId: string, targetParentKey: string | null) => void;
  onError: (msg: string) => void;
}) {
  // Only Ceremony + Reception support nested parts in V1. Cocktail Hour
  // and After Party are standalone (no [+ Add part] CTA). The seed
  // creates parts under Ceremony + Reception only · existing parts may
  // exist under other blocks if the host hand-added them via /schedule,
  // and we still render those · just don't suggest adding new ones below
  // standalone blocks. Detection: presence of existing children OR the
  // block's label/type matches the canonical Ceremony/Reception slot.
  const supportsParts =
    children_.length > 0 ||
    block.label.toLowerCase() === 'ceremony' ||
    block.label.toLowerCase() === 'reception';

  return (
    <div className="rounded-xl border border-ink/15 bg-cream/30 p-2.5 sm:p-3">
      <BlockRow
        eventId={eventId}
        block={block}
        parentKey={null}
        draggedId={draggedId}
        draggedParentKey={draggedParentKey}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onError={onError}
        emphasize
      />

      {children_.length > 0 ? (
        <div className="mt-2 space-y-1.5 border-l-2 border-terracotta/20 pl-3">
          {children_.map((child) => (
            <BlockRow
              key={child.block_id}
              eventId={eventId}
              block={child}
              parentKey={block.block_id}
              draggedId={draggedId}
              draggedParentKey={draggedParentKey}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onError={onError}
            />
          ))}
        </div>
      ) : null}

      {supportsParts ? (
        <div className="mt-2 border-l-2 border-terracotta/20 pl-3">
          <AddPartForm
            eventId={eventId}
            parentBlockId={block.block_id}
            blockType={block.block_type}
            fallbackStartIso={
              children_.length > 0
                ? children_[children_.length - 1]!.end_at ??
                  children_[children_.length - 1]!.start_at
                : block.start_at
            }
            fallbackEndIso={
              children_.length > 0
                ? new Date(
                    new Date(
                      children_[children_.length - 1]!.end_at ??
                        children_[children_.length - 1]!.start_at,
                    ).getTime() +
                      10 * 60 * 1000,
                  ).toISOString()
                : block.end_at ??
                  new Date(
                    new Date(block.start_at).getTime() + 10 * 60 * 1000,
                  ).toISOString()
            }
            onError={onError}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Single block row · drag handle + label input + time inputs + trash.
 * Used for both top-level blocks and nested children.
 * ──────────────────────────────────────────────────────────────────── */

function BlockRow({
  eventId,
  block,
  parentKey,
  draggedId,
  draggedParentKey,
  onDragStart,
  onDragOver,
  onDrop,
  onError,
  emphasize = false,
}: {
  eventId: string;
  block: ScheduleBlockRow;
  parentKey: string | null;
  draggedId: string | null;
  draggedParentKey: string | null;
  onDragStart: (blockId: string, parentKey: string | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetBlockId: string, targetParentKey: string | null) => void;
  onError: (msg: string) => void;
  emphasize?: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(block.label);
  const [startInput, setStartInput] = useState(isoToTimeInput(block.start_at));
  const [endInput, setEndInput] = useState(
    block.end_at ? isoToTimeInput(block.end_at) : '',
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startUpdateTransition] = useTransition();

  // Sync local edit buffers when the parent row updates (e.g., after a
  // reorder or seed). Without this, server-pushed updates wouldn't appear
  // in the inline inputs after an external mutation.
  useEffect(() => {
    setLabel(block.label);
    setStartInput(isoToTimeInput(block.start_at));
    setEndInput(block.end_at ? isoToTimeInput(block.end_at) : '');
  }, [block.label, block.start_at, block.end_at]);

  /** Schedule a debounced save · 600ms idle window before firing. Cancels
   *  any pending save when called again before the timer expires. */
  function scheduleSave(patch: {
    label?: string;
    startInput?: string;
    endInput?: string;
  }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set('block_id', block.block_id);
      if (patch.label !== undefined) {
        formData.set('label', patch.label);
      }
      if (patch.startInput !== undefined && patch.startInput.length > 0) {
        formData.set(
          'start_at',
          mergeTimeInputWithIso(block.start_at, patch.startInput).slice(0, 16),
        );
      }
      if (patch.endInput !== undefined) {
        if (patch.endInput.length === 0) {
          formData.set('end_at', '');
        } else {
          const baseIso = block.end_at ?? block.start_at;
          formData.set(
            'end_at',
            mergeTimeInputWithIso(baseIso, patch.endInput).slice(0, 16),
          );
        }
      }
      startUpdateTransition(async () => {
        try {
          await updateScheduleBlock(formData);
          router.refresh();
        } catch (err) {
          onError(
            err instanceof Error
              ? err.message
              : "Couldn't save the edit. Try again.",
          );
        }
      });
    }, 600);
  }

  function handleLabelChange(value: string) {
    setLabel(value);
    scheduleSave({ label: value });
  }

  function handleStartChange(value: string) {
    setStartInput(value);
    scheduleSave({ startInput: value });
  }

  function handleEndChange(value: string) {
    setEndInput(value);
    scheduleSave({ endInput: value });
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Remove "${block.label}" from your schedule?${
          parentKey === null ? ' All parts inside it will also be removed.' : ''
        }`,
      )
    ) {
      return;
    }
    try {
      const formData = new FormData();
      formData.set('event_id', eventId);
      formData.set('block_id', block.block_id);
      await deleteScheduleBlock(formData);
      router.refresh();
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Couldn't remove this block. Try again.",
      );
    }
  }

  const isDraggingOther =
    draggedId !== null &&
    draggedId !== block.block_id &&
    draggedParentKey === parentKey;
  const isThisDragged = draggedId === block.block_id;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(block.block_id, parentKey)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(block.block_id, parentKey)}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 sm:gap-3 ${
        emphasize
          ? 'border border-terracotta/35 bg-white'
          : 'border border-ink/10 bg-white'
      } ${isThisDragged ? 'opacity-50' : ''} ${
        isDraggingOther ? 'ring-2 ring-terracotta/40' : ''
      }`}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="touch-none text-ink/30 hover:text-ink/60"
      >
        <GripVertical
          aria-hidden
          className="h-4 w-4 flex-shrink-0"
          strokeWidth={2}
        />
      </button>

      <input
        type="text"
        value={label}
        onChange={(e) => handleLabelChange(e.target.value)}
        maxLength={120}
        aria-label="Block label"
        className={`min-w-0 flex-1 truncate bg-transparent text-sm outline-none placeholder-ink/35 ${
          emphasize ? 'font-medium text-ink' : 'text-ink/85'
        }`}
      />

      <input
        type="time"
        value={startInput}
        onChange={(e) => handleStartChange(e.target.value)}
        aria-label="Start time"
        className="w-[78px] rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:w-[88px] sm:text-sm"
      />
      <span aria-hidden className="text-xs text-ink/40">
        →
      </span>
      <input
        type="time"
        value={endInput}
        onChange={(e) => handleEndChange(e.target.value)}
        aria-label="End time"
        className="w-[78px] rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:w-[88px] sm:text-sm"
      />

      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Remove ${block.label}`}
        className="text-ink/35 transition-colors hover:text-rose-700"
      >
        <Trash2
          aria-hidden
          className="h-3.5 w-3.5 flex-shrink-0"
          strokeWidth={2}
        />
      </button>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Inline [+ Add part] form · drawer-style disclosure below the children
 * of a parent block. Submit fires createScheduleBlock with the parent's
 * block_id, then revalidates so the new part renders inline.
 * ──────────────────────────────────────────────────────────────────── */

function AddPartForm({
  eventId,
  parentBlockId,
  blockType,
  fallbackStartIso,
  fallbackEndIso,
  onError,
}: {
  eventId: string;
  parentBlockId: string;
  blockType: string;
  fallbackStartIso: string;
  fallbackEndIso: string;
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [startInput, setStartInput] = useState(isoToTimeInput(fallbackStartIso));
  const [endInput, setEndInput] = useState(isoToTimeInput(fallbackEndIso));
  const [isPending, startTransition] = useTransition();

  // Resync defaults when the parent fallback shifts (e.g., a sibling was
  // added/removed and the next-start changed).
  useEffect(() => {
    if (!open) {
      setStartInput(isoToTimeInput(fallbackStartIso));
      setEndInput(isoToTimeInput(fallbackEndIso));
    }
  }, [open, fallbackStartIso, fallbackEndIso]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (label.trim().length === 0) {
      onError('Give this part a name first.');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('parent_block_id', parentBlockId);
    formData.set('label', label.trim());
    formData.set('block_type', blockType);
    formData.set(
      'start_at',
      mergeTimeInputWithIso(fallbackStartIso, startInput).slice(0, 16),
    );
    formData.set(
      'end_at',
      mergeTimeInputWithIso(fallbackEndIso, endInput).slice(0, 16),
    );
    // Parts default to private (sensitive ritual / family-only details
    // don't leak to public guest landing page). Host flips per-part in
    // the /schedule deep-edit page.
    // (omitted form field = is_public=FALSE in the action)

    startTransition(async () => {
      try {
        await createScheduleBlock(formData);
        setOpen(false);
        setLabel('');
        router.refresh();
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : "Couldn't add this part. Try again.",
        );
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-terracotta hover:text-terracotta-700"
      >
        <Plus aria-hidden className="h-3 w-3" strokeWidth={2.25} />
        Add part
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-terracotta/30 bg-white p-2.5 sm:flex-row sm:items-center sm:gap-2"
    >
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={120}
        autoFocus
        placeholder="e.g. Sand ceremony"
        className="min-w-0 flex-1 rounded border border-ink/15 px-2 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
      />
      <input
        type="time"
        value={startInput}
        onChange={(e) => setStartInput(e.target.value)}
        aria-label="Start time"
        className="w-[78px] rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:w-[88px] sm:text-sm"
      />
      <span aria-hidden className="text-xs text-ink/40">
        →
      </span>
      <input
        type="time"
        value={endInput}
        onChange={(e) => setEndInput(e.target.value)}
        aria-label="End time"
        className="w-[78px] rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:w-[88px] sm:text-sm"
      />
      <div className="flex items-center gap-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-md bg-terracotta px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-700 disabled:opacity-60"
        >
          {isPending ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setLabel('');
          }}
          className="px-2 py-1 text-xs text-ink/55 hover:text-ink/80"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Inline [+ Add block] form · creates a NEW top-level block (no parent).
 * Same drawer pattern as AddPartForm but writes parent_block_id=NULL.
 * ──────────────────────────────────────────────────────────────────── */

function AddTopLevelBlockForm({
  eventId,
  fallbackStartIso,
  onError,
}: {
  eventId: string;
  fallbackStartIso: string;
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [startInput, setStartInput] = useState(
    isoToDatetimeLocal(fallbackStartIso),
  );
  const defaultEndIso = new Date(
    new Date(fallbackStartIso).getTime() + 60 * 60 * 1000,
  ).toISOString();
  const [endInput, setEndInput] = useState(isoToDatetimeLocal(defaultEndIso));
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (label.trim().length === 0) {
      onError('Give this block a name first.');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('label', label.trim());
    formData.set('block_type', 'custom');
    formData.set('start_at', startInput);
    formData.set('end_at', endInput);
    formData.set('is_public', 'on'); // top-level blocks default to public

    startTransition(async () => {
      try {
        await createScheduleBlock(formData);
        setOpen(false);
        setLabel('');
        router.refresh();
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : "Couldn't add this block. Try again.",
        );
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-terracotta/40 bg-cream/40 px-3 py-2 text-sm text-terracotta hover:border-terracotta hover:bg-terracotta/5"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
        Add a new schedule block
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-lg border border-terracotta/30 bg-white p-3"
    >
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={120}
        autoFocus
        placeholder="e.g. Sunset photos · Send-off · Bridal prep"
        className="w-full rounded border border-ink/15 px-2 py-1.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex flex-col text-[10px] uppercase tracking-[0.12em] text-ink/55">
          Start
          <input
            type="datetime-local"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            className="mt-0.5 rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:text-sm"
          />
        </label>
        <label className="flex flex-col text-[10px] uppercase tracking-[0.12em] text-ink/55">
          End
          <input
            type="datetime-local"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            className="mt-0.5 rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:text-sm"
          />
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-md bg-terracotta px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-700 disabled:opacity-60"
          >
            {isPending ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setLabel('');
            }}
            className="px-2 py-1 text-xs text-ink/55 hover:text-ink/80"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
