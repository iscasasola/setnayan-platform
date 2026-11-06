'use client';

import { useEffect, useId, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { pauseWhileHidden } from '@/lib/tab-return';

/**
 * Live seat-plan sync (2026-07-10) — makes a VIEW-ONLY surface follow the
 * editor's changes instantly, so the 2D editor and 3D lab agree without a
 * manual reload. Subscribes to Realtime changes on the three plan tables
 * (`event_tables`, `event_seat_assignments`, `event_floor_plan` — opted into
 * the `supabase_realtime` publication by 20270711955398) filtered to this
 * event, and debounces a `router.refresh()` so a burst of row writes from one
 * save coalesces into a single re-fetch.
 *
 * ⚠ ONLY the view-only surface subscribes (`enabled` = NOT holding the edit
 * lock). The EDITING surface must never auto-refresh — a refresh mid-drag could
 * clobber its optimistic layout — and it's the sole editor anyway (the lock
 * guarantees one editor per event), so it has no peer changes to receive.
 * Realtime honors RLS, so a viewer only gets events for events they can see.
 *
 * Known gap: the lock is keyed by USER, so the SAME person editing in two tabs
 * has `enabled=false` in both → they don't live-sync to each other (and can
 * diverge). That's a lock-design issue, out of scope here.
 */
export function useSeatingLiveRefresh(eventId: string, enabled: boolean): void {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instance = useId().replace(/[^A-Za-z0-9]/g, '');

  useEffect(() => {
    if (!enabled || !eventId) return;
    const supabase = createClient();

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      // Coalesce the row-writes of one save (a link touches 2+ tables; an
      // auto-seat touches many assignments) into a single refresh.
      // one-render: keep (realtime) — a seat-plan row changed (realtime); coalesced into one re-read.
      timer.current = setTimeout(() => router.refresh(), 350);
    };

    // 🔌 A plan left in a background tab lets the channel go after a while (`pauseWhileHidden`). Coming back opens
    // it again — and a re-SUBSCRIBED re-reads once, because the editor may have moved tables meanwhile.
    let subscribedOnce = false;
    const stop = pauseWhileHidden(() => {
      // 🔀 ONE TOPIC PER SUBSCRIBER. Guests › Seats mounts the 2D plan AND the 3D room, and both are view-only whenever
      // someone else holds the lock (the 3D room is view-only always, owner 2026-10-30). supabase-js hands back the SAME
      // channel object for a topic it already holds, so the second surface's `.on()` landed on a subscribed channel and
      // threw ("cannot add `postgres_changes` callbacks … after `subscribe()`") — the whole page fell to the error screen.
      const channel = supabase.channel(`seating-plan:${eventId}:${instance}`);
      for (const table of ['event_tables', 'event_seat_assignments', 'event_floor_plan'] as const) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `event_id=eq.${eventId}` },
          bump,
        );
      }
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (subscribedOnce) bump();
        subscribedOnce = true;
      });
      return () => supabase.removeChannel(channel);
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      stop();
    };
  }, [enabled, eventId, router, instance]);
}
