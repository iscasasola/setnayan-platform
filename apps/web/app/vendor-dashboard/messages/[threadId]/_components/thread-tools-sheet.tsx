'use client';

import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import Link from 'next/link';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  ListChecks,
  Flag,
  Handshake,
  Paperclip,
  PlusCircle,
  ReceiptText,
  Star,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { revealThreadTool } from '@/app/_components/chat/reveal-thread-tool';
import {
  THREAD_TOOL_GROUPS,
  type ThreadToolGroup,
  type VendorThreadLinkTool,
  type VendorThreadToolIcon,
  type VendorThreadToolsState,
} from '@/lib/vendor-thread-tools';
import { VENDOR_THREAD_TOOLS } from '@/lib/vendor-thread-tools';
import { hostPlusRows, plusGate, supplierPlusRows, type PlusRow } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
import { TOPIC_ICON } from '@/lib/topic-icons';
import { PLUS_CARD_TOPIC } from '@/lib/chat-plus';

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

const ICON: Record<VendorThreadToolIcon, LucideIcon> = {
  quote: ReceiptText,
  answer: Handshake,
  payment: Wallet,
  confirm: BadgeCheck,
  schedule: CalendarClock,
  file: Paperclip,
  offer: Store,
  deal: CalendarPlus,
  guests: Users,
  outcome: Star,
  problem: Flag,
  questions: ListChecks,
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
type SheetRow = {
  key: string;
  label: string;
  line: string;
  icon: VendorThreadToolIcon;
  primary?: boolean;
  group?: ThreadToolGroup;
  shut: { reason: string } | null;
  href?: string;
  reveal?: readonly string[];
  attach?: boolean;
  /** Build 3 — the row drops this card into the chat (one at a time) instead of opening a tool. */
  card?: PlusRow['card'];
};

/**
 * THE ＋ AND ITS SHEET, drawn once for both sides (chat prototype 2026-10-28, frames C and D). The supplier's rows carry
 * a group, and a quiet heading is drawn where the group changes (Money · Plan · Talk & files · Just you); the couple's
 * two rows carry none. Rows have no frames — the icon round and the words, a hairline between (frames only on what
 * you press: the row itself is the press).
 */
function ToolsSheetButton({ rows, sheetMark, threadId }: { rows: SheetRow[]; sheetMark: string; threadId?: string }) {
  const [open, setOpen] = useState(false);
  const plus = usePlus(threadId ?? '');
  // 📌 ONE (+) AT A TIME (owner 8 Nov): while the reader's card is open — a draft, or one they sent that waits for an
  // answer — the (+) is shut; a tap says which and jumps to it.
  const running = plus.draft
    ? { key: 'draft', card: plus.draft.kind, title: 'your card', by: 'you' as const, status: 'draft' as const, anchorId: PLUS_DRAFT_ANCHOR }
    : plus.sent;
  const gate = plusGate(running ?? null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();

  let lastGroup: ThreadToolGroup | undefined;
  const items: ReactNode[] = [];
  for (const row of rows) {
    if (row.group && row.group !== lastGroup) {
      const g = THREAD_TOOL_GROUPS.find((x) => x.key === row.group);
      items.push(
        <li key={`group-${row.group}`} aria-hidden className="pb-1 pt-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/55" data-thread-tool-group={row.group}>
          {g?.label}
        </li>,
      );
      lastGroup = row.group;
    }
    const Icon = row.card ? TOPIC_ICON[PLUS_CARD_TOPIC[row.card]] : ICON[row.icon];
    const shut = row.shut;
    const lead = (
      <span
        aria-hidden
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          shut ? 'bg-ink/[0.04] text-ink/30' : row.primary ? 'bg-sn-accent/10 text-sn-accent' : 'bg-ink/[0.05] text-sn-accent'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
    );
    const words = (
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-semibold leading-tight ${shut ? 'text-ink/40' : 'text-ink'}`}>
          {row.label}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink/60">{row.line}</span>
      </span>
    );
    const rowClass = 'flex min-h-[56px] w-full items-center gap-3.5 py-2 text-left';
    if (shut) {
      const reasonId = `${headingId}-shut-${row.key}`;
      items.push(
        <li key={row.key} data-thread-tool-row={row.key} data-shut="">
          <span role="button" aria-disabled="true" aria-describedby={reasonId} tabIndex={0} className={rowClass}>
            {lead}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight text-ink/40">{row.label}</span>
              <span id={reasonId} className="mt-0.5 block text-[13px] text-ink/60">
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
              if (row.card && threadId) {
                setOpen(false);
                patchPlus(threadId, { draft: { kind: row.card, startedAt: Date.now() } });
                window.setTimeout(() => jumpTo(PLUS_DRAFT_ANCHOR), 60);
                return;
              }
              if (row.attach) {
                // Inside the tap: a phone only opens a file picker from a user gesture.
                document.getElementById(CHAT_ATTACH_INPUT_ID)?.click();
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
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Add to the chat
        </h2>
        <p className="mt-1 text-[13px] text-ink/60">A card lands in the chat. They fill their part there. One at a time.</p>
        <ul className="mt-1">{items}</ul>
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
        className={`sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/[0.05] ${gate.shut ? 'text-ink/30' : 'text-sn-accent'}`}
      >
        <PlusCircle aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
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
      icon: r.key === 'report' ? 'problem' : 'file',
      shut: r.shutUntilAgreement && !hasAgreement ? r.shutUntilAgreement : null,
      card: r.card,
      href: d?.href,
      reveal: d?.reveal,
      attach: d?.attach,
    };
  });
}

/**
 * THE SUPPLIER'S (+) — Supplier Build 3 (owner 8 Nov, 📌): Quote · Payment · Meeting · Form · Photos & files ·
 * Decision · Report a problem (last). What the app detects pins itself instead (`lib/chat-pins.ts`).
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
  const rows = plusSheetRows(supplierPlusRows({ paid }), 'vendor', eventId, state.hasAgreement);
  return <ToolsSheetButton rows={rows} sheetMark="vendor" threadId={threadId} />;
}

/**
 * THE HOST'S (+) — Meeting · Log a payment · File · Decision · Report a problem (last). A coordinator with another
 * supplier drops Log a payment (`canLogPayment` false).
 */
export function CoupleThreadToolsSheet({
  eventId,
  threadId,
  canLogPayment = true,
}: {
  dealReveal?: readonly string[] | null;
  eventId: string;
  threadId?: string;
  canLogPayment?: boolean;
}) {
  const rows = plusSheetRows(hostPlusRows({ canLogPayment }), 'couple', eventId, true);
  return <ToolsSheetButton rows={rows} sheetMark="couple" threadId={threadId} />;
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
