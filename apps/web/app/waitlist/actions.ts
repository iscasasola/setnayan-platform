'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Couple waitlist signup. Open to anon visitors during the pre-launch
 * window (today → 2026-12-01). RLS already permits anon INSERT on
 * `public.couple_waitlist_signups`; we go through the admin client here so
 * the ip/UA columns can be populated regardless of how the client cookie
 * resolves at the edge.
 *
 * Idempotent by email (unique index on LOWER(email)) — duplicate submits
 * land back on the success page without an error.
 */
export async function joinCoupleWaitlist(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim() || null;
  const partnerName = String(formData.get('partner_name') ?? '').trim() || null;
  const weddingDateRaw = String(formData.get('wedding_date') ?? '').trim();
  const locationCity = String(formData.get('location_city') ?? '').trim() || null;
  const source = String(formData.get('source') ?? '').trim() || null;

  if (!email) {
    return redirect('/waitlist?error=missing_email');
  }
  // Loose RFC-5322-ish check (server-side guard; the DB CHECK is the source of truth).
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return redirect('/waitlist?error=invalid_email');
  }
  if (fullName && fullName.length > 200) {
    return redirect('/waitlist?error=name_too_long');
  }
  if (partnerName && partnerName.length > 200) {
    return redirect('/waitlist?error=partner_name_too_long');
  }
  if (locationCity && locationCity.length > 100) {
    return redirect('/waitlist?error=city_too_long');
  }

  let weddingDate: string | null = null;
  if (weddingDateRaw) {
    // ISO YYYY-MM-DD format; HTML date input already constrains.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weddingDateRaw)) {
      return redirect('/waitlist?error=invalid_date');
    }
    weddingDate = weddingDateRaw;
  }

  const h = await headers();
  const ipAddress =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;

  // Use the admin client so we can capture ip + UA on anon submits (RLS
  // anon-insert policy would still allow this but the admin client avoids
  // anon-session edge cases at Vercel).
  const admin = createAdminClient();
  const { error } = await admin.from('couple_waitlist_signups').upsert(
    {
      email,
      full_name: fullName,
      partner_name: partnerName,
      wedding_date: weddingDate,
      location_city: locationCity,
      source,
      ip_address: ipAddress,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    {
      // Conflict resolution by the case-insensitive unique index on email.
      // We update non-null fields on re-submit so couples can refine their
      // entry without an account.
      onConflict: 'email',
      ignoreDuplicates: false,
    },
  );

  if (error) {
    console.error('[waitlist] insert failed:', error.message);
    return redirect('/waitlist?error=server');
  }

  // Note: a fresh `supabase` client is also available via `await createClient()`
  // if we want to drop a session cookie someday. Anon waitlist signups don't
  // need one in V1.
  void createClient; // keep the import live so future use doesn't get linted away

  return redirect('/waitlist?status=joined');
}
