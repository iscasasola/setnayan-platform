'use client';

import { CHAT_ATTACH_INPUT_ID, CHAT_CAMERA_INPUT_ID, CHAT_PHOTO_INPUT_ID } from '@/lib/chat-attach-input-id';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  Camera,
  ImageIcon,
  CalendarPlus,
  ChevronRight,
  Handshake,
  Plus,
  Star,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { revealThreadTool } from '@/app/_components/chat/reveal-thread-tool';
import {
  THREAD_TOOL_GROUPS,
  type ThreadToolGroup,
  type VendorThreadLinkTool,
  type VendorThreadToolIcon,
  type VendorThreadToolsState,
} from '@/lib/vendor-thread-tools';
import { VENDOR_THREAD_TOOLS } from '@/lib/vendor-thread-tools';
import { coupleThreadTools } from '@/lib/chat-box-tools';
import { NEGOTIATE_GROUP, PLUS_ROW_PAGE, hostPlusRows, plusGate, sheetSlashRows, supplierPlusRows, type PlusGroup, type PlusRow } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
import { TOPIC_ICON } from '@/lib/topic-icons';
import { PLUS_CARD_TITLE, PLUS_CARD_TOPIC } from '@/lib/chat-plus';
import { pickedPageLabel } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';

/**
 * THE ＋ BESIDE THE MESSAGE FIELD — and the ONE sheet of every tool the conversation has (simpler supplier dashboard,
 * step 4, 2026-10-14; prototype `supplier_easy_dashboard_2026-10-14_fable.html` · composer `data-sheet="tools"` and
 * `SHEETS.tools`).
 *
 * ── WHAT IT REPLACES ────────────────────────────────────────────────────────────────────────────────────────────────
 * The conversation's tools had two scattered doors: the customer rail's "Tools" column (a desktop column + a mobile
 * "Tools" sheet) and the composer's 🧾 / 📞 icons. Owner on the completeness pass: "how tools gets accessed on chat?"
 * → one obvious door. This is it: a GREY ＋ (Send stays the one main), a sheet listing every row of
 * `VENDOR_THREAD_TOOLS`, each opening the SAME panel or page as before, which posts the SAME server action.
 *
 * ── HOW A ROW OPENS ─────────────────────────────────────────────────────────────────────────────────────────────────
 *   reveal  close the sheet, THEN open the panel in the frame's tray (`revealThreadTool`) — a panel opened behind a
 *           sheet the supplier is still looking at reads as a dead button (the rail learned this, 2026-09-08)
 *   link    a plain link to the shipped page (literal hrefs here, never composed in the registry — see its note)
 *   attach  the composer's own file input (`CHAT_ATTACH_INPUT_ID`), clicked inside the tap so a phone allows it
 *   shut    drawn, greyed, with the reason — never hidden (owner B2, "hide nothing, say why")
 *
 * Portalled to `document.body`: the dashboard's page wrapper keeps a transform, which makes it the containing block
 * for a `position: fixed` sheet drawn inside it.
 */

// 🔣 One icon per topic (Build 3 · lane B): a row about a topic wears that topic's glyph from `TOPIC_ICON`.
const ICON: Record<VendorThreadToolIcon, LucideIcon> = {
  quote: TOPIC_ICON.quote,
  answer: Handshake,
  payment: TOPIC_ICON.payment,
  confirm: BadgeCheck,
  schedule: TOPIC_ICON.schedule,
  file: TOPIC_ICON.files,
  offer: Store,
  deal: CalendarPlus,
  guests: TOPIC_ICON.details,
  outcome: Star,
  problem: TOPIC_ICON.report,
  questions: TOPIC_ICON.forms,
};

/** 📷 · 🖼 The composer's two shortcuts live inside the (+) (v8.3) — since 11 Nov as rows of `lib/chat-plus.ts`, under Files. */
type SheetIcon = VendorThreadToolIcon | 'camera' | 'photo';
const SHEET_ICON: Record<SheetIcon, LucideIcon> = { ...ICON, camera: Camera, photo: ImageIcon };
const ATTACH_INPUT: Record<'file' | 'camera' | 'photo', string> = {
  file: CHAT_ATTACH_INPUT_ID,
  camera: CHAT_CAMERA_INPUT_ID,
  photo: CHAT_PHOTO_INPUT_ID,
};

