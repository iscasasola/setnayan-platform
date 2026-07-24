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

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import {
  fetchMessages,
  formatChatTimestamp,
  type ChatMessageRow,
  type ChatSenderRole,
} from '@/lib/chat';
import { formatCentavos, PROPOSAL_STATUS_LABEL } from '@/lib/vendor-proposals';
import { trackFailure } from '@/lib/telemetry/track-error';
import { chatNegotiationEnabled } from '@/lib/chat-negotiation-flag';
import { detectNegotiation } from '@/lib/chat-negotiation-detect';
import { ChatAppointmentCard, type ChatAppointmentData } from './chat-appointment-card';
import { ScheduleSuggestChip } from './schedule-suggest-chip';
import type { AppointmentKind } from '@/lib/appointments';

/** Display data for the in-thread proposal card, fetched by proposal_id. */
type ProposalCardData = {
  publicId: string;
  title: string;
  totalCentavos: number;
  status: string;
};

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

  // Proposal cards: a message with proposal_id renders as a card. We fetch the
  // proposal's display data (RLS-scoped: couple reads sent proposals on their
  // events, vendor reads their own) once per id, for both SSR + realtime rows.
  const [proposalCards, setProposalCards] = useState<Record<string, ProposalCardData>>({});
  const requestedProposalsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = [
      ...new Set(messages.map((m) => m.proposal_id).filter((x): x is string => !!x)),
    ].filter((id) => !requestedProposalsRef.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => requestedProposalsRef.current.add(id));
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('vendor_proposals')
        .select('proposal_id, public_id, title, total_centavos, status')
        .in('proposal_id', ids);
      if (cancelled || !data) return;
      setProposalCards((prev) => {
        const next = { ...prev };
        for (const p of data as {
          proposal_id: string;
          public_id: string;
          title: string;
          total_centavos: number;
          status: string;
        }[]) {
          next[p.proposal_id] = {
            publicId: p.public_id,
            title: p.title,
            totalCentavos: p.total_centavos,
            status: p.status,
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, supabase]);

  // Appointment cards (negotiation auto-reader Phase 1): a message with
  // appointment_id renders as a schedule request card. Fetch the appointment's
  // live display data (RLS-scoped) once per id, refetched whenever the message
  // set changes so a status flip (accept / decline / propose-new) repaints.
  const negotiationOn = chatNegotiationEnabled();
  const [appointmentCards, setAppointmentCards] = useState<Record<string, ChatAppointmentData>>({});
  useEffect(() => {
    if (!negotiationOn) return;
    const ids = [
      ...new Set(messages.map((m) => m.appointment_id).filter((x): x is string => !!x)),
    ];
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('event_appointments')
        .select('appointment_id, kind, type, custom_label, scheduled_at, status, initiated_by')
        .in('appointment_id', ids);
      if (cancelled || !data) return;
      setAppointmentCards(() => {
        const next: Record<string, ChatAppointmentData> = {};
        for (const a of data as Array<{
          appointment_id: string;
          kind: AppointmentKind;
          type: string;
          custom_label: string | null;
          scheduled_at: string | null;
          status: ChatAppointmentData['status'];
          initiated_by: ChatAppointmentData['initiated_by'];
        }>) {
          next[a.appointment_id] = {
            appointment_id: a.appointment_id,
            kind: a.kind,
            label: a.custom_label?.trim() || 'Meeting',
            scheduled_at: a.scheduled_at,
            status: a.status,
            initiated_by: a.initiated_by,
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, supabase, negotiationOn]);

  // In-app path back to THIS thread page — the return target for negotiation
  // server actions (appointment create / respond redirect + revalidate here).
  const returnPathFor = useCallback(
    (m: ChatMessageRow) =>
      viewerRole === 'couple'
        ? `/dashboard/${m.event_id}/messages/${threadId}`
        : `/vendor-dashboard/messages/${threadId}`,
    [viewerRole, threadId],
  );

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
        messages.map((m) => {
          // Proposal cards — a vendor-sent structured proposal lands in the
          // thread. Render the card (title · price · status + a Review/View
          // link to the existing /proposals page) instead of a plain bubble;
          // fall back to the message body until the card data loads.
          if (m.proposal_id) {
            const card = proposalCards[m.proposal_id];
            return (
              <li key={m.message_id} className="flex justify-center">
                <div className="w-full max-w-[92%] rounded-xl border border-terracotta/40 bg-terracotta/[0.06] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                    📄 Proposal
                  </p>
                  {card ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-ink">{card.title}</p>
                      <p className="text-sm text-ink/70">
                        {card.totalCentavos > 0
                          ? formatCentavos(card.totalCentavos)
                          : 'Price on request'}
                        {' · '}
                        {PROPOSAL_STATUS_LABEL[
                          card.status as keyof typeof PROPOSAL_STATUS_LABEL
                        ] ?? card.status}
                      </p>
                      <Link
                        href={`/proposals/${card.publicId}`}
                        className="mt-2 inline-flex h-9 items-center rounded-lg bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
                      >
                        {viewerRole === 'couple' ? 'Review & accept' : 'View proposal'}
                      </Link>
                    </>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink/80">
                      {m.body}
                    </p>
                  )}
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                    {formatChatTimestamp(m.created_at)}
                  </p>
                </div>
              </li>
            );
          }
          // Appointment cards (negotiation Phase 1): a message with
          // appointment_id renders the schedule request card with the
          // counterparty's accept / propose-new-time / decline actions. Falls
          // back to the message body until the appointment data loads. Only when
          // the flag is on — off, it degrades to a plain bubble (body is a
          // readable "📅 Meeting request: …").
          if (negotiationOn && m.appointment_id) {
            const appt = appointmentCards[m.appointment_id];
            return (
              <li key={m.message_id} className="flex justify-center">
                {appt ? (
                  <ChatAppointmentCard
                    data={appt}
                    viewerRole={viewerRole}
                    eventId={m.event_id}
                    vendorProfileId={m.vendor_profile_id}
                    returnPath={returnPathFor(m)}
                  />
                ) : (
                  <div className="w-full max-w-[92%] rounded-xl border border-terracotta/40 bg-terracotta/[0.06] p-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-ink/80">{m.body}</p>
                  </div>
                )}
              </li>
            );
          }
          // System messages (e.g. the Build re-quote nudge) are automated
          // Setnayan notes — centered, owned by neither side, labelled
          // "Setnayan". Never "from the couple"/"from the vendor".
          if (m.sender_role === 'system') {
            return (
              <li key={m.message_id} className="flex justify-center">
                <div className="max-w-[90%] rounded-xl border border-mulberry/20 bg-mulberry/[0.06] px-3 py-2 text-center text-sm text-ink">
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-mulberry/70">
                    Setnayan · {formatChatTimestamp(m.created_at)}
                  </p>
                </div>
              </li>
            );
          }
          return (
            <li
              key={m.message_id}
              className={`flex flex-col ${ownsBubble(m, viewerRole) ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  ownsBubble(m, viewerRole)
                    ? 'bg-terracotta text-cream'
                    : 'bg-ink/[0.06] text-ink'
                }`}
              >
                {m.body ? (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                ) : null}
                {m.attachment_url ? (
                  <AttachmentBlock
                    url={m.attachment_url}
                    name={m.attachment_name ?? null}
                    mime={m.attachment_mime ?? null}
                    sizeBytes={m.attachment_size_bytes ?? null}
                    owns={ownsBubble(m, viewerRole)}
                    hasBody={!!m.body}
                  />
                ) : null}
                <p
                  className={`mt-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    ownsBubble(m, viewerRole) ? 'text-cream/70' : 'text-ink/50'
                  }`}
                >
                  {/* AI-disclosure label (vendor-autoreply §2B): a bot message
                      is NEVER presented as a human. The couple sees it under
                      the vendor's name with an explicit AI tag; the vendor
                      sees the same tag instead of "You" (it wasn't them).
                      Copy is the §8 candidate string, pending owner sign-off. */}
                  {m.is_bot
                    ? viewerRole === 'vendor' && ownsBubble(m, viewerRole)
                      ? '⚡ AI auto-reply'
                      : `⚡ AI auto-reply · ${counterpartyLabel}`
                    : ownsBubble(m, viewerRole)
                      ? 'You'
                      : counterpartyLabel}
                  {' · '}
                  {formatChatTimestamp(m.created_at)}
                </p>
              </div>
              {/* Negotiation auto-reader (Phase 1): under the sender's OWN
                  message, if the deterministic reader flags a meeting topic,
                  offer a one-tap "set up this meeting" chip. Suggestion-grade —
                  nothing is created until they tap + confirm. Flag-gated. */}
              {negotiationOn &&
              ownsBubble(m, viewerRole) &&
              !m.proposal_id &&
              !m.appointment_id &&
              m.body &&
              detectNegotiation(m.body).primary === 'schedule' ? (
                <ScheduleSuggestChip
                  threadId={threadId}
                  returnPath={returnPathFor(m)}
                  body={m.body}
                />
              ) : null}
            </li>
          );
        })
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

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

/**
 * Renders an in-bubble attachment. Image MIMEs get a lazy <img> thumbnail that
 * links to the full-size file; everything else (PDF / doc) renders a compact
 * file chip with the name, size, and an open/download link. The bytes live on
 * public R2 (chat file sharing, PR 2) — signed-URL hardening is a follow-up.
 */
function AttachmentBlock({
  url,
  name,
  mime,
  sizeBytes,
  owns,
  hasBody,
}: {
  url: string;
  name: string | null;
  mime: string | null;
  sizeBytes: number | null;
  owns: boolean;
  hasBody: boolean;
}) {
  const isImage = (mime ?? '').startsWith('image/');
  const label = name?.trim() || (isImage ? 'Image' : 'Attachment');
  const size = formatBytes(sizeBytes);

  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block overflow-hidden rounded-xl ${hasBody ? 'mt-2' : ''}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 asset; next/image needs a configured loader/domain for arbitrary R2 hosts */}
        <img
          src={url}
          alt={label}
          loading="lazy"
          className="max-h-64 max-w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name ?? undefined}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
        hasBody ? 'mt-2' : ''
      } ${
        owns
          ? 'bg-cream/20 text-cream hover:bg-cream/30'
          : 'bg-ink/[0.06] text-ink hover:bg-ink/10'
      }`}
    >
      <FileText className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {size ? (
          <span className={`block text-[11px] ${owns ? 'text-cream/70' : 'text-ink/55'}`}>
            {size}
          </span>
        ) : null}
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
    </a>
  );
}
