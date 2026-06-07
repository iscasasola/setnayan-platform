'use client';

// Live message stream for an iteration-0019 chat thread.
//
// Responsibilities (replaces the previously server-rendered <ol> of messages):
//   1. Render the initial server-fetched batch immediately (SSR, no flash).
//   2. Subscribe to Postgres CHANGES events on `chat_messages` filtered by
//      thread_id so new INSERTs (and future UPDATEs for edits / read
//      receipts) flow in within ~500ms.
//   3. Maintain a presence channel so the OTHER party sees "X is typing…"
//      while the local user is composing. We debounce at 700ms idle and
//      auto-clear after 3s of inactivity to avoid spamming the channel.
//   4. Auto-scroll to the bottom when a new message arrives, but only if
//      the user is already near the bottom — never yank them out of the
//      scrollback while they're reading old messages.
//   5. Clean up channels on unmount AND when the threadId / userId changes
//      so we never leak subscriptions when the user navigates between
//      threads.
//
// The Supabase JS client auto-reconnects on network drops; on every
// resubscribe we refetch the latest messages so any inserts that happened
// while we were offline catch up without a page reload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  fetchMessages,
  formatChatTimestamp,
  type ChatMessageRow,
  type ChatSenderRole,
} from '@/lib/chat';
import { trackFailure } from '@/lib/telemetry/track-error';

type Props = {
  threadId: string;
  initialMessages: ChatMessageRow[];
  currentUserId: string;
  /**
   * Role of the LOCAL viewer. Used to right-align their own bubbles and to
   * label presence events ("Maria is typing…" vs. just "Vendor is typing…").
   * On the couple side this is 'couple', on the vendor side 'vendor'.
   */
  viewerRole: 'couple' | 'vendor';
  /**
   * Display label for the OTHER party. On the couple side that's the
   * vendor's business_name; on the vendor side that's the event's
   * display_name (per identity-masking — never the couple's personal name).
   */
  counterpartyLabel: string;
};

const TYPING_DEBOUNCE_MS = 700;
const TYPING_IDLE_MS = 3000;

