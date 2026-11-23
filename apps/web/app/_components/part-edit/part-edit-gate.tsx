'use client';

/**
 * ✍️ PART EDIT GATE — one editor per part, around a part's body (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW + ONE
 * EDITOR PER PART — APPROVED TO BUILD"; drawing `prototypes/desktop_split_view_2026-11-21/desktop_split_view_v2_fable.html`
 * frames 3–5). Wraps the part; draws nothing while nobody else edits.
 *
 *   · The first edit inside (input · change · submit) claims the part (`usePartEditorLock`). Each later edit touches it.
 *   · Somebody else editing → the quiet bar "<Name> is editing <Part>. You can look. It frees itself when <Name>
 *     stops." and the body is read-only (`inert`, quieter). A host also gets "Take over".
 *   · They stop → 5 s later the bar says "<Part> is free. You can edit now. <Name>'s changes are in." and the page
 *     reads again (`router.refresh()`), so their changes are in. Nobody asks or refreshes.
 *   · A host takes over from me → "<Host> took over <Part>." My unsaved change (the part's dirty fields) is KEPT in a
 *     card — Put it back (grey while the host edits) · Discard — and the part shows the host's version.
 *   · Put it back → the part is mine again and the change comes back as a DRAFT on top of the host's latest: plain
 *     changes, "<Host> changed this too" picks. Confirm writes the picks into the fields and submits their forms (the
 *     part's own action saves); Discard drops it. Nothing saves before Confirm.
 *
 * The server decides every claim (migration 20271360932916); this only asks and draws.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  FREE_MOMENT_MS,
  draftOnLatest,
  editingWords,
  freeWords,
  lockedForMe,
  resolveDraft,
  takenOverWords,
  type DraftItem,
  type DraftPick,
  type DraftRow,
  type EditPart,
} from '@/lib/part-editor-lock';
import { usePartEditorLock } from './use-part-editor-lock';
import { DraftOnLatestCard, KeptChange, PartEditBar, partEditStyles as s } from './part-edit-bar';
import { readDirtyFields, readLatestValues, resetDirtyFields, writeFieldValues } from './dirty-fields';
import { useEventMe } from '@/app/dashboard/[eventId]/_components/event-team-presence';

type Kept = { by: string; items: DraftItem[] };

const keptKey = (eventId: string, part: EditPart) => `sn-part-kept:${eventId}:${part}`;

function loadKept(eventId: string, part: EditPart): Kept | null {
  try {
    const raw = window.sessionStorage.getItem(keptKey(eventId, part));
    const v = raw ? (JSON.parse(raw) as Kept) : null;
    return v && Array.isArray(v.items) && v.items.length > 0 ? v : null;
  } catch {
    return null;
  }
}
function saveKept(eventId: string, part: EditPart, kept: Kept | null): void {
  try {
    if (kept) window.sessionStorage.setItem(keptKey(eventId, part), JSON.stringify(kept));
    else window.sessionStorage.removeItem(keptKey(eventId, part));
  } catch {
    // Private window / blocked storage: the card still shows for this visit.
  }
}

export function PartEditGate({
  eventId,
  part,
  viewerLabel,
  className,
  children,
}: {
  eventId: string;
  part: EditPart;
  /** The name the others read in "<Name> is editing <Part>." — by default the dashboard's own (`useEventMe`). */
  viewerLabel?: string;
  /** The part body's own spacing — the gate sits between a page's column and its blocks (`space-y-4`). */
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const me = useEventMe();
  const lock = usePartEditorLock(eventId, part, viewerLabel ?? me?.name ?? 'Someone');
  const bodyRef = useRef<HTMLDivElement>(null);
  const [kept, setKept] = useState<Kept | null>(null);
  const [draft, setDraft] = useState<{ by: string | null; rows: DraftRow[] } | null>(null);
  const [picks, setPicks] = useState<Record<string, DraftPick>>({});
  const [freeFrom, setFreeFrom] = useState<string | null | undefined>(undefined);
  // A host took over while I held it and I had nothing unsaved: told once, until the part is free again.
  const [bumpedBy, setBumpedBy] = useState<string | null>(null);

  // A change kept earlier in this tab (the page was reloaded while the host edited).
  useEffect(() => setKept(loadKept(eventId, part)), [eventId, part]);

  const { moment, clearMoment } = lock;
  useEffect(() => {
    if (!moment) return;
    if (moment.kind === 'taken_over') {
      // Keep what I had not saved, then show the host's version.
      const items = readDirtyFields(bodyRef.current);
      resetDirtyFields(bodyRef.current);
      setBumpedBy(moment.by);
      // Nothing unsaved now → a change kept earlier in this tab stays as it was.
      if (items.length > 0) {
        const next: Kept = { by: moment.by, items };
        setKept(next);
        saveKept(eventId, part, next);
      }
      setDraft(null);
      setFreeFrom(undefined);
      // one-render: keep (realtime) — a host took the part (seen by the lock watch); nothing was pressed here, so read the host's version.
      router.refresh();
    } else {
      setBumpedBy(null);
      setFreeFrom(moment.lastEditor);
      // one-render: keep (realtime) — the other editor stopped (seen by the lock watch); nothing was pressed here, so their changes come in.
      router.refresh();
    }
    clearMoment();
  }, [moment, clearMoment, eventId, part, router]);

  // The "is free" moment goes quiet by itself.
  useEffect(() => {
    if (freeFrom === undefined) return;
    const t = setTimeout(() => setFreeFrom(undefined), FREE_MOMENT_MS);
    return () => clearTimeout(t);
  }, [freeFrom]);

  const locked = lockedForMe(lock.state);
  const { edited } = lock;
  const onEdit = useCallback(() => {
    if (draft) return; // the draft is mine already; nothing saves until Confirm
    if (!edited()) return;
    setFreeFrom(undefined);
  }, [edited, draft]);

  const putBack = useCallback(async () => {
    if (!kept) return;
    if (!(await lock.claim())) return;
    const rows = draftOnLatest(kept.items, readLatestValues(bodyRef.current));
    setPicks({});
    setDraft({ by: kept.by, rows });
    setKept(null);
    saveKept(eventId, part, null);
  }, [kept, lock, eventId, part]);

  const discardKept = useCallback(() => {
    setKept(null);
    saveKept(eventId, part, null);
  }, [eventId, part]);

  const [saving, setSaving] = useState(false);
  const confirm = useCallback(() => {
    if (!draft) return;
    setSaving(true);
    lock.edited();
    writeFieldValues(bodyRef.current, resolveDraft(draft.rows, picks));
    setDraft(null);
    setSaving(false);
  }, [draft, picks, lock]);

  const holder = lock.state.holderLabel ?? 'Someone';
  let bar: ReactNode = null;
  if (draft) {
    bar = (
      <DraftOnLatestCard
        host={draft.by}
        rows={draft.rows}
        picks={picks}
        busy={saving}
        onPick={(k, p) => setPicks((v) => ({ ...v, [k]: p }))}
        onConfirm={confirm}
        onDiscard={() => setDraft(null)}
      />
    );
  } else if (kept) {
    bar = (
      <>
        <PartEditBar tone="bumped" words={takenOverWords(kept.by, part, true)} />
        <KeptChange part={part} items={kept.items} free={!locked && lock.state.status !== 'unknown'} onPutBack={() => void putBack()} onDiscard={discardKept} />
      </>
    );
  } else if (locked && bumpedBy) {
    bar = <PartEditBar tone="bumped" words={takenOverWords(bumpedBy, part, false)} />;
  } else if (locked) {
    bar = <PartEditBar tone="held" words={editingWords(holder, part)} onTakeOver={lock.state.canTakeOver ? () => void lock.takeOver() : undefined} />;
  } else if (freeFrom !== undefined) {
    bar = <PartEditBar tone="free" words={freeWords(part, freeFrom)} />;
  }

  return (
    <div data-part-edit={part} data-part-edit-state={lock.state.status}>
      {bar}
      <div
        ref={bodyRef}
        className={[className, locked && !draft ? s.readOnly : ''].filter(Boolean).join(' ') || undefined}
        inert={locked && !draft ? true : undefined}
        onInputCapture={onEdit}
        onChangeCapture={onEdit}
        onSubmitCapture={onEdit}
      >
        {children}
      </div>
    </div>
  );
}
