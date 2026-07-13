'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { startThreadCall } from '@/app/_actions/thread-call-actions';
import { ThreadCallRoom } from './thread-call-room';

/**
 * In-thread CALL entry (Relationship_Workspace_and_Appointments · "Call"; PR 10).
 * Renders ONLY inside an accepted thread's branch. Additive: it manages its own
 * open/closed state and self-fetches the incoming-call state, so dropping
 * <ThreadCallLauncher/> into a thread page is a one-line change that touches no
 * existing chat logic.
 *
 *   • "Start" (voice / video) → startThreadCall() inserts a ringing row + rings
 *     the other party, then opens the room.
 *   • Incoming banner → a `ringing` thread_calls row started by the OTHER party
 *     (server-fetched on mount + kept live via a Supabase Realtime subscription
 *     to thread_calls for this thread). "Join" opens the same room.
 *
 * Both sides join the same threadId-keyed P2P room, so whichever call row is
 * used, the two peers connect. Free P2P, STUN-only — see lib/call-webrtc.ts.
 */

type CallKind = 'voice' | 'video';
type OpenCall = { kind: CallKind; callId: string };
type Incoming = { callId: string; kind: CallKind };

// A ringing row older than this is treated as stale (the caller likely gave up
// or dropped) and does NOT raise the incoming banner. Live INSERTs are always
// fresh, so this only guards the initial server-fetch.
const RINGING_MAX_AGE_MS = 2 * 60 * 1000;

export function ThreadCallLauncher({
  threadId,
  currentUserId,
  counterpartyLabel = 'them',
  callsEnabled = true,
  viewerRole = 'couple',
  upgradeHref,
}: {
  threadId: string;
  currentUserId: string;
  counterpartyLabel?: string;
  /**
   * Whether calling is unlocked for this thread's vendor (paid tier + gate on).
   * Server-computed via resolveThreadCallsEnabled(). Defaults to true so the
   * launcher is unchanged wherever the prop isn't passed (gate-dark behaviour).
   */
  callsEnabled?: boolean;
  /** Who's viewing — tailors the locked-state copy (vendor sees an upgrade CTA). */
  viewerRole?: 'couple' | 'vendor';
  /** Vendor upsell target for the locked-state CTA (vendor viewer only). */
  upgradeHref?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState<OpenCall | null>(null);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [starting, setStarting] = useState<CallKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial incoming-call fetch (RLS-scoped) + live subscription.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('thread_calls')
        .select('call_id, kind, status, started_by_user_id, started_at')
        .eq('thread_id', threadId)
        .eq('status', 'ringing')
        .neq('started_by_user_id', currentUserId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const fresh =
        Date.now() - new Date(data.started_at as string).getTime() < RINGING_MAX_AGE_MS;
      if (fresh && (data.kind === 'voice' || data.kind === 'video')) {
        setIncoming({ callId: data.call_id as string, kind: data.kind });
      }
    })();

    const channel = supabase
      .channel(`thread-calls-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'thread_calls',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as {
            call_id: string;
            kind: CallKind;
            status: string;
            started_by_user_id: string | null;
          };
          if (row.status !== 'ringing') return;
          if (row.started_by_user_id === currentUserId) return;
          setIncoming({ callId: row.call_id, kind: row.kind });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'thread_calls',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as { call_id: string; status: string };
          // A call left the ringing state (ended / declined / missed / active) —
          // stop advertising it as an incoming call.
          if (row.status !== 'ringing') {
            setIncoming((prev) => (prev && prev.callId === row.call_id ? null : prev));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, threadId, currentUserId]);

  const start = useCallback(
    async (kind: CallKind) => {
      setError(null);
      setStarting(kind);
      try {
        const fd = new FormData();
        fd.set('thread_id', threadId);
        fd.set('kind', kind);
        const res = await startThreadCall(fd);
        if (res.ok) {
          setIncoming(null);
          setOpen({ kind: res.kind, callId: res.callId });
        } else {
          setError(res.error);
        }
      } catch {
        setError('Could not start the call. Please try again.');
      } finally {
        setStarting(null);
      }
    },
    [threadId],
  );

  const joinIncoming = () => {
    if (!incoming) return;
    setOpen({ kind: incoming.kind, callId: incoming.callId });
    setIncoming(null);
  };

  if (open) {
    return (
      <ThreadCallRoom
        threadId={threadId}
        kind={open.kind}
        callId={open.callId}
        counterpartyLabel={counterpartyLabel}
        onLeave={() => setOpen(null)}
      />
    );
  }

  // Calling is a paid-vendor capability. When it isn't unlocked for this
  // thread's vendor, the couple sees no call UI at all; the vendor sees a
  // locked pill pointing at the upgrade. The server action is the real gate —
  // this is just the matching UX so a live button can never mislead.
  if (!callsEnabled) {
    if (viewerRole !== 'vendor') return null;
    const nudge = (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-ink/[0.03] px-3 py-1.5 text-xs font-medium text-ink/55">
        <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Upgrade your plan to call clients
      </span>
    );
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
          Call {counterpartyLabel}
        </span>
        {upgradeHref ? (
          <Link href={upgradeHref} className="rounded-full transition hover:opacity-80">
            {nudge}
          </Link>
        ) : (
          nudge
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {incoming ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-mulberry/30 bg-mulberry/[0.06] px-4 py-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">Incoming {incoming.kind} call</span> from{' '}
            {counterpartyLabel}.
          </p>
          <button
            type="button"
            onClick={joinIncoming}
            className="inline-flex h-9 shrink-0 items-center rounded-full bg-mulberry px-4 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            Join
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
          Call {counterpartyLabel}
        </span>
        <button
          type="button"
          onClick={() => start('voice')}
          disabled={starting !== null}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/20 px-3 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          {starting === 'voice' ? 'Calling…' : 'Voice'}
        </button>
        <button
          type="button"
          onClick={() => start('video')}
          disabled={starting !== null}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/20 px-3 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          {starting === 'video' ? 'Calling…' : 'Video'}
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
