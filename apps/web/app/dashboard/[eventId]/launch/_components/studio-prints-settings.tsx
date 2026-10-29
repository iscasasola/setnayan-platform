'use client';
import { ProQuietLine } from './pro-quiet-line';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Palette } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { onMakerSave } from '@/lib/maker-save-status';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { PRINT_SETTINGS_LABEL, PRINT_SETTINGS_SAVED, type PrintGuest } from '@/lib/studio-prints-settings';
import type { PickNoun } from '@/lib/print-picked-guests';
import { StudioProDoor } from './studio-prints-six';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { HUB_LOOK_PRO_NOTE, HUB_LOOK_ROW } from '@/lib/studio-hub-look-row';
import type { StudioPaper } from './print-paper';
import { setPrintSettingsOpen, usePrintSettingsOpen, useRegisterSlide, type AllInOneF, type SlideTicketStyle } from './prints-view-store';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
export type { AllInOneF } from './prints-view-store';

/**
 * 🖨 STUDIO › PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS, ALL GUESTS, EVERYTHING ◆
 * (owner 2026-10-17, *"ok on prints"*; DECISION_LOG row of that date; prototype `prints_settings_and_downloads_2026-10-17.html`) —
 * drawn as ONE PRINT PER SLIDE since 2026-10-26 (owner: *"So we can make like a swipe carousel type where they can see the preview
 * larger then under is the toolbar to pick style? and download options?"*; DECISION_LOG "APPROVED — PRINTS IS A SWIPE CAROUSEL";
 * prototype `prints_carousel_2026-10-26`).
 *
 *   · `StudioPrintSettings` — the ONE sheet ⚙ opens, from every slide (`setPrintSettingsOpen`). Its first row is "Your Event Hub
 *     look ◆" (`lead`) — a setting of every print, not a print. NO Save since 2026-10-21: every press posts.
 *     🔒 THE FIELDS NEVER UNMOUNT: the sheet is hidden while shut, never removed — every switch joins the print words form by `form=`,
 *     and a field that is not in the page is a field a post does not send (`studio-prints-posts-the-same.test.ts`).
 *   · `StudioPieceDownload` · `StudioFileChoice` · `StudioGuestPiece` · `StudioEverything` — each REGISTERS its print's slide
 *     (`useRegisterSlide`); `studio-prints-carousel.tsx` draws it. They draw nothing themselves.
 *
 * Loaded through the one lazy door (`StudioTool`), never in the Maker's first load.
 */

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

/**
 * ✓ ONE WAY TO SAVE (owner 2026-10-21, on this sheet's ✓ Save: *"why is there a save here? when any press changes it right away?"*).
 * Measured before: nothing in the sheet posted until Save — a press then Done lost the press, under "Guests see this right away". Now
 * there is no Save and no such line: every switch, dropdown and typed line posts the print words form as it is pressed (`SoftPost
 * autosave`, `lib/print-words-autosave.ts`), and the sheet says so the house way — the toast that peeks from the top (`PeekToast`):
 * "Saved." on the form's answer, its plain refusal with Try again (the form posted again) otherwise. The ticket style keeps its own
 * honest line ("waits for Apply" — it is drafted, owner 2026-10-02 Q7); the special message and the thank-you keep their drafted saves.
 */
