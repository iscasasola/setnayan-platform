'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Exclusive seating-editor lock (PR 2 · owner lock 2026-06-13) — ONE editor at
 * a time per event, co-owners included. The second person to open the plan (a
 * partner, or a delegated coordinator with the seat_plan='edit' grant) lands in
 * VIEW-ONLY until the holder leaves or their heartbeat goes stale.
 *
 * Lifecycle:
 *   1. acquire-on-edit — the editor calls acquire() the first time the user
 *      tries to change anything (or on mount; the caller decides). The DB RPC
 *      decides: acquired | refreshed (already mine) | took_over (peer stale) |
 *      held_by_other (live peer → view-only).
 *   2. 30s heartbeat — while we hold it, refresh_seating_editor_lock keeps the
 *      lock warm. A 'lost' result (a peer took over after a >90s gap, or the
 *      lock was released) flips us to view-only. Heartbeat is best-effort: a
 *      transient network error never throws.
 *   3. release-on-unmount + pagehide — release_seating_editor_lock on unmount
 *      (reliable) and a best-effort release on pagehide so a tab close /
 *      navigation usually frees the lock promptly. The pagehide release has no
 *      keepalive (supabase-js doesn't expose one) so the browser may drop it
 *      mid-unload; the 90s server stale-takeover is the guaranteed backstop.
 *   4. stale-takeover — when held_by_other, the editor surfaces a "Take over
 *      editing" button that calls acquire() again; the DB grants it iff the
 *      peer's heartbeat is now older than 90s (server clock). Staleness is
 *      judged against the FRESHEST heartbeat we know — our frozen acquire
 *      envelope OR the holder's live presence beat (liveHolderHeartbeatAt fed
 *      in by the editor) — so a live holder never trips a false takeover.
 *
 * Server clock is authoritative for staleness — the client never decides
 * expiry locally (clock skew would corrupt the single-editor invariant).
 */

const HEARTBEAT_MS = 30_000;

export type SeatingLockStatus =
  // Initial: we haven't tried to acquire yet (pure viewing, no edit attempted).
  | 'idle'
  // An acquire() round-trip is in flight.
  | 'acquiring'
  // We hold the lock — editing is enabled.
  | 'editing'
  // A live peer holds it — view-only, no takeover yet.
  | 'view_only'
  // A peer holds it but their heartbeat is stale — takeover is available.
  | 'stale_takeover_available';

export type SeatingLock = {
  status: SeatingLockStatus;
  /** Our active lock id when status==='editing'; null otherwise. */
  lockId: string | null;
  /** Label of whoever currently holds it (peer when view-only, us when editing). */
  holderLabel: string | null;
  /** The holder's last server heartbeat (ISO) when known — peers read this. */
  holderHeartbeatAt: string | null;
  /** Acquire (or take over) the lock. Idempotent; safe to call repeatedly. */
  acquire: () => void;
  /**
   * Drop our client to view-only immediately. Called when a gated mutation
   * comes back with the server's lock-lost error (a peer took over during the
   * <=30s gap before our heartbeat would have noticed) so the UI reacts at once
   * instead of letting the user keep "editing" against a lock we no longer hold.
   * No-op when we're already not editing.
   */
  notifyLost: () => void;
};

type AcquireEnvelope = {
  status?: string;
  lock_id?: string;
  holder_label?: string;
  holder_user_id?: string;
  last_heartbeat_at?: string;
};

