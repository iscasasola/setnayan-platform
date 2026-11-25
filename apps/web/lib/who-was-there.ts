import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { acceptedTheNamedRole, querySponsorGuests } from '@/lib/sponsor-guests';

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
/** The label for a sponsor's ROLE on the guest — Ninong or Ninang only where the couple recorded it, never from the
 *  side (owner ruling 2026-09-15). The five tiers: principal · cord · veil · coin · candle. */
const ROLE_LABEL: Record<string, string> = {
  principal_sponsor_ninong: 'Ninong',
  principal_sponsor_ninang: 'Ninang',
  principal_sponsor: 'Principal sponsor',
  cord_sponsor: 'Cord',
  veil_sponsor: 'Veil',
  coin_sponsor: 'Coin',
  candle_sponsor: 'Candle',
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

  // 👥 Sponsors are guests with a sponsor role (owner, brief Add 41 · A2-I14) — read from the guest list.
  const { data, error } = await querySponsorGuests(admin, ids, { publicOnly: true });

  if (error) {
    // Rejected, not thrown — the only symptom of a refused read is an absence,
    // so it is at least written down.
    console.error('[who-was-there] read failed', error);
    return [];
  }

  // 🔒 THE GATE (`acceptedTheNamedRole`): asked to stand in the role AND answered yes themselves. Never widen it to an
  // event RSVP or to someone merely invited — an invitation is a question, and publishing the answer before it is
  // given answers it for them.
  const rows = (data ?? []).filter(acceptedTheNamedRole);

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
      role: ROLE_LABEL[r.role] ?? 'Sponsor',
    }));
}