/** Each off-screen destination, written out where `lint-port-no-lost-controls` reads this route's doors. */
function linkHref(tool: VendorThreadLinkTool, eventId: string): string {
  switch (tool.link) {
    case 'client-schedule':
      return `/vendor-dashboard/clients/${eventId}?tab=schedule`;
    case 'client-payments':
      return `/vendor-dashboard/clients/${eventId}?tab=quote`;
    case 'disputes':
      return '/vendor-dashboard/disputes';
    default: {
      const unhandled: never = tool.link;
      return unhandled;
    }
  }
}

/** One row as the sheet draws it — the supplier's registry rows and the couple's rows both come down to this. */
export type SheetRow = {
  key: string;
  label: string;
  line: string;
  icon: SheetIcon;
  primary?: boolean;
  group?: ThreadToolGroup;
  shut: { reason: string } | null;
  href?: string;
  reveal?: readonly string[];
  /** `true` / 'file' → the paperclip's input; 'camera' / 'photo' → the composer's shortcut inputs. */
  attach?: boolean | 'file' | 'camera' | 'photo';
  /** Build 3 — the row drops this card into the chat (one at a time) instead of opening a tool. */
  card?: PlusRow['card'];
  /**
   * 🧭 The picked client's page this row belongs to (owner 11 Nov — the (+) mirrors the menu). Where it changes, the
   * sheet draws that tab's word as a quiet labelled rule above the row: the divider between topics IS the label.
   * 🤝 'negotiate' (12 Nov) is the one group above the mirror — drawn first, labelled NEGOTIATE.
   */
  page?: PlusGroup;
  /** Presses a shipped control in the chat instead of a card or a door (See every version). */
  act?: PlusRow['act'];
};

/**
 * THE ＋ AND ITS SHEET, drawn once for both sides (chat prototype 2026-10-28, frames C and D). Rows have no frames — the
 * icon round and the words (frames only on what you press: the row itself is the press).
 *
 * 🧭 THE SHEET IS THE MENU'S MIRROR (owner 11 Nov 2026 — *"Align them both"*): the rows come down in the picked client's
 * menu order (`lib/chat-plus.ts`), and where a row's `page` changes the sheet draws the tab's own word — CHAT · DETAILS ·
 * QUOTATION · … — as a quiet small-caps label on a hairline (the divider between topics carries the label, so nine rows
 * and eight topics still fit a 390 × 844 phone without scrolling). The older registry `group` headings (Money · Plan ·
 * Talk & files · Just you) are still drawn for a row that carries one. The sentence that used to sit under the title
 * lives in the title's ⓘ (house rule: details go inside the ⓘ).
 */
const SHORTCUT_ROWS: readonly SheetRow[] = [
  { key: 'camera', label: 'Camera', line: 'Take a photo or a video now', icon: 'camera', shut: null, attach: 'camera', page: 'files' },
  { key: 'photo', label: 'Photo', line: 'A photo or a video from your phone', icon: 'photo', shut: null, attach: 'photo', page: 'files' },
];

/** The tab's word over a topic's rows, on a hairline — `pb` tight so the row under it still reads as the label's own. */
function PageLabel({ page, first }: { page: PlusGroup; first: boolean }) {
  return (
    <li aria-hidden className={`flex items-center gap-2.5 pb-0.5 ${first ? 'pt-1' : 'pt-2'}`} data-plus-page={page}>
      <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-ink/45">
        {page === NEGOTIATE_GROUP ? 'Negotiate' : pickedPageLabel(page)}
      </span>
      <span className="h-px flex-1 bg-ink/10" />
    </li>
  );
}

