'use client';

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Pencil, X } from 'lucide-react';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import {
  amountDigits,
  amountWords,
  enterKeeps,
  keepOutcome,
  longAnswerMoves,
  longAnswerPlan,
  saveFailedWords,
  showsRequired,
  type FieldExit,
  type KeepAnswer,
} from '@/lib/form-row';
import { Explain } from './explain';
import { SWITCH_BUTTON, SwitchTrack } from './switch-track';

/**
 * FORM ROW — one fact to type or pick: its name on the left, its answer on the right, one thin line between rows
 * (`INTERACTION_RULES.md` § 9, kinds 6 and 10; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 6 Form row · § 10 Field — *"a field IS a Form row"*: there is no second look for typing).
 *
 * Owner, 2026-10-08: *"how each row is presented there and create a selector if needed"* · *"field follow form row
 * style"* · *"do you have a better approach for this? to make it consistent to the design?"* · *"cannot edit the
 * other. no more check just (X) tapping out is auto accept or pressing enter"* · *"highlighted text box are
 * required"* · *"if a text box has incomplete information or invalid. make it shake so they can find it easily"* ·
 * *"i want this to scroll so they see the whole content of the message. pause for 1 second then start from the
 * beginning again"* · *"should dropdown have a consistent width?"* · *"the collapse should also animate how the Row
 * Name returns"* · *"pill box not rounded edge"*.
 *
 * ── EVERY ANSWER IS THE SAME WHITE PILL ─────────────────────────────────────
 * …and one small accent mark at its right says what a tap does: a pencil = type (`TypedRow`) · an arrow = choose
 * (`ChosenRow`, the house `PickMenu`) · on/off is the one switch (`SwitchRow`, `SwitchTrack`) · an answer made of
 * parts opens them under it (`OpensRow`, the arrow again). The pills of one list
 * (`FormRows`) are ONE width, so their right edges and their marks line up and a pill never changes size when its
 * answer does: `short` (150 px) or `wide` (200 px) — a size per LIST, never one for the whole app.
 *
 * ── TYPING (`TypedRow`) ─────────────────────────────────────────────────────
 *   · a tap opens the field ACROSS THE WHOLE ROW: the row keeps its height, its name steps aside and becomes the
 *     field's placeholder;
 *   · the open field carries ONLY ✕. Tapping anywhere outside it — another row included, which then opens — or
 *     Enter KEEPS; ✕ or Esc leaves it as it was (`lib/form-row.ts` `keepOutcome`);
 *   · ONE row is open at a time;
 *   · closing is animated too: the field folds back to the right, the name slides back in from the left;
 *   · after a save lands the pencil shows a tick for a moment (no "Saved" word in the row);
 *   · a long message opens a taller box with large rounded corners under its name — the ✕ on the name's line, at
 *     the right, so it stays in view above the keyboard (Enter is a new line there);
 *   · an amount keeps its ₱;
 *   · an answer too long for its pill scrolls slowly to its end, rests one second, returns and repeats — its own
 *     strip moved with `transform`, only while on screen, stopped while the row is edited, still under "reduce
 *     motion" (the "…" stays).
 *
 * ── STATES ──────────────────────────────────────────────────────────────────
 *   · REQUIRED = the accent highlight and the word "Required" beside the name, both gone once it is filled;
 *   · RED is only for something WRONG, said in plain words under the row; what was typed stays in the pill and is
 *     NOT sent;
 *   · a wrong or unfinished answer SHAKES once and the screen moves to it (`nudgeFormRows` does the same for a
 *     screen's main button);
 *   · a save that did not land says so under the row with Try again — never a tick.
 *
 * Neutral: nothing here knows the Maker or any one screen (a row is told what keeping MEANS — `onKeep`), and no
 * accent colour is written here (`sn-accent` only).
 */

/* ── the list ──────────────────────────────────────────────────────────── */

/** The pill's width in a list — one of a few standard sizes (owner: "should dropdown have a consistent width?"). */
export const FORM_PILL_WIDTH = { short: 'w-[150px]', wide: 'w-[200px]' } as const;
export type FormPillWidth = keyof typeof FORM_PILL_WIDTH;

/** The white pill an answer wears (the dropdown button's own shape: a full pill, 40 px, the mark pinned right). */
export const FORM_PILL_CLASS =
  'sn-row-pill sn-press sn-press-ring inline-flex h-10 min-h-10 flex-none items-center justify-between gap-1.5 rounded-full border bg-white pl-3.5 pr-2.5 text-left text-[14px] font-medium text-ink transition-colors duration-sn-control ease-sn';