export function useSeatingLock(
  eventId: string,
  /** Display name stamped as the holder label (peers see "X is editing"). */
  label: string,
  /**
   * Live holder heartbeat from PRESENCE (lockHolderPeer.lockHeartbeatAt), fed
   * back in by the editor. The acquire() envelope only ever gives us the
   * holder's heartbeat ONCE (at the moment we hit held_by_other) and it then
   * goes stale in our own state — so a view-only peer would falsely flip to
   * 'stale_takeover_available' ~90s later even while the holder is heartbeating
   * every 30s. We compute staleness from the FRESHEST known heartbeat (the max
   * of our frozen envelope value and this live presence value), so the takeover
   * button only appears when the holder has genuinely gone silent >90s.
   * Optional / nullable: null when no peer is broadcasting a lock yet.
   */
  liveHolderHeartbeatAt?: string | null,
): SeatingLock {
  const [status, setStatus] = useState<SeatingLockStatus>('idle');
  const [lockId, setLockId] = useState<string | null>(null);
  const [holderLabel, setHolderLabel] = useState<string | null>(null);
  const [holderHeartbeatAt, setHolderHeartbeatAt] = useState<string | null>(null);

  // Mirror lockId in a ref so the heartbeat interval + unmount cleanup read the
  // live value without re-subscribing.
  const lockIdRef = useRef<string | null>(null);
  lockIdRef.current = lockId;
  const labelRef = useRef(label);
  labelRef.current = label;
  // Guards against overlapping acquire() round-trips.
  const acquiringRef = useRef(false);
  // One-shot auto-retry guard: a transient acquire() failure (network blip on
  // mount) would otherwise strand a SOLO user in view-only with no peer banner
  // to surface the "Take over" button. We auto-retry exactly once; a manual
  // "Retry editing" affordance (rendered by the editor whenever !canEdit) is the
  // backstop after that.
  const autoRetriedRef = useRef(false);

  const acquire = useCallback(() => {
    if (acquiringRef.current) return;
    acquiringRef.current = true;
    setStatus((s) => (s === 'editing' ? s : 'acquiring'));
    const supabase = createClient();
    void supabase
      .rpc('acquire_seating_editor_lock', { p_event_id: eventId, p_label: labelRef.current })
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        acquiringRef.current = false;
        if (error || !data) {
          // Couldn't reach the lock service — stay view-only rather than
          // silently letting the user edit unguarded (every mutation re-asserts
          // server-side anyway, so this is purely a UX state). Auto-retry ONCE
          // on the first transient failure so a network blip on mount doesn't
          // strand a solo editor; after that the manual retry control takes over.
          setStatus((s) => (s === 'editing' ? s : 'view_only'));
          if (!autoRetriedRef.current) {
            autoRetriedRef.current = true;
            setTimeout(() => acquireRef.current(), 1_500);
          }
          return;
        }
        // A clean round-trip re-arms the one-shot auto-retry for the next blip.
        autoRetriedRef.current = false;
        const env = data as AcquireEnvelope;
        switch (env.status) {
          case 'acquired':
          case 'refreshed':
          case 'took_over':
            setLockId(env.lock_id ?? null);
            setHolderLabel(env.holder_label ?? labelRef.current);
            setHolderHeartbeatAt(env.last_heartbeat_at ?? null);
            setStatus('editing');
            break;
          case 'held_by_other':
            setLockId(null);
            setHolderLabel(env.holder_label ?? 'Someone');
            setHolderHeartbeatAt(env.last_heartbeat_at ?? null);
            setStatus('view_only');
            break;
          default:
            // not_authorized or anything unexpected → view-only.
            setLockId(null);
            setStatus('view_only');
        }
      });
  }, [eventId]);
  // Stable handle for the deferred auto-retry above (the setTimeout closure
  // fires after acquire() returns, so it reads the latest callback off the ref).
  const acquireRef = useRef(acquire);
  acquireRef.current = acquire;

  // 30s heartbeat while we hold the lock. 'lost' → a peer took over → view-only.
  useEffect(() => {
    if (status !== 'editing' || !lockId) return;
    const supabase = createClient();
    const id = setInterval(() => {
      const lid = lockIdRef.current;
      if (!lid) return;
      void supabase
        .rpc('refresh_seating_editor_lock', { p_lock_id: lid })
        .then(({ data, error }: { data: unknown; error: unknown }) => {
          if (error) return; // best-effort; transient errors don't evict us.
          const env = data as { status?: string; last_heartbeat_at?: string };
          if (env?.status === 'lost') {
            setLockId(null);
            setHolderHeartbeatAt(null);
            // A peer holds it now; offer takeover after the next stale window.
            setStatus('view_only');
          } else if (env?.last_heartbeat_at) {
            setHolderHeartbeatAt(env.last_heartbeat_at);
          }
        });
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [status, lockId]);

  // Release on unmount + on pagehide (tab close / navigation). pagehide fires a
  // best-effort release so the lock frees promptly instead of waiting out the
  // 90s stale window. NOTE: this is genuinely best-effort — the Supabase rpc()
  // is a normal fetch with no keepalive flag set (the supabase-js client doesn't
  // expose a per-call keepalive option, and sendBeacon can't carry the Supabase
  // auth header), so the browser MAY drop the request mid-unload. The real,
  // guaranteed backstop is the server-side 90s stale-takeover: even if this
  // release never lands, the lock self-expires and a peer can take over. The
  // unmount path (SPA navigation, view toggle) is reliable; only true tab-close
  // depends on the stale window.
  useEffect(() => {
    const releaseNow = () => {
      const lid = lockIdRef.current;
      if (!lid) return;
      const supabase = createClient();
      // Best-effort release; no keepalive (see note above) — the 90s server
      // stale-takeover is the real backstop if this is dropped during unload.
      void supabase.rpc('release_seating_editor_lock', { p_lock_id: lid });
      lockIdRef.current = null;
    };
    const onPageHide = () => releaseNow();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      releaseNow();
    };
  }, []);

  // When view-only, poll the holder's freshness lightly so the "Take over"
  // button appears once their heartbeat crosses the 90s stale line. The actual
  // takeover is still a user click on acquire() (the DB grants it iff the peer
  // is genuinely stale server-side). Staleness is computed from the FRESHEST
  // heartbeat we know: our own frozen acquire-envelope value (holderHeartbeatAt)
  // is only captured ONCE and goes stale in our state — but the editor feeds the
  // holder's LIVE presence heartbeat back in via liveHolderHeartbeatAt, which the
  // holder re-broadcasts on every 30s heartbeat. Taking max() of the two means a
  // live holder keeps us in view_only; only a holder who has actually gone silent
  // for >90s (no fresh presence beat) crosses the stale line.
  useEffect(() => {
    if (status !== 'view_only' && status !== 'stale_takeover_available') return;
    const tick = () => {
      // Newest of the frozen envelope value and the live presence value.
      const frozenMs = holderHeartbeatAt ? new Date(holderHeartbeatAt).getTime() : NaN;
      const liveMs = liveHolderHeartbeatAt ? new Date(liveHolderHeartbeatAt).getTime() : NaN;
      const freshestMs = Math.max(
        Number.isNaN(frozenMs) ? -Infinity : frozenMs,
        Number.isNaN(liveMs) ? -Infinity : liveMs,
      );
      if (!Number.isFinite(freshestMs)) return; // no heartbeat known either way
      const ageMs = Date.now() - freshestMs;
      setStatus((s) => {
        if (s !== 'view_only' && s !== 'stale_takeover_available') return s;
        return ageMs > 90_000 ? 'stale_takeover_available' : 'view_only';
      });
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [status, holderHeartbeatAt, liveHolderHeartbeatAt]);

  // Drop to view-only on a server-reported lock loss (see SeatingLock.notifyLost).
  // We clear our lock id and flip out of 'editing'; the view-only freshness poll
  // above then governs when a takeover becomes available again.
  const notifyLost = useCallback(() => {
    setStatus((s) => (s === 'editing' || s === 'acquiring' ? 'view_only' : s));
    setLockId(null);
    lockIdRef.current = null;
  }, []);

  return { status, lockId, holderLabel, holderHeartbeatAt, acquire, notifyLost };
}
