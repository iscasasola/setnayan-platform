'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { TIMELINE_BAND_CLASS, TIMELINE_ROW_CLASS } from './timeline-states';

/**
 * TIMELINE ROW — `when · name [· trailing]`: one row per moment (owner 2026-10-08, `INTERACTION_RULES.md` § 9;
 * approved gallery `prototypes/control_templates_2026-10-08.html` § 13).
 *
 * Owner: *"tap the time start and time end and name of that schedule"* · *"can also be love story form"*. ONE kind,
 * two wearers: the Schedule (start pill – end pill · name) and the Love Story (when pill · chapter · picture
 * square). The WHEN is whatever the wearer hands in (the ticker's pills, `ticker.tsx`); the NAME is this file's.
 *
 * ── EDITING THE NAME (the Form-row rule, REVISED 2026-10-08) ─────────────────
 * Owner: *"cannot edit the other. no more check just (X) tapping out is auto accept or pressing enter"*.
 *   · tapping the name opens its field ACROSS THE WHOLE ROW (the when and the trailing slot step aside);
 *   · the open field carries ONLY ✕;
 *   · tapping anywhere outside it KEEPS the change — including on another row, which then opens — and so does Enter;
 *   · ✕ or Esc leaves it as it was;
 *   · ONE row is open at a time: the wearer holds which (`editing`), this row only asks (`onEdit`).
 * The row never decides what keeping MEANS (a save, a draft, dropping an unnamed new row) — `onKeep` gets the
 * trimmed words, `onLeave` nothing.
 *
 * Neutral: nothing here knows the Maker, the Schedule or the Love Story, and no accent colour is written here.
 */
/* The band a row sits on, the row's own line, and the two states a page shows BEFORE it has rows (loading, and a
   read that was refused) live in `timeline-states.tsx` — a small file with no hooks, so a page that only shows the
   shimmer or the problem does not carry this whole row with it (the Maker's first load). Re-exported here: nothing
   that imports them from this file changes. */
export { TIMELINE_BAND_CLASS, TIMELINE_ROW_CLASS, TimelineProblem, TimelineRowsLoading } from './timeline-states';

