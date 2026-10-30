'use client';

/**
 * 🗂 THE SCHEDULE'S ONE POP-UP — every add and every edit on Suppliers › Booked › Schedule opens THIS.
 *
 * Owner 2026-10-31, live iPhone, Suppliers › Booked › Schedule: *"so many design error on schedule. the pop up. design
 * template."* — "+ Add to schedule" opened a boxed card pinned under the top nav, a tap on a time opened a different
 * sheet ("Add at 11:00 PM … Add moment"), and a tapped moment a third panel of its own. The approved final Suppliers
 * design (`carry-2026-10-29/suppliers-final-proto/`, frame 19b) draws ONE: the moment inspector in the house bottom
 * sheet — a title and what it is about on the first line, the fields as boxes with their name above, the choices as
 * ▾ dropdowns, and the two answers in the thumb zone (Delete it · Save).
 *
 *   ScheduleSheet   the house `Sheet` (+ its `OverlayBackdrop`): rises from the bottom, full width on a phone, a drawer
 *                   from the right on a computer — never a box pinned under the top nav.
 *   SheetFoot       the two answers, pinned to the sheet's foot (the thumb zone), equal halves.
 *   ScheduleAddPill "+ Add a moment" / "+ Add a step": the page's one add, in the thumb zone above the bottom nav
 *                   (the prototype's lower-right pill), never a row at the top.
 *
 * 🔑 ONE LOOK, NOT ONE FORM. Adding a moment, editing one and adding a Preparation step keep EVERY field and the SAME
 * server action they had (`../actions.ts`, `../prep-actions.ts`); only the frame and the field look are shared — the
 * look is a rule on the sheet (`SHEET_FIELDS_CSS`), so a field cannot drift from it by being written elsewhere.
 * 🔒 lib/the-schedule-has-one-pop-up.test.ts
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { useThumbRoom } from '@/lib/thumb-room';
import { actionButtonClass } from '@/components/action-button';

/**
 * THE FIELD LOOK, AS A RULE ON THE SHEET (frame 19b): a text box is a white rounded box with a hairline, its name above
 * it; a switch is a tinted band. Written as one rule so the three forms cannot each draw their own. The box is the
 * raised ground (`--color-raised`: white by day, the approved #232019 card in dark), so dark mode needs no rule of its own.
 */
const SHEET_FIELDS_CSS =
  '[data-schedule-sheet] :is(input[type=text],input[type=date],input[type=number],input:not([type]),textarea){' +
  'display:block;width:100%;border:1px solid rgb(var(--color-ink)/.12);border-radius:var(--m-r-md);background:rgb(var(--color-raised));' +
  'padding:11px 14px;font-size:15px;line-height:1.35;color:rgb(var(--color-ink));outline:none}' +
  '[data-schedule-sheet] :is(input,textarea):focus{border-color:rgb(var(--color-ink)/.45)}' +
  '[data-schedule-sheet] :is(input,textarea)[readonly]{background:transparent;border-color:transparent;padding-left:0}' +
  '[data-schedule-sheet] [data-sheet-field]>span:first-child{display:block;margin-bottom:6px;font-size:12.5px;font-weight:500;color:rgb(var(--color-ink)/.62)}' +
  '[data-schedule-sheet] [data-switch-band]{border-radius:var(--m-r-md);background:rgb(var(--color-ink)/.05);padding:2px 14px}' +
  // A form that draws its own answers (a tapped moment's — they change with Delete's ask) still puts them at the foot,
  // edge to edge, as the sheet's own `foot` stands.
  '[data-sheet-body] [data-sheet-foot]{margin:1rem -1.25rem -1rem}' +
  // A tapped moment's own names (`Eyebrow`) read as the field names above every other box here.
  '[data-schedule-sheet] [data-eyebrow]{display:block;margin-bottom:6px;font-size:12.5px;font-weight:500;letter-spacing:0;text-transform:none;color:rgb(var(--color-ink)/.62)}';

/** A field: its name above it, then the box (or the dropdown) — the 19b row. */
export function SheetField({ label, aside, children }: { label: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <label className="block" data-sheet-field="">
      <span className="flex items-center gap-1.5">
        {label}
        {aside}
      </span>
      {children}
    </label>
  );
}