export function ToolsSheetButton({ rows, sheetMark, threadId }: { rows: readonly SheetRow[]; sheetMark: string; threadId?: string }) {
  const [open, setOpen] = useState(false);
  const plus = usePlus(threadId ?? '');
  // 📌 ONE (+) AT A TIME (owner 8 Nov): while the reader's card is open — a draft, or one they sent that waits for an
  // answer — the (+) is shut; a tap says which and jumps to it.
  const running = plus.draft
    ? { key: 'draft', card: plus.draft.kind, title: PLUS_CARD_TITLE[plus.draft.kind], by: 'you' as const, status: 'draft' as const, anchorId: PLUS_DRAFT_ANCHOR }
    : plus.sent;
  const gate = plusGate(running ?? null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();
  // ⌨ THE SLASH LIST IS THIS SHEET'S OWN CARD ROWS (owner 11 Nov: "/" shortcuts) — published for the composer, so a
  // typed "/poll" can never offer a row the (+) does not, nor drop one the (+) has greyed.
  const slash = sheetSlashRows(rows);
  const slashSig = JSON.stringify(slash);
  useEffect(() => {
    if (threadId) patchPlus(threadId, { slash: JSON.parse(slashSig) });
  }, [threadId, slashSig]);

  let lastGroup: ThreadToolGroup | undefined;
  let lastPage: PlusGroup | undefined;
  const items: ReactNode[] = [];
  for (const row of rows) {
    if (row.page && row.page !== lastPage) {
      items.push(<PageLabel key={`page-${row.page}`} page={row.page} first={items.length === 0} />);
      lastPage = row.page;
    }
    if (row.group && row.group !== lastGroup) {
      const g = THREAD_TOOL_GROUPS.find((x) => x.key === row.group);
      items.push(
        <li key={`group-${row.group}`} aria-hidden className="pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/55" data-thread-tool-group={row.group}>
          {g?.label}
        </li>,
      );
      lastGroup = row.group;
    }
    const Icon = row.card ? TOPIC_ICON[PLUS_CARD_TOPIC[row.card]] : SHEET_ICON[row.icon];
    const shut = row.shut;
    // 🔇 A shut row is drawn, never hidden — and CALM (owner 11 Nov): its round, word and reason all step back to the same
    // quiet grey, so the eye reads the rows it can press and the shut ones say why without shouting.
    const lead = (
      <span
        aria-hidden
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          shut ? 'bg-ink/[0.03] text-ink/25' : row.primary ? 'bg-sn-accent/10 text-sn-accent' : 'bg-ink/[0.05] text-sn-accent'
        }`}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </span>
    );
    const words = (
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-semibold leading-tight ${shut ? 'text-ink/40' : 'text-ink'}`}>
          {row.label}
        </span>
        <span className="mt-0.5 block truncate text-[13px] leading-tight text-ink/60">{row.line}</span>
      </span>
    );
    // 48 px tall (the 44-px press floor, with 2 px of air each side) — nine rows and eight topic labels fit a 390 × 844
    // phone without the sheet scrolling.
    const rowClass = 'flex min-h-[48px] w-full items-center gap-3 py-1 text-left';
    if (shut) {
      const reasonId = `${headingId}-shut-${row.key}`;
      items.push(
        <li key={row.key} data-thread-tool-row={row.key} data-shut="">
          <span role="button" aria-disabled="true" aria-describedby={reasonId} tabIndex={0} className={rowClass}>
            {lead}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight text-ink/40">{row.label}</span>
              <span id={reasonId} className="mt-0.5 block truncate text-[13px] leading-tight text-ink/45">
                {shut.reason}
              </span>
            </span>
          </span>
        </li>,
      );
      continue;
    }
    items.push(
      <li key={row.key} data-thread-tool-row={row.key}>
        {row.href ? (
          <Link href={row.href} className={`sn-press ${rowClass}`} onClick={() => setOpen(false)}>
            {lead}
            {words}
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} />
          </Link>
        ) : (
          <button
            type="button"
            className={`sn-press ${rowClass}`}
            onClick={() => {
              if (row.act === 'versions') {
                // The shipped versions sheet on the live quote's card (`quote-versions-sheet.tsx`) — the one place
                // every version is listed. Only drawn once a second version exists; until then, say so.
                setOpen(false);
                const door = document.querySelector<HTMLElement>('[data-quote-every-version]');
                if (door) window.setTimeout(() => door.click(), 0);
                else if (threadId) patchPlus(threadId, { toast: { text: 'One version so far — a change or an accepted counter makes the next', at: Date.now() } });
                return;
              }
              if (row.card && threadId) {
                setOpen(false);
                patchPlus(threadId, { draft: { kind: row.card, startedAt: Date.now() } });
                window.setTimeout(() => jumpTo(PLUS_DRAFT_ANCHOR), 60);
                return;
              }
              if (row.attach) {
                // Inside the tap: a phone only opens a file picker from a user gesture.
                document.getElementById(ATTACH_INPUT[row.attach === true ? 'file' : row.attach])?.click();
                setOpen(false);
                return;
              }
              setOpen(false);
              // After the sheet has gone, so the opened panel is what they are looking at.
              const reveal = row.reveal;
              if (reveal) window.setTimeout(() => revealThreadTool(reveal), 0);
            }}
          >
            {lead}
            {words}
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} />
          </button>
        )}
      </li>,
    );
  }

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-5 pt-5" data-thread-tools-sheet={sheetMark}>
        {/* ⓘ beside the title (house rule: title + one line visible, the rest in the ⓘ); `pr-12` keeps clear of the ✕. */}
        <InfoTip label="Add to the chat" labelAs="h2" labelId={headingId} labelClassName="text-[17px] font-semibold text-ink" align="start" className="pr-12">
          A card lands in the chat. They fill their part there. One at a time. Each row sits under the page it belongs to —
          the same order as the menu above.
        </InfoTip>
        <ul className="mt-2">{items}</ul>
      </div>
    </Sheet>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (gate.shut) {
            if (threadId) patchPlus(threadId, { toast: { text: gate.message, at: Date.now() } });
            if (running) jumpTo(running.anchorId);
            return;
          }
          setOpen(true);
        }}
        aria-label={gate.shut ? gate.message : 'Add to the chat'}
        aria-haspopup="dialog"
        title={gate.shut ? gate.message : 'Add to the chat'}
        data-thread-tools-open=""
        data-plus-shut={gate.shut ? '' : undefined}
        // ＋ v8.3: a FILLED 40-px circle — the brand fill with a white ＋; shut, it greys (the card it waits on is named).
        // The 44-px target is the button; the circle is drawn inside it.
        className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <span
          aria-hidden
          data-plus-circle=""
          className={`grid h-10 w-10 place-items-center rounded-full ${gate.shut ? 'bg-ink/[0.06] text-ink/35' : 'bg-sn-accent text-white'}`}
        >
          <Plus aria-hidden className="h-5 w-5" strokeWidth={2.2} />
        </span>
      </button>
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}

