'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronRight, Download, Palette, Settings } from 'lucide-react';
import { pickArrowClass, pickButtonClass } from '../../website/editor/_components/pick-menu-place';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FORM_PICK_CLASS, FormRow, FormRows, usePillWidth } from '@/app/_components/form-row';
import { useModalA11y } from '@/lib/use-modal-a11y';
import {
  GUEST_TOKEN,
  GUEST_WORD_TOKEN,
  PRINT_SETTINGS_LABEL,
  PRINT_SETTINGS_LINE,
  guestFileWord,
  type PrintGuest,
} from '@/lib/studio-prints-settings';
import { PrintSaveButton } from './print-save-button';
import { StudioProDoor } from './studio-prints-six';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { HUB_LOOK_PRO_NOTE, HUB_LOOK_ROW } from '@/lib/studio-prints-six';
import { PrintPaperHead, type PrintSheetParts, type StudioPaper } from './print-paper';
import { PrintChoicePicker } from './print-choice-picker';
import { useDownloads, usePrintGuest, useRegisterDownload, type AllInOneF } from './prints-view-store';
export type { AllInOneF } from './prints-view-store';

/**
 * 🖨 STUDIO › PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS, ALL GUESTS ◆, EVERYTHING ◆
 * (owner 2026-10-17, *"ok on prints"*; DECISION_LOG row of that date; prototype `prints_settings_and_downloads_2026-10-17.html`).
 *
 *   · `StudioPrintSettings` — the ⚙ row at the head of Prints and the ONE sheet it opens. The sheet holds every switch and field that
 *     sat inside a piece row, under the prototype's headings, with the one Save at its foot. 🔒 THE FIELDS NEVER UNMOUNT: the sheet is
 *     hidden while shut, never removed — every switch joins the print words form by `form=`, and a field that is not in the page is
 *     a field a Save does not send (`studio-prints-posts-the-same.test.ts`).
 *   · `StudioPieceDownload` — a piece's ONE Download (free), the file it always saved.
 *   · `StudioGuestPiece` — a guest print's row: its picture for the guest picked, View as ▾ (ONE pick shared by every guest print —
 *     `usePrintGuest`), Download for that guest (free) and All guests ◆ (the all-in-one file: Event Hub Pro).
 *   · `StudioPrintsDownloadSheet` — the piece bar's ⬇: "This piece" and "Everything ◆", the same files the rows save (`useDownloads`).
 *
 * Loaded through the one lazy door (`StudioTool`), never in the Maker's first load.
 */

/* ── the ◆ file: owned, the file; a free couple, the door that opens the centred note; the store shell, nothing ───────────── */

export function AllInOneButton({ f, label, main = false }: { f: AllInOneF; label?: string; main?: boolean }) {
  if (f === null) return null;
  if (f.kind === 'save') return <PrintSaveButton href={f.href} file={f.file} variant="action" main={main} icon={f.icon} label={label ?? f.label} />;
  return (
    <span data-print-all-in-one-pro="" className="inline-flex">
      <StudioProDoor href={f.href} label={label ?? f.label} icon={f.icon} note={f.note} />
    </span>
  );
}

/* ── ⚙ PRINT SETTINGS ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

export type PrintSettingsSection = { key: string; title: string; line?: string; body: ReactNode };

/** The prototype's group heading (`.gh`) — small capitals on the warm page, its line at the right. */
function SettingsHead({ title, line }: { title: string; line?: string }) {
  return (
    <p className="flex items-baseline gap-2 border-b border-ink/10 bg-[color-mix(in_srgb,rgb(var(--color-gild))_9%,rgb(var(--color-cream)))] px-[22px] pb-2 pt-[18px] text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/55">
      {title}
      {line ? <small className="ml-auto text-[11px] font-medium normal-case tracking-normal text-ink/50">{line}</small> : null}
    </p>
  );
}