export function StudioPrintSettings({ sections, form, lead = null }: { sections: readonly PrintSettingsSection[]; form: string; lead?: ReactNode }) {
  /* ⚙ Opened from every slide's toolbar (`setPrintSettingsOpen`) — the row that opened it is gone with the list. */
  const open = usePrintSettingsOpen();
  const setOpen = setPrintSettingsOpen;
  const [said, setSaid] = useState<{ n: number; tone: 'ok' | 'bad'; text: string } | null>(null);
  /* The form's answer, while the sheet is open — "Saving…" says nothing (the press already shows), an answer peeks. */
  useEffect(() => {
    if (!open) return;
    return onMakerSave((s) => {
      if (s.state === 'saved') setSaid((p) => ({ n: (p?.n ?? 0) + 1, tone: 'ok', text: PRINT_SETTINGS_SAVED }));
      else if (s.state === 'error') setSaid((p) => ({ n: (p?.n ?? 0) + 1, tone: 'bad', text: s.text }));
    });
  }, [open]);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const headId = useId();
  useEffect(() => setBody(document.body), []);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: sheet });
  const panel = (
    <div data-print-settings-layer="" hidden={!open} className={open ? 'fixed inset-0 z-[86]' : 'hidden'}>
      <OverlayBackdrop onClose={() => setOpen(false)} label="Close print settings" tabIndex={-1} />
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
        <div data-print-settings-body="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {/* 🎨 Your Event Hub look ◆ — the sheet's first row (prototype `prints_carousel_2026-10-26`): it is a setting of every print. */}
          {lead ? <div data-print-settings-lead="" className="border-b border-ink/10 bg-cream px-4 [&_[data-print-hub-look]]:border-t-0">{lead}</div> : null}
          {sections.map((s) => (
            <section key={s.key} data-print-settings-section={s.key} aria-label={s.title}>
              <SettingsHead title={s.title} line={s.line} />
              <div className="bg-cream px-4 [&_[data-studio-print-rows]+[data-studio-print-rows]]:border-t [&_[data-studio-print-rows]+[data-studio-print-rows]]:border-ink/10">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
      {said && open ? (
        <PeekToast
          key={said.n}
          tone={said.tone}
          data="print-settings"
          onGone={() => setSaid(null)}
          onRetry={said.tone === 'bad' ? () => (document.getElementById(form) as HTMLFormElement | null)?.requestSubmit() : undefined}
        >
          {said.text}
        </PeekToast>
      ) : null}
    </div>
  );
  return (
    <>
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
    <>
    {/* 💎 The quiet line (owner 2026-10-22) — prints in your Hub look are the Prints part's. */}
    {owned || storeShell ? null : <ProQuietLine part="prints" />}
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
    </>
  );
}

/* ── A PIECE'S ONE DOWNLOAD ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A plain print's ONE Download (free) — the file it always saved — registered as its slide's Download (`useRegisterSlide`). No file
 * (no menu yet): the slide's Download is withheld and its empty line opens `edit`. `edit` — content a print needs that is not a
 * setting (the Menu's dishes): its shipped editor, opened from the ⓘ and from the slide's empty line (prototype: "Edit menu" did not
 * fit the two rows as a pill).
 */
export function StudioPieceDownload({
  item,
  name,
  href = null,
  file = null,
  label = 'Download',
  edit = null,
}: {
  item: string;
  name: string;
  href?: string | null;
  file?: string | null;
  label?: string;
  edit?: { label: string; body: ReactNode } | null;
}) {
  useRegisterSlide(item, 'download', { name, download: href && file ? { href, file, label } : null, edit });
  return null;
}

/* ── A PRINT WITH TWO FILES: ONE DROPDOWN + ONE DOWNLOAD ──────────────────────────────────────────────────────────────────── */

/**
 * The 2D seat plan's "Colours ▾" (In your colours · Blueprint) and the caterer's "File ▾" (PDF · Spreadsheet): two files, the house
 * dropdown in the slide's toolbar and ONE Download for the file picked (owner 2026-10-17, prototype `PICKS`).
 */
export function StudioFileChoice({
  item,
  name,
  line,
  paper,
  label,
  choices,
  tip,
}: {
  item: string;
  name: string;
  line: string;
  paper: StudioPaper;
  label: string;
  choices: ReadonlyArray<{ key: string; label: string; href: string; file: string }>;
  tip?: string;
}) {
  useRegisterSlide(item, 'file-choice', { name, line, paper, choice: { label, options: choices }, tip });
  return null;
}

/* ── A GUEST PRINT ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * A guest print's slide: its picture for the guest picked (View as ▾ — ONE pick shared by every guest print, `usePrintGuest`), and
 * Download ▾ → This one (free) · All guests · Pick guests… (the shared sheet, `GuestManySheet`) — the same files and routes the row
 * always saved. 🎟 PICK GUESTS (owner 2026-10-25; every guest print 2026-10-26, *"this should apply to all guest related prints"*):
 * given by every guest print whose all-guests file the route narrows (`guests=`), offered only where All guests itself saves.
 */
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
  pickNoun = null,
  printed,
  tip,
  ticketStyle,
}: {
  eventId: string;
  item: string;
  name: string;
  line: string;
  picker?: { label: string; value: string; dataAttr?: string; options: Array<{ key: string; label: string; href: string }> } | null;
  /** The slide's picture — its `src` may carry `GUEST_TOKEN` when `guestPicture` (the picture is the guest's own). */
  paper: StudioPaper;
  guestPicture?: boolean;
  /** Who this file holds, in its own order; null: could not be read. */
  guests: readonly PrintGuest[] | null;
  /** The one guest's file — `GUEST_TOKEN` / `GUEST_WORD_TOKEN` stand where the guest goes. */
  one: { href: string; file: string };
  /** Every guest's file — free, or the ◆ door (`allInOneFile`). */
  all: AllInOneF;
  /** What the all-guests file holds (already worded — its numbers through `formatCount`). */
  holds: string;
  /** Said in place when nobody is on this file yet. */
  none: string;
  changed?: ReactNode;
  pickNoun?: PickNoun | null;
  printed?: { eventId: string; piece: string; version: string | null };
  tip?: string;
  /** 🎫 The Digital ticket's three looks (Classic · Ticket · Photo poster) — its slide's Style ▾ (owner 2026-10-26). */
  ticketStyle?: SlideTicketStyle;
}) {
  useRegisterSlide(item, 'guest-piece', {
    printed,
    ...(ticketStyle ? { ticketStyle } : {}),
    name,
    line,
    paper,
    size: picker,
    changed,
    tip,
    guest: { eventId, guests, guestPicture, one, all, holds, none, pickNoun },
  });
  return null;
}

/* ── EVERYTHING ◆ ───────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export function StudioEverything({ line, holds, all }: { line: string; holds?: string | null; all: AllInOneF }) {
  useRegisterSlide('download', 'everything', { name: 'Everything', everything: { line, holds: holds ?? null, all } });
  return null;
}
