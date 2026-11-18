'use client';

/**
 * FocusRecents — "Recent" on Focus home (Focus at Spotlight level, owner approved 18 Nov 2026, picture 1 "Same home,
 * plus Recent": *"The last things you opened, one tap away."*).
 *
 * The records and pages opened from the Focus search box (`admin-command-palette.tsx` writes them). Your needs list
 * stays first; Recent sits under it. Kept in THIS browser (`FOCUS_RECENTS_KEY`) — no table, no migration, nothing
 * sent anywhere. Storage that is blocked or empty simply shows no Recent section; it never shows a fake one.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, History } from 'lucide-react';
import {
  FOCUS_RECENTS_KEY,
  FOCUS_RECENTS_SHOWN,
  parseFocusRecents,
  recentWhen,
  type FocusRecent,
} from '@/lib/admin-map/focus-search';

export function FocusRecents() {
  const [list, setList] = useState<FocusRecent[]>([]);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    try {
      setList(parseFocusRecents(window.localStorage.getItem(FOCUS_RECENTS_KEY)).slice(0, FOCUS_RECENTS_SHOWN));
    } catch {
      setList([]);
    }
    setNowMs(Date.now());
  }, []);

  if (list.length === 0) return null;
  return (
    <section aria-label="Recent" data-focus-recents="">
      <p className="sn-eye mx-4 mb-1 mt-4">Recent</p>
      <ul>
        {list.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex min-h-14 items-center gap-3 border-t px-4 py-2.5 transition-colors hover:bg-[var(--sn-paper)]"
              style={{ borderColor: 'var(--sn-line)' }}
              data-focus-recent=""
            >
              <span
                aria-hidden
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-md"
                style={{ background: 'var(--sn-sunk, #F4F2EC)', color: 'var(--sn-ink-500)' }}
              >
                <History className="h-4 w-4" />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-[15px] font-semibold text-[color:var(--sn-ink-900)]">{r.title}</span>
                <span className="truncate text-[13px] text-[color:var(--sn-ink-500)]">
                  {r.label} · {recentWhen(r.at, nowMs)}
                </span>
              </span>
              <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--sn-ink-500)]" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