export function StudioPrintSettings({ sections, save }: { sections: readonly PrintSettingsSection[]; save: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const headId = useId();
  useEffect(() => setBody(document.body), []);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: sheet });
  const panel = (
    <div data-print-settings-layer="" hidden={!open} className={open ? 'fixed inset-0 z-[86]' : 'hidden'}>
      <button type="button" aria-label="Close print settings" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/35" />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        data-print-settings-sheet=""
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-[color-mix(in_srgb,rgb(var(--color-gild))_9%,rgb(var(--color-cream)))] shadow-[0_-18px_40px_-18px_rgba(30,26,18,.45)] lg:inset-x-auto lg:left-1/2 lg:w-[30rem] lg:-translate-x-1/2"
      >
        <div aria-hidden className="flex justify-center pt-2.5">
          <i className="h-1 w-10 rounded-full bg-ink/20" />
        </div>
        <div className="flex items-center justify-between px-[22px] pb-1 pt-2">
          <h2 id={headId} className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink/55">
            {PRINT_SETTINGS_LABEL}
          </h2>
          <button type="button" data-print-settings-done="" onClick={() => setOpen(false)} className="sn-press min-h-11 px-1 text-[15px] font-semibold text-sn-accent">
            Done
          </button>
        </div>
        <div data-print-settings-body="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {sections.map((s) => (
            <section key={s.key} data-print-settings-section={s.key} aria-label={s.title}>
              <SettingsHead title={s.title} line={s.line} />
              <div className="bg-cream px-4 [&_[data-studio-print-rows]+[data-studio-print-rows]]:border-t [&_[data-studio-print-rows]+[data-studio-print-rows]]:border-ink/10">{s.body}</div>
            </section>
          ))}
        </div>
        <div data-print-settings-foot="" className="border-t border-ink/10 bg-cream px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5">
          {save}
        </div>
      </div>
    </div>
  );
  return (
    <>
      <button
        type="button"
        data-print-settings-open=""
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="sn-press flex w-full items-center gap-3 py-3 text-left"
      >
        <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold text-ink">{PRINT_SETTINGS_LABEL}</b>
          <span className="block text-[12.5px] leading-snug text-ink/60">{PRINT_SETTINGS_LINE}</span>
        </span>
        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-ink/50" strokeWidth={1.75} />
      </button>
      {/* 🔒 Drawn on <body> (a transformed panel would capture `fixed`) — and ALWAYS drawn, shut or open: its fields post with Save. */}
      {body ? createPortal(panel, body) : panel}
    </>
  );
}

/* ── 🎨 YOUR EVENT HUB LOOK — ◆ owned, ◆ PRO the door ──────────────────────────────────────────────────────────────────────── */

/**
 * EVERY PRINT WEARS THE EVENT HUB LOOK — WITH EVENT HUB PRO (owner 2026-10-21, *"yes wire all, and yes it's Pro"*). One row under
 * Print settings, saying which look the pieces below are drawn in — the route draws them so (`printLookForEvent`), this only says it.
 * The prints' own Pro pattern (`allInOneFile`, `makerProMark` — the ticket zip's): never a padlock on the Event Hub (owner
 * 2026-09-29, *"◆ marks Pro and never blocks; there are no padlocks"* — `nothing-locks-before-apply.test.ts`):
 *   · owned → the diamond and the fact (no frame: nothing to press);
 *   · a free event on the web → ◆ PRO and the door to the centred note (`StudioProDoor`, the prints' own Pro door);
 *   · the app-store shell without it → nothing (a Pro hint there is a purchase hint).
 * `ownsPro` is the EVENT's measured entitlement (an unlock belongs to the event, every host on it).
 */