/** The same pill on the house dropdown (`PickMenu` keeps its own button; these lay the row's look over it). */
export const FORM_PICK_CLASS = '!h-10 !min-h-10 flex-none justify-between !gap-1.5 border border-ink/15 !bg-white !pl-3.5 !pr-2.5 !text-[14px] !font-medium';
/** The small mark at a pill's right. */
const MARK = 'h-4 w-4 flex-none';

type Rows = {
  width: FormPillWidth;
  /** The row whose field is open — one at a time. */
  open: string | null;
  setOpen: (id: string | null) => void;
};
const RowsContext = createContext<Rows | null>(null);

/**
 * A list of rows: its pills share ONE width, and one of its fields is open at a time.
 * (Rows drawn outside a list still work — each keeps its own state and takes the `wide` pill.)
 */
export function FormRows({
  width = 'wide',
  children,
  data,
  attrs,
  className = '',
}: {
  width?: FormPillWidth;
  children: ReactNode;
  data?: string;
  /** The screen's own `data-*` hooks on the list. */
  attrs?: Readonly<Record<`data-${string}`, string>>;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const value = useMemo(() => ({ width, open, setOpen }), [width, open]);
  return (
    <RowsContext.Provider value={value}>
      <div {...attrs} data-form-rows={data ?? ''} data-form-pill-width={width} className={`flex flex-col ${className}`}>
        {children}
      </div>
    </RowsContext.Provider>
  );
}

/** The width every pill of the list this row sits in wears — for a row drawn in its own file (`form-row-date.tsx`). */
export function usePillWidth(): string {
  return FORM_PILL_WIDTH[useContext(RowsContext)?.width ?? 'wide'];
}

/* ── the row ───────────────────────────────────────────────────────────── */

/** A row's ⓘ: the popup's heading and its words. */
export type FormRowAbout = { title?: string; words: ReactNode };

/** The row's band and its line — ONE arrangement for a typed, a chosen, a switched and a shown answer. */
export const FORM_ROW_BAND = 'border-t border-ink/10 first:border-t-0';
export const FORM_ROW_LINE = 'flex min-h-[52px] items-center gap-2.5';

/** The name on the left, with "Required" under it while it is still needed, and its ⓘ beside it. */
function RowName({
  name,
  about,
  needed,
  nameId,
  mark,
  line,
}: {
  name: string;
  about?: FormRowAbout | null;
  needed?: boolean;
  nameId?: string;
  mark?: ReactNode;
  line?: ReactNode;
}) {
  return (
    <span data-form-row-name="" className="sn-row-name flex min-w-0 flex-1 items-center">
      <span className="min-w-0">
        <span id={nameId} className="block text-[15px] font-medium leading-tight text-ink">
          {name}
          {mark ? (
            <span data-form-row-name-mark="" className="ml-1.5 inline-flex align-middle">
              {mark}
            </span>
          ) : null}
        </span>
        {needed ? (
          <small data-form-row-required="" className="block text-[11px] font-bold leading-tight text-sn-accent">
            Required
          </small>
        ) : null}
        {line ? (
          <small data-form-row-line="" className="mt-0.5 block text-[12.5px] font-normal leading-snug text-ink/55">
            {line}
          </small>
        ) : null}
      </span>
      {about ? (
        <Explain title={about.title ?? name} className="-my-1">
          {about.words}
        </Explain>
      ) : null}
    </span>
  );
}

/** One line under a row for something that is WRONG — red, plain words. */
function RowProblem({ children }: { children: ReactNode }) {
  return (
    <p role="alert" data-form-row-problem="" className="-mt-1 pb-2.5 pl-0.5 text-[12.5px] font-semibold text-danger-700">
      {children}
    </p>
  );
}

/**
 * The row, with any answer handed in on the right. Use `TypedRow` / `ChosenRow` / `SwitchRow` / `FactRow` unless the
 * answer is a control of the screen's own (its button keeps its own handler; it sits where the pill would).
 */
export function FormRow({
  name,
  about,
  mark,
  line,
  children,
  note,
  problem,
  below,
  data,
  attrs,
}: {
  name: string;
  about?: FormRowAbout | null;
  /** A small mark after the name — the Pro mark ◆ (gallery § 20: shown, never a lock). */
  mark?: ReactNode;
  /** One quiet line under the name, INSIDE the row (a list row's second line — what the action at the right does). */
  line?: ReactNode;
  /** The answer, on the right. */
  children?: ReactNode;
  /** One quiet line under the row. */
  note?: ReactNode;
  /** One red line under the row — something is wrong. */
  problem?: ReactNode;
  /** More of this row, under it (the screen's own). */
  below?: ReactNode;
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  return (
    <div {...attrs} data-form-row={data ?? ''} className={FORM_ROW_BAND}>
      <div className={`${FORM_ROW_LINE}${line ? ' py-2' : ''}`}>
        <RowName name={name} about={about} mark={mark} line={line} />
        {children}
      </div>
      {note ? (
        <p data-form-row-note="" className="-mt-1 pb-2.5 pl-0.5 text-[12.5px] text-ink/55">
          {note}
        </p>
      ) : null}
      {problem ? <RowProblem>{problem}</RowProblem> : null}
      {below}
    </div>
  );
}

/* ── a long answer in its pill ─────────────────────────────────────────── */

/**
 * The pill's words. When they fit they are simply shown; when they do not they are cut with "…" and — on screen, the
 * row not being edited, motion allowed — ride their own strip to their end and back (`longAnswerPlan`).
 */
function PillWords({ text, quiet }: { text: string; quiet: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const strip = useRef<HTMLSpanElement>(null);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const el = box.current;
    const words = strip.current;
    if (!el || !words || typeof IntersectionObserver === 'undefined' || !words.animate) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let run: Animation | null = null;
    let onScreen = false;
    const stop = () => {
      run?.cancel();
      run = null;
      setMoving(false);
    };
    const start = () => {
      stop();
      if (!longAnswerMoves({ onScreen, editing: false, reducedMotion: still.matches })) return;
      /* The box's own overflow (an inline strip reports no width of its own). */
      const plan = longAnswerPlan(el.scrollWidth - el.clientWidth);
      if (!plan) return;
      setMoving(true);
      run = words.animate(
        plan.frames.map((f) => ({ transform: `translateX(${f.x}px)`, offset: f.offset })),
        { duration: plan.totalMs, iterations: Infinity, easing: 'linear' },
      );
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) onScreen = e.intersectionRatio >= 0.6;
        start();
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    still.addEventListener?.('change', start);
    return () => {
      io.disconnect();
      still.removeEventListener?.('change', start);
      stop();
    };
  }, [text]);
  return (
    <span
      ref={box}
      data-form-row-words=""
      data-form-row-words-moving={moving ? '' : undefined}
      /* While the words travel the "…" would sit in the middle of them: the edge fades instead. */
      className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap ${moving ? '[mask-image:linear-gradient(90deg,black_calc(100%-16px),transparent)]' : 'text-ellipsis'} ${quiet ? 'font-normal text-ink/45' : ''}`}
    >
      {/* Its own strip: `transform` moves it; nothing here lays the row out again. */}
      <span ref={strip} className={moving ? 'inline-block will-change-transform' : undefined}>
        {text}
      </span>
    </span>
  );
}

/* ── a typed answer ────────────────────────────────────────────────────── */

type Saving = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'failed'; text: string; reason: string | null } | { kind: 'wrong'; words: string };

/** How long the tick stays in the pencil's place after a save lands. */
export const FORM_ROW_TICK_MS = 1600;

/**
 * A typed answer: the pill with a pencil; a tap opens the field across the row.
 * `onKeep` is told the kept words ONCE — it may answer `{ ok: false, error }` (or throw) when the save did not land.
 */
export function TypedRow({
  name,
  about,
  value,
  empty = 'Add',
  placeholder,
  long = false,
  maxLength = 240,
  amount = false,
  required = false,
  check = null,
  clean = null,
  onKeep,
  onType,
  inputMode,
  autoCapitalize,
  data,
  attrs,
  pillAttrs,
  note,
  below,
  openAsk = 0,
}: {
  /** Bumped by the screen to open this row's field (a jump from elsewhere that lands ON this fact). 0 = never asked. */
  openAsk?: number;
  name: string;
  about?: FormRowAbout | null;
  /** The answer as it stands ('' = none yet). For an amount: its digits ("250000"). */
  value: string;
  /** What the pill says while there is no answer. */
  empty?: string;
  /** The open field's placeholder — the row's name unless given. */
  placeholder?: string;
  /** A message: a taller box with large rounded corners under its name; Enter is a new line. */
  long?: boolean;
  maxLength?: number;
  /** An amount: it keeps its ₱, takes digits, and is shown with its commas. */
  amount?: boolean;
  required?: boolean;
  /** What is wrong with these words, in plain words — or null. */
  check?: ((text: string) => string | null) | null;
  /** The screen's own tidying of what was typed (a name's allowed letters) — what the pill then shows IS what is kept. */
  clean?: ((text: string) => string) | null;
  /** Keep these words (trimmed; an amount's digits). */
  onKeep: (text: string) => KeepAnswer | Promise<KeepAnswer>;
  /**
   * The words AS THEY ARE TYPED in the open field — and, once when it closes, the words the row is left holding (the
   * kept ones, or what it held before on ✕). For a screen that shows the answer somewhere else while it is typed (a
   * live preview of the page). NEVER a save: keeping is `onKeep`, once.
   */
  onType?: (text: string) => void;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url';
  autoCapitalize?: 'off' | 'sentences' | 'words';
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
  /** The screen's own hooks on the pill (a door other code looks for). */
  pillAttrs?: Readonly<Record<`data-${string}`, string>>;
  /** One quiet line under the row. */
  note?: ReactNode;
  below?: ReactNode;
}) {
  const rows = useContext(RowsContext);
  const width = usePillWidth();
  const id = useId();
  const nameId = useId();
  const [mode, setMode] = useState<'shut' | 'open' | 'leaving'>('shut');
  /* What the pill shows — the kept words at once, before the save lands; it follows the screen when that changes. */
  const [shown, setShown] = useState(value);
  useEffect(() => setShown(value), [value]);
  const [state, setState] = useState<Saving>({ kind: 'idle' });
  /** Bumped when the field has folded away — the name and the pill slide back in. */
  const [back, setBack] = useState(0);
  const [shake, setShake] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const after = useRef<(() => void) | null>(null);
  const refocus = useRef(false);

  const open = () => {
    if (mode !== 'shut') return;
    rows?.setOpen(id);
    setMode('open');
  };
  /* The screen asked for this field (never on mount: opening a page opens no field and writes nothing). */
  const asked = useRef(openAsk);
  useEffect(() => {
    if (openAsk === asked.current) return;
    asked.current = openAsk;
    rows?.setOpen(id);
    setMode((m) => (m === 'shut' ? 'open' : m));
    // Only the ask itself opens it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAsk]);
  /* One row open at a time: when another row of the list opens, this one keeps what it holds and closes (its field's
     own tap-out has usually done so already — `done` in the field makes the second ask a no-op). */
  const field = useRef<{ end: (exit: FieldExit) => void } | null>(null);
  const openElsewhere = rows !== null && rows.open !== null && rows.open !== id;
  useEffect(() => {
    if (openElsewhere && mode === 'open') field.current?.end('tap-out');
  }, [openElsewhere, mode]);

  const send = useCallback(
    (text: string) => {
      setState({ kind: 'saving' });
      let answer: KeepAnswer | Promise<KeepAnswer>;
      try {
        answer = onKeep(text);
      } catch {
        setState({ kind: 'failed', text, reason: null });
        return;
      }
      void Promise.resolve(answer).then(
        (r) => {
          if (r && r.ok === false) setState({ kind: 'failed', text, reason: r.error ?? null });
          else setState({ kind: 'saved' });
        },
        () => setState({ kind: 'failed', text, reason: null }),
      );
    },
    [onKeep],
  );
  /* The tick is there for a moment, then the pencil is back. */
  useEffect(() => {
    if (state.kind !== 'saved') return;
    const t = window.setTimeout(() => setState((s) => (s.kind === 'saved' ? { kind: 'idle' } : s)), FORM_ROW_TICK_MS);
    return () => window.clearTimeout(t);
  }, [state.kind]);

  const end = (exit: FieldExit, typed: string) => {
    if (mode !== 'open') return;
    const out = keepOutcome({ exit, typed: amount ? amountDigits(typed) : clean ? clean(typed) : typed, before: shown, long, required, check });
    /* What the row is left holding is said once (a preview drawn while typing ends on it). */
    onType?.(out.kind === 'send' || out.kind === 'wrong' ? out.text : shown);
    if (out.kind === 'send') {
      setShown(out.text);
      after.current = () => send(out.text);
    } else if (out.kind === 'wrong') {
      setShown(out.text);
      after.current = () => {
        setState({ kind: 'wrong', words: out.words });
        setShake((n) => n + 1);
      };
    } else if (out.kind === 'still-needed') {
      after.current = () => setShake((n) => n + 1);
    } else {
      after.current = null;
    }
    /* Enter and Esc came from the keyboard: the focus goes back to the pill. A tap went where the finger did. */
    refocus.current = exit === 'enter' || exit === 'escape';
    if (rows?.open === id) rows.setOpen(null);
    const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) closed();
    else setMode('leaving');
  };
  /** The field has folded away: the row is itself again, and what keeping meant happens now. */
  const closed = () => {
    setMode('shut');
    setBack((n) => n + 1);
    const then = after.current;
    after.current = null;
    then?.();
  };
  /* The fold-away is an animation; if it never reports its end (a hidden tab), the row still closes. */
  useEffect(() => {
    if (mode !== 'leaving') return;
    const t = window.setTimeout(closed, 420);
    return () => window.clearTimeout(t);
    // `closed` reads only refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (back === 0 || !refocus.current) return;
    refocus.current = false;
    pill.current?.focus({ preventScroll: true });
  }, [back]);
  /* A wrong or unfinished answer shakes ONCE, and the screen moves to it. */
  useEffect(() => {
    if (shake === 0) return;
    const el = pill.current;
    if (!el) return;
    shakeIntoView(el);
  }, [shake]);

  const needed = showsRequired(required, shown) && mode === 'shut';
  const words = amount ? amountWords(shown) : shown;
  const wrong = state.kind === 'wrong';
  const failed = state.kind === 'failed';
  const editing = mode !== 'shut';
  return (
    <div
      {...attrs}
      ref={root}
      data-form-row={data ?? ''}
      data-form-row-kind="typed"
      data-form-row-editing={editing ? '' : undefined}
      data-form-row-needs={needed ? 'answer' : wrong ? 'fix' : undefined}
      data-form-row-state={state.kind}
      className={FORM_ROW_BAND}
    >
      {editing ? (
        <FormRowField
          handle={field}
          key="field"
          name={name}
          nameId={nameId}
          start={amount ? amountDigits(shown) : shown}
          placeholder={placeholder ?? name}
          long={long}
          maxLength={maxLength}
          mark={amount ? '₱' : null}
          inputMode={amount ? 'numeric' : inputMode}
          autoCapitalize={autoCapitalize}
          leaving={mode === 'leaving'}
          onType={onType}
          onEnd={end}
          onGone={closed}
        />
      ) : (
        <div key={`line-${back}`} data-form-row-back={back > 0 ? '' : undefined} className={FORM_ROW_LINE}>
          <RowName name={name} about={about} needed={needed} nameId={nameId} />
          <button
            ref={pill}
            type="button"
            {...pillAttrs}
            data-form-row-pill="typed"
            aria-label={`${name}: ${words || 'not set yet'}. Tap to change`}
            aria-busy={state.kind === 'saving' || undefined}
            onClick={open}
            className={`${FORM_PILL_CLASS} ${width} ${
              wrong || failed
                ? 'border-danger-700'
                : needed
                  ? 'border-sn-accent ring-[3px] ring-sn-accent/15'
                  : 'border-ink/15'
            }`}
          >
            <PillWords text={words || empty} quiet={!words} />
            {state.kind === 'saved' ? (
              <Check aria-hidden data-form-row-mark="tick" className={`${MARK} text-success-700`} strokeWidth={2.6} />
            ) : (
              <Pencil aria-hidden data-form-row-mark="pencil" className={`${MARK} ${wrong || failed ? 'text-danger-700' : 'text-sn-accent'}`} strokeWidth={2} />
            )}
          </button>
        </div>
      )}
      {!editing && note ? (
        <p data-form-row-note="" className="-mt-1 pb-2.5 pl-0.5 text-[12.5px] text-ink/55">
          {note}
        </p>
      ) : null}
      {!editing && wrong ? <RowProblem>{state.words}</RowProblem> : null}
      {!editing && failed ? (
        <p role="alert" data-form-row-unsaved="" className="-mt-1 flex flex-wrap items-center gap-x-2 pb-2.5 pl-0.5 text-[12.5px] font-semibold text-danger-700">
          <span>{saveFailedWords(name, state.reason)}</span>
          <button type="button" data-form-row-retry="" onClick={() => send(state.text)} className="sn-press inline-flex min-h-11 items-center underline">
            Try again
          </button>
        </p>
      ) : null}
      {below}
    </div>
  );
}

/** The open field: across the whole row (a long one under its name), and ONE round ✕ — no ✓. (Exported so its test can draw it open.) */
export function FormRowField({
  handle,
  name,
  nameId,
  start,
  placeholder,
  long,
  maxLength,
  mark,
  inputMode,
  autoCapitalize,
  leaving,
  onType,
  onEnd,
  onGone,
}: {
  /** Told the words as they are typed (the row's `onType`). */
  onType?: (text: string) => void;
  /** How the row asks this field to end (another row of the list opened). */
  handle: React.RefObject<{ end: (exit: FieldExit) => void } | null>;
  name: string;
  nameId: string;
  start: string;
  placeholder: string;
  long: boolean;
  maxLength: number;
  mark: string | null;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url';
  autoCapitalize?: 'off' | 'sentences' | 'words';
  leaving: boolean;
  onEnd: (exit: FieldExit, typed: string) => void;
  onGone: () => void;
}) {
  const [text, setTextNow] = useState(start);
  const typed = useRef(start);
  typed.current = text;
  const setText = (next: string) => {
    setTextNow(next);
    onType?.(next);
  };
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  /* Decided once: a ✕ must not ALSO be read as the tap-out that follows it. */
  const done = useRef(false);
  const end = (exit: FieldExit) => {
    if (done.current) return;
    done.current = true;
    onEnd(exit, typed.current);
  };
  const endRef = useRef(end);
  endRef.current = end;
  useLayoutEffect(() => {
    handle.current = { end: (exit) => endRef.current(exit) };
    return () => {
      handle.current = null;
    };
  }, [handle]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (long) el.setSelectionRange(el.value.length, el.value.length);
    else el.select();
    /* The whole field — its ✕ too — is brought into view, above the keyboard. */
    wrap.current?.scrollIntoView({ block: 'nearest' });
    /* Tapping anywhere outside it keeps it (a phone does not always blur a field for a tap on bare page). */
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) endRef.current('tap-out');
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
    // Once, when the field opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shared = {
    ref: box,
    value: text,
    maxLength,
    placeholder,
    'aria-labelledby': nameId,
    'data-form-row-input': '',
    autoCapitalize,
    onBlur: () => end('tap-out'),
    className: 'min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] text-ink outline-none placeholder:text-ink/40',
  } as const;
  const x = (
    <button
      type="button"
      aria-label="Leave it as it was"
      data-form-row-leave=""
      /* Before the field's blur: ✕ is "as it was", never the tap-out that keeps. */
      onPointerDown={(e) => {
        e.preventDefault();
        end('x');
      }}
      onClick={() => end('x')}
      className="sn-press flex h-11 w-11 flex-none items-center justify-center rounded-full border border-ink/15 bg-ink/[0.06] text-ink/70"
    >
      <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.4} />
    </button>
  );
  const onKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && enterKeeps(long)) {
      e.preventDefault();
      end('enter');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      end('escape');
    }
  };
  const gone = (e: React.AnimationEvent) => {
    if (leaving && e.target === e.currentTarget) onGone();
  };
  if (long) {
    return (
      <div ref={wrap} data-form-row-field="long" data-leaving={leaving ? '' : undefined} onAnimationEnd={gone} className="sn-row-field flex flex-col gap-2 pb-3 pt-2.5">
        {/* Its name on the left, the ✕ at the right of the SAME line — where every other row has it, and above the
            box, so it stays on screen with the keyboard up (controller, 2026-10-08). */}
        <span className="flex items-center justify-between gap-2">
          <span id={nameId} className="min-w-0 text-[12px] font-bold text-sn-accent">
            {name}
          </span>
          {x}
        </span>
        {/* The box IS the field: a message cannot be a pill, so it wears the large corner. */}
        <textarea
          {...shared}
          className="min-h-[88px] w-full resize-none rounded-2xl border border-sn-accent bg-white px-[18px] py-3 text-[16px] leading-snug text-ink outline-none ring-[3px] ring-sn-accent/15 placeholder:text-ink/40"
          rows={3}
          enterKeyHint="enter"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeys}
        />
      </div>
    );
  }
  return (
    <div ref={wrap} data-form-row-field="line" data-leaving={leaving ? '' : undefined} onAnimationEnd={gone} className={`sn-row-field ${FORM_ROW_LINE}`}>
      {/* The row's name is still its name — said to a screen reader, and shown as the field's placeholder. */}
      <span id={nameId} className="sr-only">
        {name}
      </span>
      <span className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-sn-accent bg-white px-[18px] ring-[3px] ring-sn-accent/15">
        {mark ? (
          <span aria-hidden data-form-row-amount-mark="" className="flex-none font-semibold text-ink/45">
            {mark}
          </span>
        ) : null}
        <input {...shared} inputMode={inputMode} enterKeyHint="done" onChange={(e) => setText(e.target.value)} onKeyDown={onKeys} />
      </span>
      {x}
    </div>
  );
}

/* ── a chosen answer ───────────────────────────────────────────────────── */

/** A chosen answer: the same pill with an arrow — the house dropdown (`PickMenu`: a sheet on a phone, a list under its button on a computer). */
export function ChosenRow({
  name,
  about,
  mark,
  label,
  value,
  options,
  onPick,
  buttonText,
  dataAttr,
  note,
  problem,
  below,
  data,
  attrs,
}: {
  name: string;
  about?: FormRowAbout | null;
  /** A small mark after the name (the Pro mark ◆). */
  mark?: ReactNode;
  /** More of this row, under it (the screen's own — a quiet action that belongs to the pick). */
  below?: ReactNode;
  /** The dropdown's own name (its sheet's title) — the row's name unless given. */
  label?: string;
  value: string | null;
  options: readonly PickOption[];
  onPick: (key: string) => void;
  /** What the pill says, when it is not the picked option's own label. */
  buttonText?: string;
  dataAttr?: string;
  note?: ReactNode;
  problem?: ReactNode;
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  const width = usePillWidth();
  return (
    <FormRow name={name} about={about} mark={mark} note={note} problem={problem} below={below} data={data} attrs={{ ...attrs, 'data-form-row-kind': 'chosen' }}>
      <PickMenu label={label ?? name} value={value} options={options} onPick={onPick} buttonText={buttonText} dataAttr={dataAttr} className={`${FORM_PICK_CLASS} ${width}`} />
    </FormRow>
  );
}

/* ── an answer made of parts ───────────────────────────────────────────── */

/**
 * An answer that is MADE OF PARTS (an event's name = two people's names and how they are written): ONE row whose
 * pill shows the whole answer and, with the arrow, opens its parts in place under it — each part a row of its own.
 *   · the arrow turns over while open; the parts open downward at the family's speed (still under "reduce motion");
 *   · ONE open at a time on the screen with every fold (`useOneOpen`) — a dropdown opened among the parts never
 *     closes it (`OneOpenScope`);
 *   · the parts STAY MOUNTED while shut — only out of reach (`inert`);
 *   · `needed`: a part that must be filled is still empty — the shut row wears the highlight and "Required", so it
 *     is found without opening it.
 */
export function OpensRow({
  name,
  about,
  answer,
  empty = 'Not set yet',
  needed = false,
  defaultOpen = false,
  openAsk = 0,
  children,
  data,
  attrs,
}: {
  name: string;
  about?: FormRowAbout | null;
  /** The whole answer, as it reads ('' = none yet). */
  answer: string;
  empty?: string;
  needed?: boolean;
  defaultOpen?: boolean;
  /** Bumped by the screen to open the parts. 0 = never asked. */
  openAsk?: number;
  /** The parts — rows of their own. */
  children: ReactNode;
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  const width = usePillWidth();
  const [open, setOpen] = useState(defaultOpen);
  const scope = useOneOpen(open, setOpen);
  const asked = useRef(openAsk);
  useEffect(() => {
    if (openAsk === asked.current) return;
    asked.current = openAsk;
    setOpen(true);
  }, [openAsk]);
  const id = useId();
  const still = needed && !open;
  return (
    <div {...attrs} data-form-row={data ?? ''} data-form-row-kind="opens" data-form-row-open={open ? '' : undefined} data-form-row-needs={still ? 'answer' : undefined} className={FORM_ROW_BAND}>
      <div className={FORM_ROW_LINE}>
        <RowName name={name} about={about} needed={still} />
        <button
          type="button"
          data-form-row-pill="opens"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${name}: ${answer || 'not set yet'}. ${open ? 'Close' : 'Tap to change'}`}
          onClick={() => setOpen((o) => !o)}
          className={`${FORM_PILL_CLASS} ${width} ${still ? 'border-sn-accent ring-[3px] ring-sn-accent/15' : 'border-ink/15'}`}
        >
          <PillWords text={answer || empty} quiet={!answer} />
          <ChevronDown aria-hidden data-form-row-mark="arrow" className={`${MARK} text-sn-accent transition-transform duration-sn-pill ease-sn-spring motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>
      </div>
      <div id={id} data-form-row-parts="" inert={!open} className={`grid transition-[grid-template-rows] duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        {/* The parts sit a step in from the row they belong to; 4 px of room so a focus ring is not cut. */}
        <div className={`-mr-1 min-h-0 overflow-hidden pl-3 pr-1 transition-opacity duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}>
          <OneOpenScope id={scope}>{children}</OneOpenScope>
        </div>
      </div>
    </div>
  );
}

/* ── on / off ──────────────────────────────────────────────────────────── */

/** On or off: the one switch, at the row's right edge. */
export function SwitchRow({
  name,
  about,
  on,
  onChange,
  disabled = false,
  note,
  problem,
  below,
  data,
  attrs,
}: {
  name: string;
  about?: FormRowAbout | null;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  note?: ReactNode;
  problem?: ReactNode;
  /** More of this row, under it (what the switch shows while it is on). */
  below?: ReactNode;
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  return (
    <FormRow name={name} about={about} note={note} problem={problem} below={below} data={data} attrs={{ ...attrs, 'data-form-row-kind': 'switch' }}>
      <button type="button" role="switch" aria-checked={on} aria-label={name} disabled={disabled} data-form-row-switch="" onClick={() => onChange(!on)} className={SWITCH_BUTTON}>
        <SwitchTrack on={on} />
      </button>
    </FormRow>
  );
}

/* ── a fact shown, not typed ───────────────────────────────────────────── */

/**
 * A fact that is set somewhere else: ONE quiet line — the name, the value as guests read it, and where it is
 * changed. No pill and no mark: nothing here can be tapped, so nothing here looks as if it could.
 */
export function FactRow({ name, value, where, data, attrs }: { name: string; value: string | null; where: string; data?: string; attrs?: Readonly<Record<`data-${string}`, string>> }) {
  return (
    <div {...attrs} data-form-row={data ?? ''} data-form-row-kind="fact" className={FORM_ROW_BAND}>
      <div className="flex min-h-11 items-baseline gap-2.5 py-2">
        <span data-form-row-name="" className="flex-none text-[13px] text-ink/55">
          {name}
        </span>
        <span className="min-w-0 flex-1 text-right">
          <span data-form-row-fact="" className={`block whitespace-pre-line text-[14px] ${value ? 'text-ink' : 'text-ink/45'}`}>
            {value ?? 'Not set yet'}
          </span>
          <small data-form-row-where="" className="block text-[12px] text-ink/55">
            {where}
          </small>
        </span>
      </div>
    </div>
  );
}

/* ── the shake ─────────────────────────────────────────────────────────── */

/** Shake `el` once and bring it into view. Under "reduce motion" there is no shake — the scroll still happens. */
export function shakeIntoView(el: HTMLElement): void {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  if (still) return;
  el.classList.remove('sn-row-shake');
  void el.offsetWidth;
  el.classList.add('sn-row-shake');
  el.addEventListener('animationend', () => el.classList.remove('sn-row-shake'), { once: true });
}

/**
 * A screen's main button was pressed while something still needs attention: shake each row that needs an answer or
 * a fix (the first is brought into view and takes the focus). Returns how many — 0 means the button may go on.
 * So a main button is never dead: dimmed while something is missing, and a press on it shows what.
 */
export function nudgeFormRows(within: ParentNode = document): number {
  const pills = Array.from(within.querySelectorAll<HTMLElement>('[data-form-row-needs] [data-form-row-pill]'));
  pills.forEach((el, i) => window.setTimeout(() => (i === 0 ? shakeIntoView(el) : shakeOnly(el)), i * 120));
  pills[0]?.focus({ preventScroll: true });
  return pills.length;
}

function shakeOnly(el: HTMLElement): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.classList.remove('sn-row-shake');
  void el.offsetWidth;
  el.classList.add('sn-row-shake');
  el.addEventListener('animationend', () => el.classList.remove('sn-row-shake'), { once: true });
}
