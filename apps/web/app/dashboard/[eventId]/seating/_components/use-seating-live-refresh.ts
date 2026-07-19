'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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

  useEffect(() => {
    if (!enabled || !eventId) return;
    const supabase = createClient();

    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      // Coalesce the row-writes of one save (a link touches 2+ tables; an
      // auto-seat touches many assignments) into a single refresh.
      timer.current = setTimeout(() => router.refresh(), 350);
    };

    const channel = supabase.channel(`seating-plan:${eventId}`);
    for (const table of ['event_tables', 'event_seat_assignments', 'event_floor_plan'] as const) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `event_id=eq.${eventId}` },
        bump,
      );
    }
    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, eventId, router]);
}
