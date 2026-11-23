'use client';

/**
 * ✍️ ONE EDITOR PER PART — what a person sees (drawing `prototypes/desktop_split_view_2026-11-21/
 * desktop_split_view_v2_fable.html`, frames 3–5). Drawing only: `part-edit-gate.tsx` decides which one shows, the lab
 * (`app/dev/desktop-split-lab`) draws each frame. Words come from `lib/part-editor-lock.ts`.
 *
 *   · {@link PartEditBar} — the quiet bar: "Ria is editing Guests." (lock) · "Guests is free." (check) · "Claire took over
 *     Guests." (info) · the draft line. Never a pop-up.
 *   · {@link KeptChange} — "Your unsaved change" with Put it back (grey until the part is free) · Discard.
 *   · {@link DraftOnLatestCard} — the change on top of the host's latest: "Your change" rows, "<Host> changed this too"
 *     rows with a pick (Yours · Claire's), Confirm · Discard draft. Nothing saves until Confirm.
 */
import { Check, Info, Lock, Trash2, Undo2, UserRoundPen } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { PillSelector } from '@/app/_components/pill-selector';
import {
  KEPT_TITLE,
  TAKE_OVER,
  confirmLabel,
  draftItemLine,
  draftWords,
  possessive,
  putItBackLabel,
  type BarWords,
  type DraftItem,
  type DraftPick,
  type DraftRow,
  type EditPart,
} from '@/lib/part-editor-lock';
import s from './part-edit.module.css';

export type BarTone = 'held' | 'free' | 'bumped' | 'draft';

const ICON = { held: Lock, free: Check, bumped: Info, draft: Info } as const;

export function PartEditBar({ tone, words, onTakeOver }: { tone: BarTone; words: BarWords; onTakeOver?: () => void }) {
  const Icon = ICON[tone];
  const cls = tone === 'free' ? `${s.bar} ${s.free}` : tone === 'bumped' ? `${s.bar} ${s.bump}` : s.bar;
  return (
    <div className={cls} role="status" aria-live="polite" data-part-edit-bar={tone}>
      <Icon aria-hidden strokeWidth={2} />
      <span className={s.barWords}>
        <b>{words.lead}</b> {words.rest}
      </span>
      {onTakeOver ? (
        <span className={s.barAct}>
          <ActionButton tone="neutral" quiet icon={UserRoundPen} label={TAKE_OVER} onClick={onTakeOver} />
        </span>
      ) : null}
    </div>
  );
}

export function KeptChange({
  part,
  items,
  free,
  onPutBack,
  onDiscard,
}: {
  part: EditPart;
  items: readonly DraftItem[];
  /** The part is free now — Put it back can be pressed. Grey while the host still edits. */
  free: boolean;
  onPutBack: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className={s.keep} data-part-edit-kept="">
      <b>{KEPT_TITLE}</b>
      <ul className={s.keepLines}>
        {items.map((it) => (
          <li key={it.key}>{draftItemLine(it)}</li>
        ))}
      </ul>
      <div className={s.two}>
        <ActionButton tone="brand" main icon={Undo2} label={putItBackLabel(part, free)} disabled={!free} onClick={onPutBack} />
        <ActionButton tone="neutral" icon={Trash2} label="Discard" onClick={onDiscard} />
      </div>
    </div>
  );
}

export function DraftOnLatestCard({
  host,
  rows,
  picks,
  onPick,
  onConfirm,
  onDiscard,
  busy = false,
}: {
  /** Whose latest version the draft sits on (the host who took over), when known. */
  host: string | null;
  rows: readonly DraftRow[];
  picks: Readonly<Record<string, DraftPick>>;
  onPick: (key: string, pick: DraftPick) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  busy?: boolean;
}) {
  const theirs = host ? possessive(host) : 'Theirs';
  return (
    <div data-part-edit-draft="">
      <PartEditBar tone="draft" words={draftWords(host, rows)} />
      <ul className={s.draftList}>
        {rows.map((r) => (
          <li key={r.key} className={s.drow} data-draft-row={r.conflict ? 'pick' : 'yours'}>
            <span className={s.drowHead}>
              {r.label}
              {r.conflict ? (
                <span className={`${s.pill} ${s.pillToo}`}>{host ? `${host} changed this too` : 'Changed by someone else too'}</span>
              ) : (
                <span className={`${s.pill} ${s.pillYours}`}>Your change</span>
              )}
            </span>
            {r.conflict ? (
              <>
                <span className={s.drowLine}>Pick one.</span>
                <div className={s.drowPick}>
                  <PillSelector<DraftPick>
                    label={`${r.label}: yours or ${theirs}`}
                    value={picks[r.key] ?? 'mine'}
                    onPick={(k) => onPick(r.key, k)}
                    options={[
                      { key: 'mine', label: <span className={s.pickFace}><small>Yours</small>{r.to || '—'}</span> },
                      { key: 'theirs', label: <span className={s.pickFace}><small>{theirs}</small>{r.theirs || '—'}</span> },
                    ]}
                  />
                </div>
              </>
            ) : (
              <span className={s.drowLine}>
                {r.from || '—'} → {r.to || '—'}.{host ? ` ${host} did not touch this.` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className={s.draftActs}>
        <ActionButton tone="brand" main icon={Check} label={confirmLabel(rows, picks)} waiting={busy} onClick={onConfirm} />
        <ActionButton tone="neutral" icon={Trash2} label="Discard draft" onClick={onDiscard} />
      </div>
    </div>
  );
}

/** The pill beside the part's title while a draft is open (drawing: "Not saved yet"). */
export function NotSavedYet() {
  return <span className={`${s.pill} ${s.pillDraft}`}>Not saved yet</span>;
}

export const partEditStyles = s;
