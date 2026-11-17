import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PAPERS_LAPSED_AUDIT_ACTION } from '@/lib/papers-lapse';
import { BADGE_REMINDER_DAYS, manilaDateKey } from '@/lib/verified-badge';
import { RENEWAL_WEEK_DAYS, RENEWED_NEWS_DAYS, adminPaperLines, renewalBucket, type RenewalBucket } from '@/lib/papers-renewal';
import { countAsksBefore } from '@/lib/papers-renewal.server';

/**
 * 📄 THE ADMIN'S RENEWAL VIEW — §5 of the approved "Papers renewal" design: one Renewals filter on the shipped
 * suppliers list, and one block on the shop's record. "Nothing in this view changes a shop's state; it only shows it"
 * — and there is no button that lets a shop through by hand: verification decides that, from the papers.
 *
 * Reads with the service role the admin pages already hold (the renewal day is a trust column). Every refused read
 * comes back as `null` and is said as "Couldn't load" — never as zero or none.
 */

/** The audit rows the daily badge pass writes (`verified-badge-sweep.ts`). */
const AUDIT_REMIND = 'verified_badge_reminder_sent';

export type RenewalListRow = {
  vendorProfileId: string;
  name: string;
  city: string | null;
  bucket: RenewalBucket;
  dueAt: string | null;
  lapsedAt: string | null;
  lastVerifiedAt: string | null;
  papers: ReturnType<typeof adminPaperLines> | null;
};

/** How many shops one read lists; past it the list says "200+", never a silent cut. */
export const RENEWALS_LIST_CAP = 200;

/** The Renewals list, and whether more shops matched than it shows. */
export type RenewalsList = { rows: RenewalListRow[]; more: boolean };

/**
 * Every shop under one of the three Renewals chips. null = a read was refused — the shops OR their papers, because
 * "Renewed" is decided by the latest approved application, so without it the chips cannot be counted honestly.
 */
export async function readRenewalsList(now: Date = new Date()): Promise<RenewalsList | null> {
  // The SERVICE ROLE, inline: the renewal day is a trust column no session reads (20271217955839).
  const admin = createAdminClient();
  // The windows are the chips' own: "Due in N days" is the last reminder window, "Renewed" the news line's two weeks.
  const weekAhead = new Date(now.getTime() + RENEWAL_WEEK_DAYS * 86_400_000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - RENEWED_NEWS_DAYS * 86_400_000).toISOString();
  const shops = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, location_city, verification_state, next_renewal_due_at, papers_lapsed_at, last_verified_at')
    .eq('verification_state', 'verified')
    .or(`papers_lapsed_at.not.is.null,next_renewal_due_at.lte.${weekAhead},last_verified_at.gte.${twoWeeksAgo}`)
    .order('vendor_profile_id', { ascending: true })
    .limit(RENEWALS_LIST_CAP + 1);
  if (shops.error) {
    logQueryError('papers-renewal-admin: shops', shops.error);
    return null;
  }
  type Shop = {
    vendor_profile_id: string;
    business_name: string | null;
    location_city: string | null;
    verification_state: string | null;
    next_renewal_due_at: string | null;
    papers_lapsed_at: string | null;
    last_verified_at: string | null;
  };
  const all = (shops.data ?? []) as Shop[];
  const more = all.length > RENEWALS_LIST_CAP;
  const rows = all.slice(0, RENEWALS_LIST_CAP);
  if (rows.length === 0) return { rows: [], more: false };
  const apps = await admin
    .from('vendor_verification_applications')
    .select('vendor_profile_id, application_type, status, doc_uploads, created_at')
    .in('vendor_profile_id', rows.map((r) => r.vendor_profile_id))
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (apps.error) {
    // Without the applications "Renewed" cannot be told apart, so the whole list says "Couldn't load" — never
    // "Renewed · 0".
    logQueryError('papers-renewal-admin: applications', apps.error);
    return null;
  }
  const latest = new Map<string, { application_type: string | null; doc_uploads: Record<string, unknown> | null }>();
  for (const a of (apps.data ?? []) as Array<{ vendor_profile_id: string; application_type: string | null; doc_uploads: Record<string, unknown> | null }>) {
    if (!latest.has(a.vendor_profile_id)) latest.set(a.vendor_profile_id, a);
  }
  const today = manilaDateKey(now);
  const out: RenewalListRow[] = [];
  for (const r of rows) {
    const app = latest.get(r.vendor_profile_id) ?? null;
    const bucket = renewalBucket({ ...r, renewed: app?.application_type === 'annual_renewal' }, now);
    if (!bucket) continue;
    out.push({
      vendorProfileId: r.vendor_profile_id,
      name: r.business_name?.trim() || 'Supplier without a name',
      city: r.location_city,
      bucket,
      dueAt: r.next_renewal_due_at,
      lapsedAt: r.papers_lapsed_at,
      lastVerifiedAt: r.last_verified_at,
      papers: adminPaperLines(app?.doc_uploads ?? null, today),
    });
  }
  return { rows: out, more };
}

