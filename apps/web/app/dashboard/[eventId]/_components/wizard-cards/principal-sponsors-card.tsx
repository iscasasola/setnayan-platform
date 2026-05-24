/**
 * Card 20 Lock Principal Sponsors · WAVE 2 · inline list builder.
 *
 * Server component shell · fetches the host's existing principal sponsor
 * pairs from event_sponsors and hands them to the inline client UI. The
 * full /sponsors page still exists for secondary tiers (cord · veil · coin
 * · candle) and richer per-sponsor editing (relationship notes · email ·
 * phone · invitation templates · response tracking); Card 20's job is to
 * get the load-bearing FIRST PASS of principal sponsors locked into the
 * wizard so the host can advance.
 *
 * Owner-locked constraint (CLAUDE.md 2026-05-23 Sixth row + this PR brief):
 * NO LINKS inside the focus card. The host adds principal sponsor pairs
 * inline (ninong + ninang in one shot, sharing a pair_index) and clicks
 * [Mark sponsors done] to advance. A polite cross-link to the full
 * /sponsors page lives OUTSIDE the focus card (in the dashboard chrome
 * via the existing sub-nav) for hosts who want richer editing.
 *
 * Entry point: WizardHero dispatcher (wizard-hero.tsx) renders this when
 * resolveWizardFocus returns task.id === 'principal_sponsors'.
 */

import { createClient } from '@/lib/supabase/server';
import { PrincipalSponsorsCardClient } from './principal-sponsors-card-client';

type Props = {
  eventId: string;
};

type SponsorRow = {
  id: string;
  pair_index: number | null;
  side: 'groom' | 'bride' | 'neutral';
  full_name: string;
  invitation_status: string;
};

export async function PrincipalSponsorsCard({ eventId }: Props) {
  const supabase = await createClient();

  // RLS-gated read — the policy on event_sponsors only returns rows for
  // events the auth.uid() owns/co-hosts (event_moderators OR legacy
  // event_members 'couple' row).
  const { data: rowsRaw } = await supabase
    .from('event_sponsors')
    .select('id, pair_index, side, full_name, invitation_status')
    .eq('event_id', eventId)
    .eq('sponsor_tier', 'principal')
    .order('pair_index', { ascending: true, nullsFirst: false })
    .order('side', { ascending: true });

  const rows = (rowsRaw ?? []) as ReadonlyArray<SponsorRow>;

  // Group rows by pair_index so the client renders one card per pair
  // instead of two separate rows per ninong/ninang. Rows without a
  // pair_index (rare · solo principals from /sponsors edits) fall into
  // their own pseudo-pair slots so they're still visible.
  const pairMap = new Map<
    string,
    { pairIndex: number | null; sponsors: SponsorRow[] }
  >();
  let unpairedCounter = 0;
  for (const row of rows) {
    const key =
      row.pair_index !== null ? `pair-${row.pair_index}` : `solo-${unpairedCounter++}`;
    const bucket = pairMap.get(key);
    if (bucket) {
      bucket.sponsors.push(row);
    } else {
      pairMap.set(key, { pairIndex: row.pair_index, sponsors: [row] });
    }
  }

  const pairs = Array.from(pairMap.values()).map((bucket) => ({
    pairIndex: bucket.pairIndex,
    sponsors: bucket.sponsors,
  }));

  return <PrincipalSponsorsCardClient eventId={eventId} pairs={pairs} />;
}
