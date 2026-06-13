// ============================================================================
// Real Weddings — published-showcase DB browse (iteration 0046)
// ============================================================================
// Server-only. Returns the consent-gated set of REAL weddings to surface on
// /realstories, newest first. A wedding qualifies ONLY when ALL hold:
//   • it's a wedding (events.event_type = 'wedding') with a public slug,
//   • it's past the T+30d grace window (event_date <= today − 30 days),
//   • a couple member's account opted in to public showcase inclusion
//     (users.public_summary_consent_at IS NOT NULL, account not deleted).
//
// That is the RA 10173 consent gate (CLAUDE.md decision-log rows 426 + 428; the
// `users.public_summary_consent_at` column shipped in
// 20260519000000_phase_a_event_editorial_consent.sql). Read via the admin
// client because /realstories is anonymous and these rows sit behind RLS — exactly
// how the editorial data layer reads.
//
// Best-effort: ANY failure or missing data returns [] so the /realstories page
// falls back to the curated sample (lib/real-weddings.ts) and never crashes.
// Today this returns [] — no consented past weddings exist yet (the first real
// one is the founder's Dec 2026 wedding → editorial ~Jan 2027), so the page
// shows the sample until then, at which point real weddings take over
// automatically. Each entry links to the couple's OWN canonical editorial at
// /[slug] (0002 Phase 4) — never a duplicate copy under /realstories.

import { createAdminClient } from '@/lib/supabase/admin';

export type ShowcaseEntry = {
  href: string; // canonical editorial — the couple's own /[slug] page
  coupleNames: string;
  city: string | null;
  dateLabel: string | null; // display, e.g. "February 2026"
  eventDate: string | null; // ISO — sitemap lastmod
  monogramColor: string | null;
};

const GRACE_DAYS = 30;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return null;
  return `${MONTHS[m - 1]} ${y}`;
}

function deriveCity(venueName: string | null, venueAddress: string | null): string | null {
  const addr = venueAddress?.trim();
  if (addr) {
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      if (candidate && !/^\d+$/.test(candidate)) return candidate;
    }
  }
  return venueName?.trim() || null;
}

export async function loadPublishedShowcases(limit = 24): Promise<ShowcaseEntry[]> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    // 1 · customers who opted in to public showcase inclusion (RA 10173 gate).
    const { data: consenters } = await admin
      .from('users')
      .select('user_id')
      .not('public_summary_consent_at', 'is', null)
      .is('deleted_at', null);
    const userIds = (consenters ?? []).map((u) => u.user_id as string);
    if (userIds.length === 0) return [];

    // 2 · the events those couples belong to.
    const { data: members } = await admin
      .from('event_members')
      .select('event_id')
      .eq('member_type', 'couple')
      .in('user_id', userIds);
    const eventIds = Array.from(
      new Set((members ?? []).map((m) => m.event_id as string)),
    );
    if (eventIds.length === 0) return [];

    // 3 · their weddings, past the grace window, with a public slug.
    const { data: events } = await admin
      .from('events')
      .select('slug, display_name, event_date, venue_name, venue_address, monogram_color')
      .eq('event_type', 'wedding')
      .in('event_id', eventIds)
      .lte('event_date', cutoff)
      .not('slug', 'is', null)
      .order('event_date', { ascending: false })
      .limit(limit);

    return (events ?? []).map((e) => ({
      href: `/${e.slug as string}`,
      coupleNames: (e.display_name as string | null)?.trim() || 'A Setnayan wedding',
      city: deriveCity(e.venue_name as string | null, e.venue_address as string | null),
      dateLabel: monthYear(e.event_date as string | null),
      eventDate: (e.event_date as string | null) ?? null,
      monogramColor: (e.monogram_color as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}
