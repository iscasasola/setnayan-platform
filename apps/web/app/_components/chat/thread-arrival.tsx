'use client';

import { useParams } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { ChevronLeft } from 'lucide-react';
import { lastKnownStamp, recallThread, type LastKnown } from '@/lib/chat-last-known';

/**
 * THE THREAD, AT ONCE — what a chat thread's `loading.tsx` draws while the server builds the real one (owner
 * 2026-10-27, "CHAT MUST BE EFFICIENT AND FAST": *"the inbox and a thread open with no blank wait (last-known messages
 * shown at once, fresh ones after)"*).
 *
 * It is the thread's own shape — the full-screen takeover (`data-chat-takeover`), the slim head, the bubbles, the
 * composer row — filled from `lib/chat-last-known.ts` when this viewer has opened the thread before in this tab, and
 * with quiet placeholders when not. It sends nothing and opens nothing: the field is not a field, and the real page
 * replaces all of it the moment it lands. Cards (quotes, meetings) are drawn as a placeholder, never re-drawn from
 * memory — a remembered price could be a stale one.
 */
/** One parsed value per stored stamp, so `useSyncExternalStore` sees a stable snapshot until the memory changes. */
const cache = new Map<string, { stamp: string; value: LastKnown | null }>();
function snapshot(threadId: string): LastKnown | null {
  if (!threadId) return null;
  const stamp = lastKnownStamp(threadId);
  const hit = cache.get(threadId);
  if (hit && hit.stamp === stamp) return hit.value;
  const value = recallThread(threadId);
  cache.set(threadId, { stamp, value });
  return value;
}
const noSubscribe = () => () => {};

export function ThreadArrival() {
  const params = useParams<{ threadId?: string }>();
  const threadId = typeof params?.threadId === 'string' ? params.threadId : '';
  // A client navigation (a tap on the inbox) reads the memory in the FIRST render — no blank frame; a hard load renders
  // the server's blank snapshot, then the memory, with no hydration mismatch.
  const known = useSyncExternalStore(noSubscribe, () => snapshot(threadId), () => null);

  return (
    <div data-chat-takeover="" data-chat-arrival={known ? 'remembered' : 'blank'} className="flex min-h-[27rem] min-w-0 flex-1 flex-col" aria-busy="true">
      <div className="flex min-h-[52px] items-center gap-2 border-b border-ink/10 py-1 pl-1 pr-2">
        <button type="button" onClick={() => window.history.back()} aria-label="Back to Chats" className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-sn-accent">
          <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={2} />
        </button>
        <span aria-hidden className="h-9 w-9 shrink-0 rounded-full bg-ink/[0.1]" />
        <div className="min-w-0 flex-1">
          {known ? (
            <p className="truncate text-[16px] font-semibold leading-tight text-ink">{known.label}</p>
          ) : (
            <span aria-hidden className="block h-4 w-32 rounded bg-ink/[0.08]" />
          )}
          <span aria-hidden className="mt-1 block h-3 w-24 rounded bg-ink/[0.06]" />
        </div>
      </div>
      <ol className="flex min-h-0 flex-1 flex-col justify-end gap-0.5 overflow-hidden px-2.5 py-3">
        {known
          ? known.rows.map((r) =>
              r.card ? (
                <li key={r.id} aria-hidden className="my-2 h-20 self-center rounded-2xl bg-ink/[0.05]" style={{ width: '88%' }} />
              ) : (
                <li key={r.id} className={`flex ${r.mine ? 'justify-end' : 'justify-start pl-[34px]'}`}>
                  <span className={`max-w-[75%] whitespace-pre-wrap break-words rounded-[18px] px-3 py-2 text-[15px] leading-snug ${r.mine ? 'bg-sn-accent text-white' : 'bg-ink/[0.06] text-ink'}`}>
                    {r.body || (r.file ? `📎 ${r.file}` : '')}
                  </span>
                </li>
              ),
            )
          : [60, 45, 70, 40].map((w, i) => (
              <li key={i} aria-hidden className={`flex ${i % 2 ? 'justify-end' : 'justify-start pl-[34px]'}`}>
                <span className="h-9 rounded-[18px] bg-ink/[0.06]" style={{ width: `${w}%` }} />
              </li>
            ))}
      </ol>
      <div className="flex items-center gap-1 border-t border-ink/10 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <span aria-hidden className="h-[38px] flex-1 rounded-[19px] bg-ink/[0.06]" />
      </div>
    </div>
  );
}
