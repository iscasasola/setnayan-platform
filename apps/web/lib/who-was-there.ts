import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * WHO WAS THERE — the ninong, the ninang, the abay, on a person's public page.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Research across the field found the same hole everywhere: every competitor's
 * couple page names exactly two people. The judge who read it as a Filipina
 * bride put it plainly — *"a Filipino wedding is ninong and ninang, the abay,
 * the entourage, the tita who carried the flowers. The people she is sending
 * the link to are looking for themselves, and they are not there."*
 *
 * 🔑 RULE 0 PAID: NONE OF THIS DATA IS NEW. `event_sponsors` has shipped since
 * 2026-06-04 with the Filipino structure already right — principal sponsors
 * pair-grouped by `pair_index`, and the four secondary tiers (cord · veil ·
 * coin · candle) each an independent slot, because one half of a pair may
 * accept while the other declines.
 *
 * ── 🔒 THE CONSENT GATE, AND IT IS THE WHOLE FILE ───────────────────────────
 * Publishing somebody's name on a public web page is a disclosure they did not
 * make by being on a guest list. **Only `invitation_status = 'accepted'`
 * appears here.** That is not a proxy: accepting is an affirmative act by that
 * person, recorded with `responded_at`, in answer to an invitation naming the
 * role. Pending, invited and declined are all withheld — and a person who
 * declined being a ninong must never be listed as one.
 *
 * ⚖ WHAT IS DELIBERATELY NOT PUBLISHED, even for somebody who accepted:
 * their email, their phone, their `relationship_note` ("Tito Mike, mom's
 * brother"), and their `decline_note`. The page shows a name and a role,
 * which is what an invitation card shows.
 *
 * ⚠ AND ORDINARY GUESTS ARE NOT HERE AT ALL. `guests` rows are people the
 * couple typed into a list; nobody in that table agreed to be named in public.
 * The count at the end of the band is a NUMBER, never a list.
 *
 * 🪤 A FAILED READ RETURNS NOBODY. The band then does not render, which is the
 * correct render — an error on somebody's wedding page is worse than a missing
 * strip — but it must never be reported as "they had no entourage".
 */

/** The four Filipino secondary tiers, plus the principals. */
const ROLE_LABEL: Record<string, { groom: string; bride: string; neutral: string }> = {
  principal: { groom: 'Ninong', bride: 'Ninang', neutral: 'Principal sponsor' },
  cord: { groom: 'Cord', bride: 'Cord', neutral: 'Cord' },
  veil: { groom: 'Veil', bride: 'Veil', neutral: 'Veil' },
  coin: { groom: 'Coin', bride: 'Coin', neutral: 'Coin' },
  candle: { groom: 'Candle', bride: 'Candle', neutral: 'Candle' },
};

export type WhoWasThere = {
  /** Their name, as the couple wrote it on the invitation. */
  name: string;
  /** Ninong · Ninang · Cord · Veil · Coin · Candle. */
  role: string;
};

/**
 * The people who accepted a role at these celebrations.
 *
 * `limit` caps what is rendered; the caller shows a plain "+ N guests" count
 * beside it, which names nobody.
 */
export async function loadWhoWasThere(
  eventIds: ReadonlyArray<string>,
  limit = 8,
): Promise<WhoWasThere[]> {
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return [];

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { data, error } = await admin
    .from('event_sponsors')
    .select('full_name, sponsor_tier, side, invitation_status, pair_index')
    // 🔒 THE GATE. Never widen this to include 'invited' — an invitation is a
    // question, and publishing the answer before it is given answers it for
    // them.
    .eq('invitation_status', 'accepted')
    .in('event_id', ids)
    // Principals first (pair_index orders them as the couple arranged), then
    // the secondary tiers in the order they happen in the ceremony.
    .order('pair_index', { ascending: true, nullsFirst: false })
    .limit(limit * 3);

  if (error) {
    // Rejected, not thrown — the only symptom of a refused read is an absence,
    // so it is at least written down.
    console.error('[who-was-there] read failed', error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    full_name: string | null;
    sponsor_tier: string;
    side: string;
    pair_index: number | null;
  }>;

  const TIER_ORDER = ['principal', 'cord', 'veil', 'coin', 'candle'];
  return rows
    .filter((r) => (r.full_name ?? '').trim().length > 0)
    .sort(
      (a, b) =>
        TIER_ORDER.indexOf(a.sponsor_tier) - TIER_ORDER.indexOf(b.sponsor_tier) ||
        (a.pair_index ?? 0) - (b.pair_index ?? 0),
    )
    .slice(0, limit)
    .map((r) => ({
      name: (r.full_name as string).trim(),
      role:
        ROLE_LABEL[r.sponsor_tier]?.[
          (r.side as 'groom' | 'bride' | 'neutral') ?? 'neutral'
        ] ?? 'Sponsor',
    }));
}