/**
 * WHERE A CARD'S FULL PAGE IS — the shipped tool behind each (+) card (its "door"). The supplier's doors are keys of
 * `VENDOR_THREAD_TOOLS`, so every shipped panel is still reached; the host's are their own pages. Literal hrefs live
 * here (`lint-port-no-lost-controls` reads this route's doors).
 */
export type PlusDoor = { href?: string; reveal?: readonly string[]; attach?: boolean } | null;

export function plusDoor(side: 'vendor' | 'couple', door: string | null, eventId: string): PlusDoor {
  if (!door) return null;
  if (side === 'couple') {
    switch (door) {
      case 'deal-or-meeting':
        return { reveal: ['deal-or-meeting'] };
      case 'share-file':
        return { attach: true };
      case 'host-payments':
        return { href: `/dashboard/${eventId}/budget` };
      case 'host-report':
        return { href: `/dashboard/${eventId}/disputes` };
      default:
        return null;
    }
  }
  const tool = VENDOR_THREAD_TOOLS.find((t) => t.key === door);
  if (!tool) return null;
  if (tool.link) return { href: linkHref(tool, eventId) };
  if (tool.attach) return { attach: true };
  return { reveal: tool.reveal };
}

/** Open a door — the same three ways a sheet row always opened its tool. */
export function openPlusDoor(d: NonNullable<PlusDoor>): void {
  if (d.attach) {
    document.getElementById(CHAT_ATTACH_INPUT_ID)?.click();
    return;
  }
  if (d.reveal) revealThreadTool(d.reveal);
}

function plusSheetRows(rows: PlusRow[], side: 'vendor' | 'couple', eventId: string, hasAgreement: boolean): SheetRow[] {
  return rows.map((r) => {
    const d = r.card ? null : plusDoor(side, r.door, eventId);
    return {
      key: r.key,
      label: r.label,
      line: r.line,
      // A card wears its topic's glyph (above); a row that is not a card wears its own: the camera, the photo, the flag.
      icon: r.key === 'camera' ? 'camera' : r.key === 'photo' ? 'photo' : r.key === 'report' ? 'problem' : r.key === 'versions' ? 'quote' : 'file',
      shut: r.shutNow ?? (r.shutUntilAgreement && !hasAgreement ? r.shutUntilAgreement : null),
      card: r.card,
      href: d?.href,
      reveal: d?.reveal,
      // The row's own composer input (Camera · Photo) beats a door's paperclip.
      attach: r.attach ?? d?.attach,
      page: PLUS_ROW_PAGE[r.key],
      act: r.act,
      // 🤝 Negotiate's rows wear the brand round (the design's `pri`) — the money moves of this chat.
      primary: PLUS_ROW_PAGE[r.key] === NEGOTIATE_GROUP,
    };
  });
}

