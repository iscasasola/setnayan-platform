'use client';

import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Flag,
  Handshake,
  Paperclip,
  Phone,
  Plus,
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
  vendorThreadToolRows,
  type VendorThreadLinkTool,
  type VendorThreadToolIcon,
  type VendorThreadToolsState,
} from '@/lib/vendor-thread-tools';

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
  voice: Phone,
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

export function ThreadToolsSheet({ eventId, state }: { eventId: string; state: VendorThreadToolsState }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();
  const rows = vendorThreadToolRows(state);

  const sheet = (
    <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-5 pb-5 pt-5" data-thread-tools-sheet="">
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          Tools
        </h2>
        <ul className="mt-2">
          {rows.map(({ tool, shut }) => {
            const Icon = ICON[tool.icon];
            const lead = (
              <span
                aria-hidden
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                  shut ? 'bg-ink/[0.04] text-ink/30' : tool.primary ? 'bg-sn-accent/10 text-sn-accent' : 'bg-ink/[0.05] text-ink/60'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
            );
            const words = (
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] font-medium leading-tight ${shut ? 'text-ink/40' : 'text-ink'}`}>
                  {tool.label}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-ink/60">{tool.line}</span>
              </span>
            );
            const rowClass = 'flex min-h-[60px] w-full items-center gap-3 border-t border-ink/10 py-2.5 text-left';
            if (shut) {
              const reasonId = `${headingId}-shut-${tool.key}`;
              return (
                <li key={tool.key} className="first:[&>*]:border-t-0" data-thread-tool-row={tool.key} data-shut="">
                  <span role="button" aria-disabled="true" aria-describedby={reasonId} tabIndex={0} className={rowClass}>
                    {lead}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium leading-tight text-ink/40">{tool.label}</span>
                      <span id={reasonId} className="mt-0.5 block text-[13px] text-ink/60">
                        {shut.reason}
                      </span>
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={tool.key} className="first:[&>*]:border-t-0" data-thread-tool-row={tool.key}>
                {tool.link ? (
                  <Link href={linkHref(tool, eventId)} className={`sn-press ${rowClass}`} onClick={() => setOpen(false)}>
                    {lead}
                    {words}
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={`sn-press ${rowClass}`}
                    onClick={() => {
                      if (tool.attach) {
                        // Inside the tap: a phone only opens a file picker from a user gesture.
                        document.getElementById(CHAT_ATTACH_INPUT_ID)?.click();
                        setOpen(false);
                        return;
                      }
                      setOpen(false);
                      // After the sheet has gone, so the opened panel is what the supplier is looking at.
                      const reveal = tool.reveal;
                      if (reveal) window.setTimeout(() => revealThreadTool(reveal), 0);
                    }}
                  >
                    {lead}
                    {words}
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
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
        className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink hover:bg-ink/[0.1]"
      >
        <Plus aria-hidden className="h-5 w-5" strokeWidth={2} />
      </button>
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
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
