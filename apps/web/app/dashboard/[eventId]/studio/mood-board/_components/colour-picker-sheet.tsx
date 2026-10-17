'use client';

import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { MAIN_COLOUR_NAMES, cleanHexInput, pickerReadsOn, pickerShelves, type PickerRow } from '@/lib/mood-board-studio';
import { browserStorage, readRecentColours, recentColourKey, rememberRecentColour } from '@/lib/colour-picker-recent';
import { customColourInput } from '@/lib/colour-name-search';
import { useLastSeenScope } from '@/app/_components/last-seen/last-seen-scope';
import { PickSheetContext, pickOpensAsSheet } from '../../../website/editor/_components/pick-menu-place';
import { POPUP_DARK, POPUP_SCRIM, usePopupBehind } from '@/lib/use-popup-behind';

/**
 * 🎨 THE COLOUR PICKER — THE ONE (owner 2026-10-06, DECISION_LOG "AUTO PALETTE BESIDE SAVED — AND A
 * REAL COLOUR PICKER FOR CHANGING IT BY HAND": *"how do we change the palette?"*; owner 2026-10-08:
 * *"we already have a design for the color palettes and how to pick colors on the moodboard. apply
 * that same concept on the background and on any other color rules parts"* · *"restudy is good"* —
 * `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2 + § 6 row 4).
 *
 * 📱 ONE SCREEN, NO SCROLL (owner 2026-10-17, on the Attire › Shirt sheet, verbatim: *"maybe there is a
 * better way to arrange this scroll free. so color code box can be viewed easily. Just have the Moodboard
 * and Recently Used 5 colors."*). "Goes with your Mood Board", "From your photos" and the sixteen
 * Swatches left the sheet that day, and each colour row became ONE row of five dots — so the whole
 * sheet, Custom's code field included, stands inside a 375 × 812 phone's bottom sheet without a scroll
 * (held in the rendered page by `tests/e2e/the-colour-sheet-fits-one-screen.spec.ts`).
 *
 * Every colour control opens THIS sheet — the Mood Board's own, `StudioColourField` for the Studio's
 * rows, `ColourWell` / `ColourSheet` for every well in Stages and Look, the Mood Board's swatches
 * (`swatch-popover.tsx`) — never a second picker. Its shelves, top to bottom:
 *
 *   Against the background   the AA line, only when the caller hands the ground the colour sits on
 *                            (`readsOn`): how the colour chosen NOW reads there — "Clear to read ·
 *                            7.2:1" AA · "Hard to read — pick a deeper colour · 2.1:1" AA ✗ — and
 *                            the two rows under it then lead with the colours that read on it
 *   Your Mood Board          the five, one row of dots, each with its name under it (its slot's with
 *                            `slots`, else the colour's own); the colour chosen now wears a ring and its code
 *   Recently used            up to five this person last picked HERE, on this event, newest first, never one
 *                            of the five (`lib/colour-picker-recent.ts` — this browser only); not drawn when empty
 *   Custom                   the system wheel + a NAME or a code to type + ✓ Use. A name lists up to six of
 *                            OUR colours under the field as it is typed ("burgund" → Garnet · for burgundy,
 *                            `lib/colour-name-search.ts`); a tap sets one; ✓ Use / Enter set a valid code, else
 *                            the top match (owner 2026-10-16: *"color picker still not working"*)
 *   the caller's quiet row   "Use the default", "Follow Neutral again", "Remove this colour"
 *
 * ONE tap sets that colour and closes; the caller then says what it changed (and the colour joins Recently
 * used). Opening it writes nothing. Custom's code opens on the colour chosen now.
 *
 * The sheet is the new Maker's ONE bottom sheet (`PickSheetContext`, handed down by the shell on a
 * phone); a desktop draws the same body in a small centred panel.
 */
export function ColourPickerSheet({
  title,
  job,
  current,
  onPick,
  onClose,
  extra,
  palette = [],
  onRemove,
  slots = false,
  readsOn,
}: {
  /** "Remove this colour" at the foot (a role's own colour, a part set by hand). */
  onRemove?: () => void;
  /** The Mood Board's five — drawn FIRST. Empty = the row is left out. */
  palette?: readonly string[];
  /** "Dominant", "Table linens", "Bridesmaids". */
  title: string;
  /** What it changes, said under the title ("Headings and big blocks · flowers · lights"). Empty = no line. */
  job: string;
  current: string;
  /** No longer drawn (owner 2026-10-17: "Just have the Moodboard and Recently Used") — accepted so no caller breaks. */
  fromPhotos?: readonly string[];
  onPick: (hex: string) => void;
  onClose: () => void;
  /** The caller's quiet action ("Use the default", "Follow Neutral again"), drawn at the foot. */
  extra?: ReactNode;
  /** `palette` IS the five main colours in slot order: each wears its slot's name (Dominant … Accent 2). Else a colour wears its own name. */
  slots?: boolean;
  /** The ground this colour sits on (words on a background). Draws "Against the background" and leads the rows with what reads on it — reordered, never hidden. */
  readsOn?: string | null;
}) {
  /* Recently used: this signed-in person, this event, this browser. No scope (a page outside an event) → no row. */
  const scope = useLastSeenScope();
  const key = scope ? recentColourKey(scope.userId, scope.eventId) : null;
  const [recent] = useState(() => readRecentColours(browserStorage(), key));
  const pick = (hex: string) => {
    rememberRecentColour(browserStorage(), key, hex);
    onPick(hex);
  };
  return (
    <StudioSheet label={title} onClose={onClose}>
      <ColourPickerBody
        job={job}
        current={current}
        palette={palette}
        recent={recent}
        slots={slots}
        readsOn={readsOn}
        onPick={pick}
        extra={extra}
        onRemove={onRemove}
      />
    </StudioSheet>
  );
}

