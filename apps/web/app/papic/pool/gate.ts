import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryActive } from '@/lib/papic-pool-gate';

/**
 * Every "this page does not exist" the shared pool gives — the env / DPO gate off, the couple's toggle off — decided
 * by `./layout.tsx` BEFORE `./loading.tsx` streams, so the 404 is never sent as a 200, a skeleton and a client hop.
 * No session is not a 404: it is the "Open your invitation first." door, drawn by the page (`session: null`).
 * `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gatePapicPool = cache(async () => {
  if (!(await papicPoolGalleryActive())) notFound();

  const session = await readGuestSession();
  if (!session) return { session: null, ev: null };

  // Per-event couple toggle — when OFF this page simply doesn't exist (the
  // owner's "no dead door" rule). The RPC re-checks the same gate on every
  // read, so closing is retroactive even mid-session.
  const admin = createAdminClient();
  const { data: ev, error: evErr } = await admin
    .from('events')
    .select('display_name, pool_gallery_open, event_date, event_type, papic_window_start')
    .eq('event_id', session.event_id)
    .maybeSingle();
  // 🔌 A4-79: a failed read is not "the couple closed the gallery" (a 404) — it throws (the error boundary).
  if (evErr) throw new Error(`papic/pool: could not read the event: ${evErr.message}`);
  if (!ev?.pool_gallery_open) notFound();
  return { session, ev };
});
