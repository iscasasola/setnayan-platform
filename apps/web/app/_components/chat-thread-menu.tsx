'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, Ban, CalendarDays, ClipboardList, Flag, FolderOpen, MoreVertical, Receipt, RotateCcw, UserRound, Wallet, X, type LucideIcon } from 'lucide-react';
import { archiveThread, blockUser, reportUser, unarchiveThread, unblockUser } from '@/lib/chat-actions';
import { useOneOpen } from '@/lib/one-open';

// Apple Guideline 1.2 (UGC safety): an in-app way to REPORT abusive content and
// BLOCK the other person, reachable from every chat thread. Report files a
// public.user_reports row (admin queue); Block writes blocked_users (the
// chat_messages_block_guard RESTRICTIVE policy then prevents either party from
// sending). Reasons mirror the user_reports CHECK constraint.
const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or a scam' },
  { value: 'hate_harassment', label: 'Harassment or hate' },
  { value: 'nudity_sexual', label: 'Nudity or sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'not_my_event', label: 'Not related to my event' },
  { value: 'other', label: 'Something else' },
];

/**
 * EACH ROW WEARS ITS OWN PICTURE (owner 2026-10-29, live in the iPhone app: *"when i press the ... on upper right i see
 * quote payments files, etc with the same icon"*). Every link used to wear the same ↗, so the rows read as one thing
 * five times. A link now names WHAT it opens (`icon`), and the menu draws that picture — from the shipped set, never a
 * second ↗. Plain strings, because the pages that fill this are server components. Held by
 * `lib/the-chat-menu-rows-wear-their-own-icons.test.ts` (every key distinct, and distinct from Report and Block).
 */
export const CHAT_MENU_ICONS = {
  quote: Receipt,
  payments: Wallet,
  files: FolderOpen,
  schedule: CalendarDays,
  details: ClipboardList,
  customer: UserRound,
} as const satisfies Record<string, LucideIcon>;
export type ChatMenuIcon = keyof typeof CHAT_MENU_ICONS;

export function ChatThreadMenu({
  threadId,
  returnTo,
  blockedByMe,
  links = [],
  archive = null,
}: {
  /**
   * ARCHIVE — the supplier's chat (owner 2026-10-28: Customers' list IS the messages, so archive moved from the
   * retired Messages fold's rows into the chat it archives). The shipped `archiveThread` / `unarchiveThread`; it comes
   * back to `returnTo`. Null → no item (a caller that does not offer it, or could not read the state).
   */
  archive?: { archived: boolean; returnTo: string } | null;
  threadId: string;
  returnTo: string;
  blockedByMe: boolean;
  /**
   * Destinations that leave the conversation, listed above Report / Block.
   * One Chat Box (2026-09-18): the header keeps one control, ⋮, and anything
   * that is a page rather than a tool lives behind it. Plain strings — this is
   * a client component and the pages that fill it are server components.
   */
  links?: readonly { href: string; label: string; icon: ChatMenuIcon }[];
}) {
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  useOneOpen(open, setOpen); // one open at a time — lib/one-open.ts

  const close = () => {
    setOpen(false);
    setShowReport(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setShowReport(false);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="About this chat"
        /* The head's one action (chat prototype 2026-10-28, frame B draws ⓘ; no 📞, no video). It stays ⋮: the house
           keeps the ⓘ glyph for InfoTip/Explain only (`there-is-one-info-dot.test.ts`) — a menu is not a tip. */
        className="grid h-11 w-11 place-items-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
      >
        <MoreVertical aria-hidden className="h-[22px] w-[22px] text-sn-accent" strokeWidth={1.9} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-ink/10 bg-cream p-1 shadow-lg"
          >
            {!showReport ? (
              <>
                {links.map((l) => {
                  const Icon = CHAT_MENU_ICONS[l.icon];
                  return (
                  <Link
                    key={l.href}
                    href={l.href}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5"
                  >
                    <Icon aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={2} data-chat-menu-icon={l.icon} />
                    {l.label}
                  </Link>
                  );
                })}
                {archive ? (
                  <form action={archive.archived ? unarchiveThread : archiveThread}>
                    <input type="hidden" name="thread_id" value={threadId} />
                    <input type="hidden" name="return_to" value={archive.returnTo} />
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5"
                      data-chat-archive={archive.archived ? 'unarchive' : 'archive'}
                    >
                      {archive.archived ? (
                        <>
                          <ArchiveRestore aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={2} />
                          Move back to your list
                        </>
                      ) : (
                        <>
                          <Archive aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={2} />
                          Archive this chat
                        </>
                      )}
                    </button>
                  </form>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setShowReport(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-ink/5"
                >
                  <Flag aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={2} />
                  Report this conversation
                </button>
                <form action={blockedByMe ? unblockUser : blockUser}>
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-mulberry hover:bg-mulberry/5"
                  >
                    {blockedByMe ? (
                      <>
                        <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={2} />
                        Unblock this person
                      </>
                    ) : (
                      <>
                        <Ban aria-hidden className="h-4 w-4" strokeWidth={2} />
                        Block this person
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <form action={reportUser} className="space-y-2 p-2">
                <input type="hidden" name="thread_id" value={threadId} />
                <input type="hidden" name="return_to" value={returnTo} />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink/55">
                    Report
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowReport(false)}
                    aria-label="Back"
                    className="text-ink/40 hover:text-ink"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {REPORT_REASONS.map((r, i) => (
                    <label
                      key={r.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-ink/5"
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        required
                        defaultChecked={i === 0}
                        className="accent-mulberry"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  name="details"
                  rows={2}
                  maxLength={1000}
                  placeholder="Add details (optional)"
                  className="w-full rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-ink/40 focus:border-mulberry focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
                >
                  Send report
                </button>
                <p className="px-1 text-[11px] text-ink/50">
                  Our team reviews every report within 24 hours.
                </p>
              </form>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