/**
 * The sheet's body — what `ColourPickerSheet` puts in the Maker's bottom sheet or the centred panel. Pure:
 * the recent colours come in (`recent`), so the one-screen check can draw it with five of each.
 */
export function ColourPickerBody({
  job,
  current,
  palette,
  recent,
  slots,
  readsOn,
  onPick,
  extra,
  onRemove,
}: {
  job: string;
  current: string;
  palette: readonly string[];
  recent: readonly string[];
  slots: boolean;
  readsOn?: string | null;
  onPick: (hex: string) => void;
  extra?: ReactNode;
  onRemove?: () => void;
}) {
  const [code, setCode] = useState(current);
  const suggest = pickerShelves(palette, { names: slots ? MAIN_COLOUR_NAMES : undefined, readsOn, recent });
  const custom = customColourInput(code);
  const typed = custom.code;
  /* The matches open UNDER the field — brought into view as they appear, or a phone shows none of them. */
  const matchList = useRef<HTMLDivElement>(null);
  const matchKey = custom.matches.map((m) => m.hex).join();
  useEffect(() => {
    if (matchKey) matchList.current?.scrollIntoView({ block: 'nearest' });
  }, [matchKey]);
  const now = current.toUpperCase();
  const read = pickerReadsOn(current, readsOn);
  /* One dot of a row: the colour, its name under it, and — on the colour chosen now — a ring and its code.
     The code's line is kept on every dot, so a row never jumps when the choice moves. */
  const dot = (r: PickerRow) => {
    const on = r.hex === now;
    return (
      <button
        key={r.hex}
        type="button"
        aria-label={r.name ? `${r.name} ${r.hex}` : r.hex}
        aria-pressed={on}
        onClick={() => onPick(r.hex)}
        className="sn-press flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-2xl px-0.5 pt-1"
        data-picker-swatch={r.hex}
      >
        <span
          aria-hidden
          className={`h-9 w-9 shrink-0 rounded-full border border-ink/15 ${on ? 'ring-2 ring-sn-accent ring-offset-2 ring-offset-white' : ''}`}
          style={{ background: r.hex }}
        />
        <span className={`w-full truncate text-center text-[11px] leading-tight ${on ? 'font-semibold text-ink' : 'text-ink/70'}`}>{r.name ?? '\u00A0'}</span>
        <small className="font-mono text-[10px] leading-none text-ink/50" data-picker-code={on ? '' : undefined}>
          {on ? r.hex : '\u00A0'}
        </small>
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-3 px-2 pb-2" data-colour-picker="">
      {job ? <p className="-mt-1 text-[12px] text-ink/60">{job}</p> : null}
      {read ? (
        <div className="flex flex-col gap-1">
          <p className={SHELF}>Against the background</p>
          <div className="flex min-h-9 items-center gap-3 px-1" role="status" data-picker-against={read.grade}>
            <span aria-hidden className="h-7 w-7 shrink-0 rounded-full ring-1 ring-inset ring-ink/15" style={{ background: readsOn ?? undefined }} />
            <small className="min-w-0 flex-1 text-[12.5px] text-ink/70">{read.words}</small>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] ${
                read.grade === 'clear' ? 'bg-success-50 text-success-700' : 'bg-terracotta/10 text-terracotta-700'
              }`}
            >
              {read.grade === 'clear' ? 'AA' : 'AA ✗'}
            </span>
          </div>
        </div>
      ) : null}
      {suggest.board.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className={SHELF}>Your Mood Board</p>
          <div className="grid grid-cols-5 gap-1" data-picker-palette="">
            {suggest.board.map(dot)}
          </div>
        </div>
      ) : null}
      {suggest.recent.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className={SHELF}>Recently used</p>
          <div className="grid grid-cols-5 gap-1" data-picker-recent="">
            {suggest.recent.map(dot)}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <p className={SHELF}>Custom</p>
        <div className="flex items-center gap-2" data-picker-custom="">
          {/* 📱 THE WHEEL IS THE INPUT ITSELF — the 44 px tap target, never an invisible input inside a label, so
              iPhone Safari opens its own colour picker on the tap. The ring is the wheel; the dot in it is the colour picked. */}
          <input
            type="color"
            aria-label="Colour wheel"
            value={(typed ?? cleanHexInput(current) ?? '#000000').toLowerCase()}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            data-picker-wheel=""
            className="h-11 w-11 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-2 [&::-moz-color-swatch]:border-white [&::-webkit-color-swatch-wrapper]:p-[9px] [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-2 [&::-webkit-color-swatch]:border-white"
            style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}
          />
          <input
            type="text"
            value={code}
            maxLength={32}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && custom.use) {
                e.preventDefault();
                onPick(custom.use);
              }
            }}
            aria-label="Colour name or code"
            aria-controls="picker-name-matches"
            placeholder="Colour name or code"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            className="min-h-11 min-w-0 flex-1 rounded-full bg-ink/5 px-4 text-[15px] text-ink placeholder:text-ink/40"
          />
          {/* The sheet's ONE main action: the app's main button (the accent), never an ink pill of its own. */}
          <ActionButton tone="brand" main icon={Check} label="Use" disabled={!custom.use} onClick={() => custom.use && onPick(custom.use)} className="!h-11" />
        </div>
      </div>
      {custom.matches.length > 0 ? (
        <div ref={matchList} id="picker-name-matches" className="-mt-1 flex flex-col" aria-label="Colours by that name" data-picker-name-matches="">
          {custom.matches.map((m) => (
            <button
              key={m.hex}
              type="button"
              aria-label={m.typed ? `${m.name}, for ${m.typed}, ${m.hex}` : `${m.name} ${m.hex}`}
              onClick={() => onPick(m.hex)}
              className="sn-press flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left"
              data-picker-name-match={m.hex}
            >
              <span aria-hidden className="h-7 w-7 shrink-0 rounded-full ring-1 ring-inset ring-ink/15" style={{ background: m.hex }} />
              <span className="min-w-0 truncate text-[14px] text-ink">
                {m.name}
                {m.typed ? <span className="text-ink/50"> · for {m.typed}</span> : null}
              </span>
              <small className="ml-auto shrink-0 font-mono text-[11px] text-ink/50">{m.hex}</small>
            </button>
          ))}
        </div>
      ) : !typed && /^[^#\d]{2,}$/.test(code.trim()) ? (
        <p id="picker-name-matches" className="-mt-1 px-3 text-[12px] text-ink/55" role="status" data-picker-name-none="">
          No colour by that name — try another word, or a code like #7A1F2B.
        </p>
      ) : null}
      {extra}
      {onRemove ? (
        <span data-picker-remove="" className="self-start">
          <ActionButton tone="neutral" icon={X} label="Remove this colour" onClick={onRemove} className="!h-11" />
        </span>
      ) : null}
    </div>
  );
}

/** A shelf's heading. */
const SHELF = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55';

/**
 * ▁ Studio's pop-ups — the new Maker's ONE bottom sheet on a phone (the shell's
 * `PickSheetContext`), a small centred panel on a wider screen (`StudioPopup`).
 */
export function StudioSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const sheet = useContext(PickSheetContext);
  const [wide, setWide] = useState<number | null>(null);
  useEffect(() => setWide(window.innerWidth), []);
  if (wide === null) return null;
  if (sheet && pickOpensAsSheet(true, wide)) return <>{sheet({ label, onClose, children })}</>;
  return createPortal(
    <StudioPopup label={label} onClose={onClose}>
      {children}
    </StudioPopup>,
    document.body,
  );
}

/**
 * 🌑 THE SAME POP-UP WHERE THERE IS NO MAKER SHEET (a computer; the Mood Board and the Logo on their own pages) —
 * UNDER THE POP-UP RULE (owner 2026-10-08, `INTERACTION_RULES.md` § 9): the rest of the screen is dark AND blurred
 * (`.sn-popup-dark`, never a wash of this file's own), nothing behind works or scrolls, Escape closes and Tab stays
 * inside (`usePopupBehind`), and a tap on the dark closes it. Held by `lib/every-stages-popup-follows-the-rule.test.ts`.
 */
export function StudioPopup({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  usePopupBehind({ root, panel, onClose });
  return (
    <div ref={root} className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" data-studio-sheet="">
      <button type="button" aria-label="Close" data-studio-sheet-scrim="" onClick={onClose} className={POPUP_SCRIM} />
      <span aria-hidden className={POPUP_DARK} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl bg-white px-2 pb-4 pt-3 shadow-xl ring-1 ring-ink/10 focus:outline-none sm:rounded-3xl"
      >
        <p className="shrink-0 px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">{label}</p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