export type RenewalRecord = {
  bookings: number | null;
  /** Booking asks still waiting on the shop from before the lapse; null = not read, or not lapsed. */
  asksBefore: number | null;
  /** The shop's contact email, for "Message the shop"; null = none on file or not read. */
  contactEmail: string | null;
  reminders: Array<{ at: string; stage: number | 'lapse' }> | null;
  papers: ReturnType<typeof adminPaperLines> | null;
};

/** The shop record's renewal block: bookings that carry on, every reminder sent, the papers on file. */
export async function readRenewalRecord(
  vendorProfileId: string,
  now: Date = new Date(),
  lapsedAt: string | null = null,
): Promise<RenewalRecord> {
  const admin = createAdminClient();
  const [bookings, said, app, asksBefore, shop] = await Promise.all([
    admin
      .from('event_vendors')
      .select('event_id', { count: 'exact', head: true })
      .eq('marketplace_vendor_id', vendorProfileId)
      .in('status', ['contracted', 'deposit_paid']),
    admin
      .from('admin_audit_log')
      .select('action, metadata, created_at')
      .in('action', [AUDIT_REMIND, PAPERS_LAPSED_AUDIT_ACTION])
      .eq('target_id', vendorProfileId)
      .order('created_at', { ascending: true })
      .limit(40),
    admin
      .from('vendor_verification_applications')
      .select('doc_uploads')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    lapsedAt ? countAsksBefore(admin, vendorProfileId, lapsedAt, now) : Promise.resolve(null),
    admin.from('vendor_profiles').select('contact_email').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
  ]);
  if (shop.error) logQueryError('papers-renewal-admin: contact email', shop.error, { vendorProfileId });
  const email = ((shop.data as { contact_email?: string | null } | null)?.contact_email ?? '').trim();
  if (bookings.error) logQueryError('papers-renewal-admin: bookings', bookings.error, { vendorProfileId });
  if (said.error) logQueryError('papers-renewal-admin: reminders', said.error, { vendorProfileId });
  if (app.error) logQueryError('papers-renewal-admin: papers', app.error, { vendorProfileId });
  const uploads = ((app.data as { doc_uploads?: Record<string, unknown> | null } | null)?.doc_uploads ?? null) as Record<string, unknown> | null;
  return {
    bookings: bookings.error ? null : (bookings.count ?? null),
    asksBefore,
    contactEmail: shop.error || !email.includes('@') ? null : email,
    reminders: said.error
      ? null
      : ((said.data ?? []) as Array<{ action: string; metadata: { stage?: unknown } | null; created_at: string }>).map((r) => ({
          at: r.created_at,
          stage:
            r.action === PAPERS_LAPSED_AUDIT_ACTION
              ? ('lapse' as const)
              : typeof r.metadata?.stage === 'number'
                ? r.metadata.stage
                : BADGE_REMINDER_DAYS,
        })),
    papers: app.error ? null : adminPaperLines(uploads, manilaDateKey(now)),
  };
}
