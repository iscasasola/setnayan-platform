'use client';

/**
 * ✍️ usePartEditorLock — ONE EDITOR PER PART, the client half (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW + ONE
 * EDITOR PER PART — APPROVED TO BUILD"). Extends the shipped seating lock (`seating/_components/use-seating-lock.ts`):
 * the same "the database decides" envelope, a per-PART row instead of one per event, and a 5 s window instead of 90.
 *
 *   1 · ACQUIRE ON THE FIRST EDIT — `edited()` is called by the gate on every input / change / submit inside the part.
 *       Free → `acquire_part_editor_lock` makes it mine; held by a live peer → the part goes read-only.
 *   2 · TOUCH — while mine, each edit touches (at most every {@link TOUCH_EVERY_MS}); the server frees the part
 *       {@link PART_FREES_AFTER_MS} after the last one. A touch answering `taken_over` means a host bumped me.
 *   3 · WATCH — while the part is open and the tab visible, `part_editor_lock_state` is asked every
 *       {@link WATCH_EVERY_MS}: who is editing, whether it just became free, whether a host took it from me.
 *   4 · RELEASE — on unmount and pagehide (best effort; the 5 s window is the real backstop).
 *   5 · TAKE OVER — a host only (`can_take_over`; the server re-checks).
 *
 * A failed read keeps the last known state and never says "free" (`readPartLockState` → `unknown`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pauseWhileHidden } from '@/lib/tab-return';
import {
  TOUCH_EVERY_MS,
  WATCH_EVERY_MS,
  UNKNOWN_LOCK,
  lockMoment,
  readPartLockState,
  type EditPart,
  type LockMoment,
  type PartLockState,
} from '@/lib/part-editor-lock';

export type PartEditorLock = {
  state: PartLockState;
  /** The last moment worth a line in the bar (became free / taken over). Cleared by `clearMoment`. */
  moment: LockMoment;
  clearMoment: () => void;
  /** Call on every edit inside the part. Returns false when someone else holds it (the edit should not stand). */
  edited: () => boolean;
  /** A host takes the part from whoever holds it. */
  takeOver: () => Promise<boolean>;
  /** Claim the part now (Put it back). Resolves true when it is mine. */
  claim: () => Promise<boolean>;
};

type Env = { status?: string; lock_id?: string; holder_label?: string; holder_is_host?: boolean; taken_by_label?: string };

export function usePartEditorLock(eventId: string, part: EditPart, label: string): PartEditorLock {
  const [state, setState] = useState<PartLockState>(UNKNOWN_LOCK);
  const [moment, setMoment] = useState<LockMoment>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lockIdRef = useRef<string | null>(null);
  const lastTouchRef = useRef(0);
  const inFlightRef = useRef(false);
  const labelRef = useRef(label);
  labelRef.current = label;
  // The take-over already told (its `bumped_at`), so a later read does not tell it again.
  const toldBumpRef = useRef<string | null>(null);

  const apply = useCallback((next: PartLockState) => {
    const m = lockMoment(stateRef.current, next, toldBumpRef.current);
    if (m?.kind === 'taken_over') toldBumpRef.current = m.at;
    if (m) setMoment(m);
    stateRef.current = next;
    setState(next);
  }, []);

  const read = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('part_editor_lock_state', { p_event_id: eventId, p_part: part });
    if (error) return; // keep what we knew; never "free" on a failure
    apply(readPartLockState(data));
  }, [eventId, part, apply]);

  const acquire = useCallback(
    async (takeOver: boolean): Promise<boolean> => {
      if (inFlightRef.current) return stateRef.current.status === 'mine';
      inFlightRef.current = true;
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('acquire_part_editor_lock', {
          p_event_id: eventId,
          p_part: part,
          p_label: labelRef.current,
          p_take_over: takeOver,
        });
        if (error || !data) return false;
        const env = data as Env;
        if (env.status === 'acquired' || env.status === 'refreshed' || env.status === 'took_over') {
          lockIdRef.current = env.lock_id ?? null;
          lastTouchRef.current = Date.now();
          apply({ ...stateRef.current, status: 'mine', holderLabel: null, canTakeOver: false, takenByLabel: null, bumpedAt: null });
          return true;
        }
        if (env.status === 'held_by_other') {
          apply({ ...stateRef.current, status: 'held', holderLabel: env.holder_label ?? 'Someone', holderIsHost: env.holder_is_host === true });
        }
        return false;
      } finally {
        inFlightRef.current = false;
      }
    },
    [eventId, part, apply],
  );

  const touch = useCallback(async () => {
    const lid = lockIdRef.current;
    if (!lid) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc('touch_part_editor_lock', { p_lock_id: lid });
    if (error || !data) return; // best effort — the next edit or read says what is true
    const env = data as Env;
    if (env.status === 'taken_over' || env.status === 'lost') {
      lockIdRef.current = null;
      void read();
    }
  }, [read]);

  const edited = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.status === 'held') return false;
    if (s.status === 'not_authorized') return true; // not ours to lock — the page's own gate decides
    if (s.status === 'mine' && lockIdRef.current) {
      if (Date.now() - lastTouchRef.current >= TOUCH_EVERY_MS) {
        lastTouchRef.current = Date.now();
        void touch();
      }
      return true;
    }
    void acquire(false);
    return true;
  }, [acquire, touch]);

  // Watch while the part is open and the tab is visible.
  useEffect(() => {
    return pauseWhileHidden(() => {
      void read();
      const id = setInterval(() => void read(), WATCH_EVERY_MS);
      return () => clearInterval(id);
    });
  }, [read]);

  // Release on leave (best effort — the 5 s window frees it anyway).
  useEffect(() => {
    const releaseNow = () => {
      const lid = lockIdRef.current;
      if (!lid) return;
      lockIdRef.current = null;
      void createClient().rpc('release_part_editor_lock', { p_lock_id: lid });
    };
    window.addEventListener('pagehide', releaseNow);
    return () => {
      window.removeEventListener('pagehide', releaseNow);
      releaseNow();
    };
  }, []);

  return {
    state,
    moment,
    clearMoment: useCallback(() => setMoment(null), []),
    edited,
    takeOver: useCallback(() => acquire(true), [acquire]),
    claim: useCallback(() => acquire(false), [acquire]),
  };
}