export function StudioHubLookRow({ eventId, ownsPro, storeShell }: { eventId: string; ownsPro: boolean; storeShell: boolean }) {
  const state = makerProMark({ owns: ownsPro, storeShell });
  if (state === null) return null;
  const owned = state === 'unlocked';
  return (
    <div data-print-hub-look={owned ? 'worn' : 'classic'} className="flex min-h-14 items-center gap-3 border-t border-ink/10 py-3">
      <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
        <Palette className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          {HUB_LOOK_ROW.name}
          {/* Owned: the diamond. In the app-store shell nothing names a paid web extra — not even an owned one's label. */}
          {owned ? <PaidMark state="unlocked" size="sm" label={paidMarkLabel('unlocked', storeShell ? HUB_LOOK_ROW.name : 'Event Hub Pro')} /> : null}
        </b>
        <span className="block text-[12.5px] leading-snug text-ink/60">{owned ? HUB_LOOK_ROW.owned : HUB_LOOK_ROW.free}</span>
      </span>
      {owned || storeShell ? null : (
        <span className="shrink-0" data-print-hub-look-door="">
          <StudioProDoor
            href={`/dashboard/${eventId}/studio/website-pro`}
            label={HUB_LOOK_ROW.door}
            icon={<PaidMark state="try" label={paidMarkLabel('try', 'Event Hub Pro')} />}
            note={HUB_LOOK_PRO_NOTE}
          />
        </span>
      )}
    </div>
  );
}

/* ── A PIECE'S ONE DOWNLOAD ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export function StudioPieceDownload({
  item,
  name,
  href,
  file,
  label = 'Download',
  extra = null,
}: {
  item: string;
  /** The piece's name — the ⬇ sheet's "This piece" line. */
  name: string;
  href: string;
  file: string;
  label?: string;
  /** A second press on the row that is not a file (the Menu's "Edit menu"). */
  extra?: ReactNode;
}) {
  useRegisterDownload(item, { name, one: { href, file, label: 'Download' } });
  return (
    <div className="flex flex-wrap gap-1.5 pb-2" data-print-piece-saves={item} data-print-download={item}>
      <PrintSaveButton href={href} file={file} variant="action" main label={label} icon={<Download aria-hidden strokeWidth={1.9} />} />
      {extra}
    </div>
  );
}

/** The Menu's "Edit menu": the shipped editor, opened in place under the row (it saves as you go). */
export function StudioEditInPlace({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionButton tone="neutral" label={label} icon={ChevronRight} onClick={() => setOpen((o) => !o)} />
      <div hidden={!open} data-print-edit-in-place="" className={open ? 'basis-full pt-1' : 'hidden'}>
        {children}
      </div>
    </>
  );
}

/* ── A PRINT WITH TWO FILES: ONE DROPDOWN + ONE DOWNLOAD ──────────────────────────────────────────────────────────────────── */

/**
 * The 2D seat plan's "Colours ▾" (In your colours · Blueprint) and the caterer's "File ▾" (PDF · Spreadsheet): two files that were two
 * Saves become the house dropdown in the row's head and ONE Download for the file picked (owner 2026-10-17, prototype `PICKS`).
 */
export function StudioFileChoice({
  item,
  name,
  line,
  paper,
  label,
  choices,
}: {
  item: string;
  name: string;
  line: string;
  paper: StudioPaper;
  label: string;
  choices: ReadonlyArray<{ key: string; label: string; href: string; file: string }>;
}) {
  const [pick, setPick] = useState(choices[0]!.key);
  const chosen = choices.find((c) => c.key === pick) ?? choices[0]!;
  const row = (
    <FormRows data="print-head" width="short" attrs={{ 'data-studio-print-rows': '' }}>
      <ChosenRow name={name} line={line} label={label} value={chosen.key} options={choices.map((c) => ({ key: c.key, label: c.label }))} onPick={setPick} dataAttr="data-print-file-choice" data={`file-choice-${item}`} />
    </FormRows>
  );
  const download = <PrintSaveButton href={chosen.href} file={chosen.file} variant="action" main label="Download" icon={<Download aria-hidden strokeWidth={1.9} />} />;
  return (
    <div data-print-file-choice-row={item} data-print-studio="" className="flex flex-col gap-1">
      <PrintPaperHead paper={paper} row={row} sheet={{ actions: download }} />
      <StudioPieceDownload item={item} name={name} href={chosen.href} file={chosen.file} />
    </div>
  );
}