export function ChatMessageStream({
  threadId,
  initialMessages,
  currentUserId,
  viewerRole,
  counterpartyLabel,
}: Props) {
  // Single Supabase client instance per mount — createClient is cheap but
  // the channel objects we attach to it must outlive each render.
  const supabase = useMemo(() => createClient(), []);

  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [counterpartyTyping, setCounterpartyTyping] = useState(false);

  // Scroll management: only auto-stick to bottom if the user IS near the
  // bottom. Tracking this in a ref (not state) avoids spurious re-renders
  // every time a scroll event fires.
  const listRef = useRef<HTMLOListElement | null>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Pin to the bottom on initial mount (no animation) so the user lands on
  // the latest message instead of the top of an old thread.
  useEffect(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  // ---------------------------------------------------------------------------
  // Postgres CHANGES subscription — new/updated messages on this thread.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const refetchAll = async () => {
      try {
        const fresh = await fetchMessages(supabase, threadId);
        if (cancelled) return;
        setMessages(fresh);
      } catch (err) {
        // Silent — Supabase auto-reconnects, the next event or refetch
        // will heal the gap. We don't want to render a scary error toast
        // for transient network blips. But we DO report so a persistent
        // fetchMessages failure (e.g. RLS / schema) is visible.
        void trackFailure({
          eventType: 'OTHER',
          elementName: 'Chat message stream refetch',
          filePath: 'app/_components/chat-message-stream.tsx',
          error: err,
          payload: { query: 'fetchMessages' },
        });
      }
    };

    const channel = supabase
      .channel(`chat-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) => {
            // Guard against the same INSERT echoing twice (e.g. on a
            // reconnect that replays the buffered event).
            if (prev.some((m) => m.message_id === row.message_id)) return prev;
            return [...prev, row].sort((a, b) =>
              a.created_at.localeCompare(b.created_at),
            );
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) =>
            prev.map((m) => (m.message_id === row.message_id ? row : m)),
          );
        },
      )
      .subscribe((status) => {
        // On (re)SUBSCRIBED — including reconnects after a network drop —
        // pull a fresh batch so we backfill anything missed while offline.
        if (status === 'SUBSCRIBED') {
          void refetchAll();
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, threadId]);

  // ---------------------------------------------------------------------------
  // Auto-scroll on new message (but only if the user was already at the bottom).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }, []);

  // ---------------------------------------------------------------------------
  // Presence channel — broadcast & receive typing state.
  // ---------------------------------------------------------------------------
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const typingActiveRef = useRef(false);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`chat-presence-${threadId}`, {
      config: { presence: { key: currentUserId } },
    });

    type TypingState = {
      typing?: boolean;
      role?: 'couple' | 'vendor';
    };

    const recompute = () => {
      const state = channel.presenceState<TypingState>();
      let othersTyping = false;
      for (const [key, metas] of Object.entries(state)) {
        if (key === currentUserId) continue;
        if (metas?.some((m) => m.typing === true)) {
          othersTyping = true;
          break;
        }
      }
      setCounterpartyTyping(othersTyping);
    };

    channel
      .on('presence', { event: 'sync' }, recompute)
      .on('presence', { event: 'join' }, recompute)
      .on('presence', { event: 'leave' }, recompute)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Announce our presence with typing=false so the other side knows
          // we're connected. track() returns a promise; we don't need to
          // await it but ignoring the result triggers no-floating-promise.
          await channel.track({ typing: false, role: viewerRole });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      presenceChannelRef.current = null;
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
      typingActiveRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, threadId, currentUserId, viewerRole]);

  const broadcastTyping = useCallback((typing: boolean) => {
    const channel = presenceChannelRef.current;
    if (!channel) return;
    typingActiveRef.current = typing;
    void channel.track({ typing, role: viewerRole });
  }, [viewerRole]);

  // Called by the send form on every keystroke. Debounces the "start
  // typing" broadcast so we don't burn presence updates on every letter,
  // and arms an idle timer to flip back to typing=false after 3s of no
  // input.
  const handleLocalTyping = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);

    typingDebounceRef.current = setTimeout(() => {
      if (!typingActiveRef.current) broadcastTyping(true);
    }, TYPING_DEBOUNCE_MS);

    typingIdleRef.current = setTimeout(() => {
      if (typingActiveRef.current) broadcastTyping(false);
    }, TYPING_IDLE_MS);
  }, [broadcastTyping]);

  // Called by the send form on submit — explicitly clear the typing flag
  // so the other side doesn't see a stale "still typing…" right after a
  // message lands.
  const handleSendClear = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    if (typingActiveRef.current) broadcastTyping(false);
  }, [broadcastTyping]);

  // Listen for the global "chat-stream:input" / "chat-stream:sent" events
  // dispatched by the surrounding form. This keeps the form a server-action
  // <form> (we don't take over send) — the stream just observes its events.
  useEffect(() => {
    const onInput = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId: string }>).detail;
      if (!detail || detail.threadId !== threadId) return;
      handleLocalTyping();
    };
    const onSent = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId: string }>).detail;
      if (!detail || detail.threadId !== threadId) return;
      handleSendClear();
    };
    window.addEventListener('chat-stream:input', onInput);
    window.addEventListener('chat-stream:sent', onSent);
    return () => {
      window.removeEventListener('chat-stream:input', onInput);
      window.removeEventListener('chat-stream:sent', onSent);
    };
  }, [threadId, handleLocalTyping, handleSendClear]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <ol
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-ink/10 bg-cream p-4"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.length === 0 ? (
        <li className="rounded-md border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          No messages yet — say hi to break the ice.
        </li>
      ) : (
        messages.map((m) => (
          <li
            key={m.message_id}
            className={`flex ${ownsBubble(m, viewerRole) ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                ownsBubble(m, viewerRole)
                  ? 'bg-terracotta text-cream'
                  : 'bg-ink/[0.06] text-ink'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p
                className={`mt-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                  ownsBubble(m, viewerRole) ? 'text-cream/70' : 'text-ink/50'
                }`}
              >
                {ownsBubble(m, viewerRole) ? 'You' : counterpartyLabel}
                {' · '}
                {formatChatTimestamp(m.created_at)}
              </p>
            </div>
          </li>
        ))
      )}
      {counterpartyTyping ? (
        <li className="flex justify-start" data-testid="typing-indicator">
          <div className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-3 py-1 text-xs text-ink/60">
            <span className="sr-only">{counterpartyLabel} is typing</span>
            <span aria-hidden>{counterpartyLabel} is typing</span>
            <span aria-hidden className="ml-1 inline-flex gap-0.5">
              <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40 [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40 [animation-delay:240ms]" />
            </span>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

function ownsBubble(
  m: { sender_role: ChatSenderRole },
  viewerRole: 'couple' | 'vendor',
): boolean {
  return m.sender_role === viewerRole;
}
