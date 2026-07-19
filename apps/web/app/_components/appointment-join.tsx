'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Video, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { startThreadCall } from '@/app/_actions/thread-call-actions';
import { ThreadCallRoom } from './thread-call-room';

/**
 * The live "Join" affordance for a CONFIRMED video/voice appointment
 * (Relationship_Workspace_and_Appointments · Appointments · PR 12 follow-ups).
 * Replaces the old deep-link stub: pressing Join opens the SAME free P2P call
 * room the thread uses (keyed `call:{threadId}`), so the two parties connect
 * directly — media never touches a Setnayan server (lib/call-webrtc.ts, NOT
 * modified here).
 *
 * The appointment already fixes the kind (video / voice), so this is a
 * single-button twin of <ThreadCallLauncher/>: it reuses the exact same
 * startThreadCall action + ThreadCallRoom + thread_calls realtime probe, just
 * presented as one "Join" button instead of the voice/video launcher pair.
 *
 *   • If the OTHER party already started a call on this thread (a fresh
 *     `ringing` thread_calls row, server-fetched on mount + kept live via a
 *     Supabase Realtime subscription), Join joins THAT call.
 *   • Otherwise Join starts a new call of the appointment's kind.
 *
 * Both paths land in `call:{threadId}`, so whichever row is used the peers meet.
 * Fail-soft: startThreadCall returning an error (e.g. thread not yet accepted)
 * surfaces inline and never throws.
 */

type CallKind = 'voice' | 'video';
type OpenCall = { kind: CallKind; callId: string };
type Incoming = { callId: string; kind: CallKind };

// A ringing row older than this is treated as stale and does NOT count as an
// incoming call. Live INSERTs are always fresh; this only guards the mount fetch.
const RINGING_MAX_AGE_MS = 2 * 60 * 1000;

export function AppointmentJoinButton({
  threadId,
  currentUserId,
  kind,
  counterpartyLabel = 'them',
}: {
  threadId: string;
  currentUserId: string;
  kind: CallKind;
  counterpartyLabel?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState<OpenCall | null>(null);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial incoming-call fetch (RLS-scoped) + live subscription. Identical
  // probe to ThreadCallLauncher so both surfaces agree on "is a call ringing".
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
      .channel(`appt-calls-${threadId}`)
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

  const join = useCallback(async () => {
    setError(null);
    // If the other side is already ringing, join their existing call.
    if (incoming) {
      setOpen({ kind: incoming.kind, callId: incoming.callId });
      setIncoming(null);
      return;
    }
    setStarting(true);
    try {
      const fd = new FormData();
      fd.set('thread_id', threadId);
      fd.set('kind', kind);
      const res = await startThreadCall(fd);
      if (res.ok) {
        setOpen({ kind: res.kind, callId: res.callId });
      } else {
        setError(res.error);
      }
    } catch {
      setError('Could not start the call. Please try again.');
    } finally {
      setStarting(false);
    }
  }, [incoming, threadId, kind]);

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

  const Icon = kind === 'video' ? Video : Phone;
  const ringing = Boolean(incoming);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={join}
        disabled={starting}
        className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-terracotta/90 disabled:opacity-60"
        aria-label={ringing ? `Join the incoming ${kind} call` : `Join the ${kind} call`}
      >
        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {starting ? 'Connecting…' : ringing ? 'Join now' : 'Join'}
      </button>
      {error ? <span className="text-[10px] text-danger-700">{error}</span> : null}
    </div>
  );
}
