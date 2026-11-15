'use client';

/**
 * AdminAskPill — the ask box in Focus (owner approved 14 Nov 2026, DECISION_LOG "ADMIN FOCUS | FULL — APPROVED (v6)"
 * (2)–(4)): one pill, "Ask or go anywhere", with the ? at its end that opens "What can I ask?". On a phone it sits in
 * the thumb zone; from the dock point up it sits at the top of the list.
 *
 * 🔑 IT IS THE SHIPPED SEARCH, NOT A SECOND ONE. A press opens the console's one palette (`ADMIN_SEARCH_OPEN_EVENT`,
 * the same panel ⌘K and the top bar open — plain words, then the learned phrases), docked at the bottom so the field
 * stays where the pill was and the suggestions rise above it. Whatever brain answers in that panel answers here.
 */
import Link from 'next/link';
import { Search } from 'lucide-react';
import { ADMIN_SEARCH_OPEN_EVENT } from './admin-search-open-event';

export function AdminAskPill({ place }: { place: 'thumb' | 'top' }) {
  return (
    <div
      className="flex min-h-[54px] items-center gap-2.5 rounded-full border pl-4 pr-1.5 shadow-lg backdrop-blur"
      style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-glass, var(--sn-paper))' }}
      data-admin-ask={place}
    >
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new CustomEvent(ADMIN_SEARCH_OPEN_EVENT, { detail: { dock: place === 'thumb' ? 'bottom' : 'top' } }))
        }
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left text-[15px]"
        style={{ color: 'var(--sn-ink-500)' }}
        aria-label="Ask or go anywhere"
      >
        <Search aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.9} />
        <span className="min-w-0 flex-1 truncate">Ask or go anywhere</span>
        {place === 'top' ? (
          <kbd
            className="hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[12px] font-semibold lg:inline"
            style={{ borderColor: 'var(--sn-line)' }}
          >
            ⌘K
          </kbd>
        ) : null}
      </button>
      <Link
        href="/admin/ask"
        title="What can I ask?"
        aria-label="What can I ask?"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-extrabold"
        style={{ background: 'var(--sn-paper)', color: 'var(--sn-ink-900)' }}
      >
        ?
      </Link>
    </div>
  );
}
