'use client';

import { useState } from 'react';
import { Ban, Flag, MoreVertical, RotateCcw, X } from 'lucide-react';
import { blockUser, reportUser, unblockUser } from '@/lib/chat-actions';

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

export function ChatThreadMenu({
  threadId,
  returnTo,
  blockedByMe,
}: {
  threadId: string;
  returnTo: string;
  blockedByMe: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);

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
        aria-label="Conversation options"
        className="grid h-9 w-9 place-items-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
      >
        <MoreVertical aria-hidden className="h-5 w-5" strokeWidth={2} />
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
