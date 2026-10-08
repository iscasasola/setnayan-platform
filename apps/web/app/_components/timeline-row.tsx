'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

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
/** The band a row sits on, and the row's own line — ONE arrangement for a real row, a sample of one and a loading one. */
export const TIMELINE_BAND_CLASS = 'border-t border-ink/10 bg-cream first:border-t-0';
export const TIMELINE_ROW_CLASS = 'flex min-h-[58px] items-center gap-1 py-1.5 pl-3 pr-1';

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
 * LOADING — soft shapes of the rows that are coming (gallery § 16: *"loading shows soft grey shapes of what is coming,
 * shimmering, so the page does not jump when it arrives"*). The real row's own band and line, so nothing moves when
 * the rows land. Says it is busy; never looks like an empty list (that has words and a first action) or a problem.
 */
export function TimelineRowsLoading({ label, rows = 3, pills = 1 }: { label: string; rows?: number; pills?: 1 | 2 }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} data-timeline-loading="" className="flex animate-pulse flex-col border-y border-ink/10 motion-reduce:animate-none">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={TIMELINE_BAND_CLASS}>
          <div className={TIMELINE_ROW_CLASS}>
            {Array.from({ length: pills }, (_p, j) => (
              <span key={j} aria-hidden className="h-10 w-[72px] shrink-0 rounded-full bg-ink/10" />
            ))}
            <span aria-hidden className={`ml-1.5 h-3.5 rounded-full bg-ink/10 ${['w-32', 'w-24', 'w-40'][i % 3]}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A PROBLEM — the list could not be read (gallery § 16: *"a problem says so in plain words with Try again, and never
 * pretends the list is empty"*). Never the empty state's words; `onRetry` is the wearer's (a re-read, once per tap —
 * no loop).
 */
export function TimelineProblem({ title, children, onRetry }: { title: string; children: ReactNode; onRetry?: (() => void) | null }) {
  return (
    <div role="alert" data-timeline-problem-state="" className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
      <b className="text-[15px] font-semibold text-danger-700">{title}</b>
      <p className="max-w-[28ch] text-[13.5px] text-ink/70">{children}</p>
      {onRetry ? (
        <button type="button" data-timeline-retry="" onClick={onRetry} className="sn-press mt-2 inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold text-ink ring-1 ring-inset ring-ink/20">
          Try again
        </button>
      ) : null}
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
