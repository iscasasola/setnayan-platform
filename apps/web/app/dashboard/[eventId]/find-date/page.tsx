/**
 * "Find your date" — Schedule Matrix surface (server entry).
 *
 * Design-locked in Schedule_Matrix_and_Date_Finder_2026-06-02.md (CLAUDE.md
 * 2026-06-02 row). The wedding date is an OUTPUT: given the couple's candidate
 * dates (read from event_date + event_date_precision) and their shortlisted
 * vendors (event_vendors), rank the candidate dates by how well they keep the
 * couple's vendors available, and show the per-date vendor combination.
 *
 * PR 1 scope (additive · NO migration): reads the SHIPPED event_date +
 * event_date_precision (the new date_candidates[]/date_window columns from
 * migration 20260719000000 stay unpopulated until the onboarding Phase-4
 * commit lands — the keystone follow-up). Availability comes from the existing
 * engine (vendor_calendar_blocks via lib/vendor-availability.ts). Capacity
 * (daily_booking_capacity) + the honest "eyeing" signal are later PRs.
 *
 * Returns bare content; the dashboard [eventId]/layout.tsx provides the tab
 * chrome + outer <main> + the couple-membership guard (same as the sibling
 * Vendors page — this page only re-checks auth).
 */
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventVendors, type VendorStatus } from '@/lib/vendors';
import { buildScheduleMatrix, type SchedulePick } from '@/lib/schedule-matrix';
import type { EventDatePrecision } from '@/lib/events';
import { FindYourDate } from './_components/find-your-date';

export const metadata = { title: 'Find your date' };

type Props = { params: Promise<{ eventId: string }> };

// Top pick within a category = most committed, then earliest added. The
// commitment tier dominates (×1e13 ≫ any epoch-ms), so a paid vendor always
// outranks a still-considering one regardless of when each was added.
const LOCK_RANK: Record<VendorStatus, number> = {
  complete: 0,
  delivered: 0,
  deposit_paid: 0,
  contracted: 1,
  shortlisted: 2,
  considering: 2,
};

function coercePrecision(value: unknown): EventDatePrecision | null {
  return value === 'year' || value === 'month' || value === 'day' ? value : null;
}

export default async function FindDatePage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const admin = createAdminClient();

  const [vendors, eventRes] = await Promise.all([
    fetchEventVendors(supabase, eventId),
    supabase
      .from('events')
      .select('event_date, event_date_precision')
      .eq('id', eventId)
      .maybeSingle(),
  ]);

  const ev =
    (eventRes.data as { event_date: string | null; event_date_precision: unknown } | null) ?? null;
  const eventDate = ev?.event_date ?? null;
  // Default to 'day' when a date is present but precision is null (legacy rows
  // predating the precision column / direct-commit paths).
  const precision: EventDatePrecision | null = eventDate
    ? (coercePrecision(ev?.event_date_precision) ?? 'day')
    : null;

  const picks: SchedulePick[] = vendors.map((v) => ({
    key: v.vendor_id,
    category: v.category,
    name: v.vendor_name,
    marketplaceVendorId: v.marketplace_vendor_id,
    rank: (LOCK_RANK[v.status] ?? 2) * 1e13 + new Date(v.created_at).getTime(),
  }));

  const matrix = await buildScheduleMatrix({ admin, eventDate, precision, picks });

  return <FindYourDate eventId={eventId} matrix={matrix} />;
}