/* ── A GUEST PRINT ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */

const swap = (s: string, g: PrintGuest) => s.split(GUEST_TOKEN).join(encodeURIComponent(g.id)).split(GUEST_WORD_TOKEN).join(guestFileWord(g.name));

export function StudioGuestPiece({
  eventId,
  item,
  name,
  line,
  picker = null,
  paper,
  guestPicture = false,
  guests,
  one,
  all,
  holds,
  none,
  changed = null,
}: {
  eventId: string;
  item: string;
  name: string;
  line: string;
  picker?: { label: string; value: string; dataAttr?: string; options: Array<{ key: string; label: string; href: string }> } | null;
  /** The row's picture — its `src` may carry `GUEST_TOKEN` when `guestPicture` (the picture is the guest's own). */
  paper: StudioPaper;
  guestPicture?: boolean;
  /** Who has a pass, in the printed passes' order (`loadPassGuestNames`); null: could not be read. */
  guests: readonly PrintGuest[] | null;
  /** The one guest's file — `GUEST_TOKEN` / `GUEST_WORD_TOKEN` stand where the guest goes. */
  one: { href: string; file: string };
  /** Every guest's file — ◆ Event Hub Pro (`allInOneFile`). */
  all: AllInOneF;
  /** What the all-guests file holds, said under both (already worded — its numbers through `formatCount`). */
  holds: string;
  /** Said in place when nobody has a pass yet. */
  none: string;
  changed?: ReactNode;
}) {
  const list = guests ?? [];
  const [picked, setPicked] = usePrintGuest(eventId, list[0]?.id ?? null);
  const guest = list.find((g) => g.id === picked) ?? list[0] ?? null;
  const oneFile = guest ? { href: swap(one.href, guest), file: swap(one.file, guest), label: 'Download' } : null;
  useRegisterDownload(item, { name, line: guest?.name, one: oneFile, all });
  const shown: StudioPaper = guest && guestPicture ? { ...paper, src: swap(paper.src, guest) } : { ...paper, src: paper.src.split(`&pass_guest=${GUEST_TOKEN}`).join('').split(GUEST_TOKEN).join('') };
  const actions = (
    <>
      {oneFile ? <PrintSaveButton href={oneFile.href} file={oneFile.file} variant="action" main label="Download" icon={<Download aria-hidden strokeWidth={1.9} />} /> : null}
      <AllInOneButton f={all} label="All guests" />
    </>
  );
  const sheet: PrintSheetParts = { actions, changed };
  const row = picker ? (
    <PrintChoicePicker {...picker} row={{ name, line }} />
  ) : (
    <FormRows data="print-head" attrs={{ 'data-studio-print-rows': '' }}>
      <FormRow name={name} line={line} />
    </FormRows>
  );
  return (
    <div data-print-guest-piece={item} data-print-studio="" className="flex flex-col gap-1">
      <PrintPaperHead paper={shown} row={row} sheet={{ ...sheet, size: picker ? <PrintChoicePicker {...picker} row={{ name: 'Paper size' }} /> : null }} />
      <FormRows data="view-as" attrs={{ 'data-studio-print-rows': '' }}>
        {guests === null ? (
          <FormRow name="View as" data="view-as" below={<p className="pb-3 text-[12.5px] text-ink/60">Your guest list could not be read just now — reopen Prints in a moment.</p>} />
        ) : guest ? (
          <ViewAsRow item={item} guests={list} guest={guest} onPick={setPicked} />
        ) : (
          <FormRow name="View as" data="view-as" below={<p data-print-view-as-none="" className="pb-3 text-[12.5px] text-ink/60">{none}</p>} />
        )}
      </FormRows>
      <div className="flex flex-wrap gap-1.5 pt-0.5" data-print-piece-saves={item} data-print-download={item}>
        {actions}
      </div>
      <p data-print-guest-count={item} className="px-1 pb-2.5 text-[12px] text-ink/60">
        {holds}
      </p>
      {changed}
    </div>
  );
}