/** A labelled choice drawn as a band: the name on the left, its ▾ on the right (19b's Phase · For rows). */
export function SheetChoice({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-[var(--m-r-md)] bg-ink/[0.05] px-3.5" data-sheet-choice="">
      <span className="text-[15px] font-medium text-ink">{label}</span>
      {children}
    </div>
  );
}

export function ScheduleSheet({
  open,
  onClose,
  id,
  title,
  aside,
  data,
  children,
  foot,
}: {
  open: boolean;
  onClose: () => void;
  /** The heading's id (the dialog is labelled by it). */
  id: string;
  /** "Moment" · "Add a moment" · "Add a step". */
  title: ReactNode;
  /** What it is about, quiet, on the title's line ("Ingress & setup" · "Fri 18 Dec"). */
  aside?: ReactNode;
  /** A walk/guard mark — `data-schedule-sheet="<data>"`. */
  data: string;
  children: ReactNode;
  /** The two answers (`SheetFoot`), in the thumb zone — or null when the form draws its own (a tapped moment). */
  foot: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} labelledById={id} wide rise>
      <style>{SHEET_FIELDS_CSS}</style>
      <div data-schedule-sheet={data} className="flex min-h-full flex-col">
        <div className="flex min-h-12 items-center gap-3 px-5 pr-16 pt-3">
          <h2 id={id} className="shrink-0 whitespace-nowrap text-[17px] font-semibold leading-tight text-ink">
            {title}
          </h2>
          {aside ? <span className="ml-auto min-w-0 truncate text-[13px] text-ink/55">{aside}</span> : null}
        </div>
        <div className="flex-1 space-y-3.5 px-5 pb-4 pt-2" data-sheet-body="">
          {children}
        </div>
        {foot}
      </div>
    </Sheet>
  );
}

/** The sheet's two answers, pinned to its foot: equal halves, the quiet one left, the main one right (19b). */
export function SheetFoot({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-2.5 border-t border-ink/10 bg-cream px-5 py-3 [&>*]:w-full [&>*]:justify-center" data-sheet-foot="">
      {children}
    </div>
  );
}

/**
 * The view on screen under Booked › Schedule (`booked-schedule-frame.tsx`) — every view is drawn and kept, so a pill
 * drawn into <body> by a view that is not on screen must step aside. Null: no frame (the pill shows).
 */
export const ScheduleViewOnScreen = createContext<string | null>(null);

/**
 * ＋ THE PAGE'S ONE ADD, IN THE THUMB ZONE (frame 19 / 20: the lower-right pill above the bottom nav). Drawn into
 * <body> so no scroll box clips it; it publishes the room it covers (`useThumbRoom`) so the last row can always scroll
 * above it. Hidden while `hidden` (a view kept mounted but not on screen).
 */
export function ScheduleAddPill({
  label,
  onPress,
  data,
  hidden = false,
  view,
}: {
  label: string;
  onPress: () => void;
  data: string;
  hidden?: boolean;
  /** The view this pill belongs to — it shows only while that view is on screen. */
  view?: string;
}) {
  const onScreen = useContext(ScheduleViewOnScreen);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  const rowRef = useRef<HTMLDivElement>(null);
  useThumbRoom(rowRef);
  if (!host || hidden || (view && onScreen !== null && onScreen !== view)) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sn-ride-h,var(--sn-bottomdock-h,64px))_+_12px)] z-30 flex justify-end tab:bottom-6 tab:right-[var(--sup-col-right,1.5rem)] tab:left-auto"
      data-schedule-add-host=""
      data-safe-x=""
    >
      <div ref={rowRef} className="pointer-events-auto mx-4">
        {/* BUTTON-RULE — the house brand pill, icon + word. */}
        <button
          type="button"
          onClick={onPress}
          data-schedule-add={data}
          className={actionButtonClass('brand', { main: true, extra: 'shadow-[0_10px_28px_-12px_rgba(30,26,18,.55)]' })}
        >
          <Plus aria-hidden strokeWidth={2.2} />
          {label}
        </button>
      </div>
    </div>,
    host,
  );
}