/**
 * THE SUPPLIER'S (+) — Supplier Build 3 (owner 8 Nov, 📌), in the menu's order since 11 Nov: Decision · Ask for access ·
 * Quote · Payment · Form · Meeting · Camera · Photos & files · Report a problem (last). What the app detects pins itself
 * instead (`lib/chat-pins.ts`).
 */
export function ThreadToolsSheet({
  eventId,
  state,
  threadId,
  paid = false,
}: {
  eventId: string;
  state: VendorThreadToolsState;
  threadId?: string;
  /** A payment is confirmed on the quote — Quote reads "Change quote" (the paid total is the floor). */
  paid?: boolean;
}) {
  // 🗳 One open poll per chat: the stream's poll card tells the store; the Poll row goes grey with its reason.
  const { pollOpen } = usePlus(threadId ?? '');
  const rows = plusSheetRows(supplierPlusRows({ paid, pollOpen }), 'vendor', eventId, state.hasAgreement);
  return <ToolsSheetButton rows={rows} sheetMark="vendor" threadId={threadId} />;
}

/**
 * THE HOST'S (+) — in the same order as the supplier's (11 Nov): Decision · Log a payment · Meeting · Camera · Photos &
 * files · Report a problem (last). A coordinator with another supplier drops Log a payment (`canLogPayment` false).
 */
export function CoupleThreadToolsSheet({
  dealReveal = null,
  eventId,
  threadId,
  canLogPayment = true,
}: {
  dealReveal?: readonly string[] | null;
  eventId: string;
  threadId?: string;
  canLogPayment?: boolean;
}) {
  // The entry decides whether a meeting can be proposed here (an open chat, negotiation on) — the shipped couple
  // rows say so: no deal row ⇒ the Meeting card is SHUT with its reason, never hidden and never a dead Send.
  const meetingOpen = coupleThreadTools(dealReveal).some((t) => t.key === 'deal-or-meeting');
  const { pollOpen } = usePlus(threadId ?? '');
  const rows = plusSheetRows(hostPlusRows({ canLogPayment, pollOpen }), 'couple', eventId, true).map((r) =>
    r.key === 'meeting' && !meetingOpen ? { ...r, shut: { reason: 'Not open on this chat yet' } } : r,
  );
  return <ToolsSheetButton rows={rows} sheetMark="couple" threadId={threadId} />;
}

/**
 * 🧪 THE (+) WITH THE SHIPPED ATTACH ACTIONS ONLY — Camera · Photo · Share a file — for a composer whose own rows are
 * not built yet (the chat labs). `more` is Lane B's slot (Build 3: the supplier's (+) menu content): rows handed in are
 * drawn after the shipped ones, through the same sheet.
 */
export function ComposerPlusSheet({ more = [], sheetMark = 'plain' }: { more?: readonly SheetRow[]; sheetMark?: string }) {
  const rows: SheetRow[] = [
    ...SHORTCUT_ROWS,
    { key: 'share-file', label: 'Share a file', line: 'File · photo · video · the contract', icon: 'file', shut: null, attach: 'file', page: 'files' },
    ...more,
  ];
  return <ToolsSheetButton rows={rows} sheetMark={sheetMark} />;
}

/**
 * "Answer" on the answer line while the couple's booking ask is open — the same reveal as the sheet's "Answer their
 * booking ask" row, one tap from the top of the conversation (prototype: the ask sits right under the answer line).
 * Amber, never terracotta: Send is the screen's one main.
 */
export function AnswerAskButton() {
  return (
    <button
      type="button"
      onClick={() => revealThreadTool(['booking-ask'])}
      data-answer-ask=""
      className="sn-press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-warn-300 bg-warn-100 px-4 text-sm font-semibold text-warn-900"
    >
      <Handshake aria-hidden className="h-4 w-4" strokeWidth={1.9} />
      They asked to book
    </button>
  );
}