/**
 * 👤 View as ▾ — the Form row's pill (the house dropdown's look), opening the guest sheet: "Search guests" over the groups
 * (`print-guest-sheet.tsx`, loaded the first time it is pressed — its own lazy piece; `PickMenu` never grows).
 */
const GuestPickSheet = dynamic(() => import(/* webpackChunkName: "prints-guest-sheet" */ './print-guest-sheet').then((m) => m.GuestPickSheet), { ssr: false });
function ViewAsRow({ item, guests, guest, onPick }: { item: string; guests: readonly PrintGuest[]; guest: PrintGuest; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const width = usePillWidth();
  return (
    <FormRow name="View as" data="view-as" attrs={{ 'data-print-view-as-row': item, 'data-form-row-kind': 'chosen' }}>
      <button
        type="button"
        aria-label={`View as — which guest: ${guest.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-print-view-as=""
        onClick={() => setOpen(true)}
        className={`${pickButtonClass(false)} ${FORM_PICK_CLASS} ${width}`}
      >
        <span className="min-w-0 truncate">{guest.name}</span>
        <ChevronDown aria-hidden className={pickArrowClass(open)} strokeWidth={2} />
      </button>
      {open ? <GuestPickSheet guests={guests} value={guest.id} onPick={onPick} onClose={() => setOpen(false)} /> : null}
    </FormRow>
  );
}

/* ── EVERYTHING ◆ ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export function StudioEverything({ line, holds, all }: { line: string; holds?: string | null; all: AllInOneF }) {
  useRegisterDownload('download', { name: 'Everything', line: holds ?? undefined, one: null, all });
  return (
    <div data-print-everything="" data-print-studio="" className="flex flex-col gap-2 py-2">
      <p className="text-[14px] leading-snug text-ink/70">{line}</p>
      <div className="flex flex-wrap gap-1.5" data-print-piece-saves="download">
        <AllInOneButton f={all} main />
      </div>
      {holds ? <p className="text-[12px] text-ink/60">{holds}</p> : null}
    </div>
  );
}

/* ── THE PIECE BAR'S ⬇ SHEET ────────────────────────────────────────────────────────────────────────────────────────────────── */

export function StudioPrintsDownloadSheet({ item, onClose }: { item: string | null; onClose: () => void }) {
  const all = useDownloads();
  const here = item && item !== 'download' ? (all.get(item) ?? null) : null;
  const every = all.get('download') ?? null;
  const box = useRef<HTMLDivElement>(null);
  const headId = useId();
  useModalA11y({ open: true, onClose, containerRef: box });
  const node = (
    <div data-prints-download-layer="" className="fixed inset-0 z-[86]">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/35" />
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={headId} data-prints-download-sheet="" className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-cream px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-18px_40px_-18px_rgba(30,26,18,.45)] lg:inset-x-auto lg:left-1/2 lg:w-[26rem] lg:-translate-x-1/2">
        <div aria-hidden className="flex justify-center pt-2.5">
          <i className="h-1 w-10 rounded-full bg-ink/20" />
        </div>
        <h2 id={headId} className="px-1.5 pb-2 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink/55">
          Download
        </h2>
        <FormRows data="download-sheet">
          {here ? (
            <FormRow name="This piece" line={[here.name, here.line].filter(Boolean).join(' · ')} data="download-this">
              {here.one ? (
                <PrintSaveButton href={here.one.href} file={here.one.file} variant="action" main label="Download" icon={<Download aria-hidden strokeWidth={1.9} />} />
              ) : here.all ? (
                <AllInOneButton f={here.all} label="Download" main />
              ) : null}
            </FormRow>
          ) : null}
          {every?.all ? (
            <FormRow name="Everything" line={every.line} data="download-everything">
              <AllInOneButton f={every.all} label="Download" main={!here} />
            </FormRow>
          ) : null}
        </FormRows>
      </div>
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(node, document.body);
}
