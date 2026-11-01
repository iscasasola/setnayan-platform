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
  vendorThreadToolRows,
  type ThreadToolGroup,
  type VendorThreadLinkTool,
  type VendorThreadToolIcon,
  type VendorThreadToolsState,
} from '@/lib/vendor-thread-tools';
import { coupleThreadTools } from '@/lib/chat-box-tools';

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
};

/**
 * THE ＋ AND ITS SHEET, drawn once for both sides (chat prototype 2026-10-28, frames C and D). The supplier's rows carry
 * a group, and a quiet heading is drawn where the group changes (Money · Plan · Talk & files · Just you); the couple's
 * two rows carry none. Rows have no frames — the icon round and the words, a hairline between (frames only on what
 * you press: the row itself is the press).
 */
function ToolsSheetButton({ rows, sheetMark }: { rows: SheetRow[]; sheetMark: string }) {
  const [open, setOpen] = useState(false);
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
    const Icon = ICON[row.icon];
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
          Tools
        </h2>
        <ul className="mt-1">{items}</ul>
      </div>
    </Sheet>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Tools"
        aria-haspopup="dialog"
        title="Tools"
        data-thread-tools-open=""
        className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sn-accent hover:bg-ink/[0.05]"
      >
        <PlusCircle aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
      </button>
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
}

/** The supplier's ＋ — every row of `VENDOR_THREAD_TOOLS`, grouped, with the shipped greyed/shut rules. */
export function ThreadToolsSheet({ eventId, state }: { eventId: string; state: VendorThreadToolsState }) {
  const rows: SheetRow[] = vendorThreadToolRows(state).map(({ tool, shut }) => ({
    key: tool.key,
    label: tool.label,
    line: tool.line,
    icon: tool.icon,
    primary: tool.primary,
    group: tool.group,
    shut,
    href: tool.link ? linkHref(tool, eventId) : undefined,
    reveal: tool.reveal,
    attach: tool.attach,
  }));
  return <ToolsSheetButton rows={rows} sheetMark="vendor" />;
}

/**
 * The couple's ＋ (chat prototype frame C) — "Deal or meeting" when the deal panel is mounted, and the ONE "Share a
 * file". `dealReveal` is `dealEntryFor(…).composer.reveal`, or null when the page mounts no deal panel.
 */
export function CoupleThreadToolsSheet({ dealReveal }: { dealReveal: readonly string[] | null }) {
  const rows: SheetRow[] = coupleThreadTools(dealReveal).map((t) => ({
    key: t.key,
    label: t.label,
    line: t.line,
    icon: t.icon,
    shut: null,
    reveal: t.reveal,
    attach: t.attach,
  }));
  return <ToolsSheetButton rows={rows} sheetMark="couple" />;
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