export function TimelineRow({
  when,
  name,
  placeholder,
  nameLabel,
  maxLength = 120,
  canEdit = true,
  editing = false,
  onEdit,
  onKeep,
  onLeave,
  trailing,
  sub,
  note,
  problem,
  below,
  as: Tag = 'li',
  data,
  attrs,
}: {
  /** The when — the ticker's pill, or two with a dash between. Steps aside while the name is open. */
  when: ReactNode;
  /** The name as it stands ('' = not named yet: the placeholder shows, quieter). */
  name: string;
  /** "Name this moment". */
  placeholder: string;
  /** The field's name for a screen reader — "Name of this moment". */
  nameLabel: string;
  maxLength?: number;
  canEdit?: boolean;
  /** Is THIS row's name open? (One at a time — the wearer's state.) */
  editing?: boolean;
  /** The name was tapped: open this row. */
  onEdit?: () => void;
  /** Tapped out, or Enter: keep these (trimmed) words. */
  onKeep?: (text: string) => void;
  /** ✕ or Esc: leave it as it was. */
  onLeave?: () => void;
  /** After the name — ⋯, a picture square. Steps aside while the name is open. */
  trailing?: ReactNode;
  /**
   * ONE quiet line under the name, inside the same tap (gallery § 13: a Love Story moment's first words; a
   * preparation's "who it is with"). One line, then "…" — the row grows by this line and never more. Drawn on the
   * row whose name can be tapped.
   */
  sub?: string | null;
  /** ONE amber line under the row — said, never blocking ("Starts before Ceremony ends (4:00 PM)."). */
  note?: string | null;
  /** ONE line under the row for something that is WRONG or did not save. */
  problem?: string | null;
  /** More of this row, opened in place under it (the wearer's). */
  below?: ReactNode;
  as?: 'li' | 'div';
  /** `data-timeline-row="<data>"`. */
  data?: string;
  /** The wearer's own `data-*` hooks for this row. */
  attrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  return (
    <Tag {...attrs} data-timeline-row={data ?? ''} data-timeline-row-editing={editing ? '' : undefined} className={TIMELINE_BAND_CLASS}>
      {/* The name is the point of the row: it may run to a SECOND line (the row grows, the when stays centred
          beside it), never a third — then "…". The type never shrinks to fit. */}
      <div className={TIMELINE_ROW_CLASS}>
        {editing ? (
          <NameField name={name} placeholder={placeholder} nameLabel={nameLabel} maxLength={maxLength} onKeep={onKeep} onLeave={onLeave} />
        ) : (
          <>
            {when}
            {canEdit ? (
              <button
                type="button"
                data-timeline-name=""
                onClick={onEdit}
                className={`sn-press flex min-h-11 min-w-0 flex-1 ${sub ? 'flex-col justify-center' : 'items-center'} rounded-xl px-1 text-left text-[15px] leading-tight ${name ? 'font-medium text-ink' : 'font-normal text-ink/45'}`}
              >
                <span className="line-clamp-2 min-w-0 break-words">{name || placeholder}</span>
                {sub ? (
                  <span data-timeline-sub="" className="mt-0.5 truncate text-[12.5px] font-normal text-ink/55">
                    {sub}
                  </span>
                ) : null}
              </button>
            ) : (
              <span data-timeline-name="" className="line-clamp-2 min-w-0 flex-1 break-words px-1 text-[15px] font-medium leading-tight text-ink">
                {name}
              </span>
            )}
            {trailing}
          </>
        )}
      </div>
      {note ? (
        <p data-timeline-note="" className="-mt-1 pb-2 pl-5 pr-4 text-[12px] font-semibold text-warn-700">
          {note}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" data-timeline-problem="" className="-mt-1 pb-2 pl-5 pr-4 text-[12.5px] text-danger-700">
          {problem}
        </p>
      ) : null}
      {below}
    </Tag>
  );
}

/** The open name: a full pill across the row and ONE round ✕ — no ✓ (tap out or Enter keeps). */
function NameField({
  name,
  placeholder,
  nameLabel,
  maxLength,
  onKeep,
  onLeave,
}: {
  name: string;
  placeholder: string;
  nameLabel: string;
  maxLength: number;
  onKeep?: (text: string) => void;
  onLeave?: () => void;
}) {
  const [text, setText] = useState(name);
  const box = useRef<HTMLInputElement>(null);
  /* Decided once: a ✕ must not ALSO be read as the tap-out that follows it. */
  const done = useRef(false);
  const end = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep) onKeep?.(text.trim());
    else onLeave?.();
  };
  useEffect(() => {
    box.current?.focus({ preventScroll: false });
    box.current?.select();
  }, []);
  return (
    <div data-timeline-name-field="" className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        ref={box}
        value={text}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={nameLabel}
        enterKeyHint="done"
        onChange={(e) => setText(e.target.value)}
        /* Tapping out — anywhere, another row included — keeps it. */
        onBlur={() => end(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            end(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            end(false);
          }
        }}
        className="min-h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-ink outline-none ring-1 ring-inset ring-ink/25 placeholder:text-ink/40 focus:ring-2 focus:ring-ink/40"
      />
      <button
        type="button"
        aria-label="Leave it as it was"
        data-timeline-name-leave=""
        /* Before the field's blur: ✕ is "as it was", never the tap-out that keeps. */
        onPointerDown={(e) => {
          e.preventDefault();
          end(false);
        }}
        onClick={() => end(false)}
        className="sn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/60 ring-1 ring-inset ring-ink/15"
      >
        <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * EMPTY — nothing here yet: what to do first, and the button to do it (gallery § 16). The action is the wearer's main
 * action (its look comes in as `actionClassName` — the page's one main-button class).
 */
export function TimelineEmpty({
  title,
  children,
  action,
  onAction,
  actionClassName,
  actionAttrs,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
  actionClassName?: string;
  /** The wearer's own `data-*` hooks for the first action. */
  actionAttrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  return (
    <div data-timeline-empty="" className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
      <b className="text-[15px] font-semibold text-ink">{title}</b>
      <p className="max-w-[28ch] text-[13.5px] text-ink/70">{children}</p>
      {action && onAction ? (
        <button type="button" {...actionAttrs} data-timeline-first="" onClick={onAction} className={`mt-2 !w-auto px-6 ${actionClassName ?? ''}`}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** The dash between a start and an end. */
export function TimelineDash() {
  return (
    <span aria-hidden className="shrink-0 text-ink/40">
      –
    </span>
  );
}
