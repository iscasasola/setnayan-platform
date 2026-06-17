import { redirect } from 'next/navigation';
import { Handshake, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { submitPartnershipClaim } from '@/app/admin/vendor-partnerships/actions';

export const metadata = { title: 'Partnerships · Vendor' };

type SearchParams = { submitted?: string; error?: string };

type PartnershipRow = {
  id: number;
  recommended_vendor_id: string;
  relationship_type: string;
  admin_verified: boolean;
  is_active: boolean;
  created_at: string;
};

type VendorOption = {
  vendor_profile_id: string;
  business_name: string;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  accredited: 'Accredited — you formally certify this vendor',
  sponsored_included: 'Included in package — recommended vendor is part of your offering at no extra cost',
  sponsored_discounted: 'Discounted — recommended vendor offers a discount when booked alongside you',
  general: 'General referral — informal "works well with" recommendation',
};

const RELATIONSHIP_LABELS_SHORT: Record<string, string> = {
  accredited: 'Accredited',
  sponsored_included: 'Included in package',
  sponsored_discounted: 'Discounted',
  general: 'General referral',
};

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function VendorPartnershipsPage({ searchParams }: Props) {
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Fetch this vendor's declared partnerships
  const { data: myPartnerships } = await supabase
    .from('vendor_partnerships')
    .select('id, recommended_vendor_id, relationship_type, admin_verified, is_active, created_at')
    .eq('recommending_vendor_id', profile.vendor_profile_id)
    .order('created_at', { ascending: false });

  const partnerships = (myPartnerships ?? []) as PartnershipRow[];

  // Resolve partner vendor names
  const partnerIds = partnerships.map((p) => p.recommended_vendor_id);
  const partnerNameMap = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: partnerVendors } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', partnerIds);
    for (const v of (partnerVendors ?? []) as { vendor_profile_id: string; business_name: string }[]) {
      partnerNameMap.set(v.vendor_profile_id, v.business_name);
    }
  }

  // All other active vendors for the partnership claim form
  const { data: allVendors } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('is_active', true)
    .neq('vendor_profile_id', profile.vendor_profile_id)
    .order('business_name', { ascending: true })
    .limit(300);
  const vendorOptions = (allVendors ?? []) as VendorOption[];

  const activeLive = partnerships.filter((p) => p.admin_verified && p.is_active);
  const pendingReview = partnerships.filter((p) => !p.admin_verified && p.is_active);
  const inactive = partnerships.filter((p) => !p.is_active);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-1">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Vendor partnerships
        </p>
        <h1 className="m-display-tight text-2xl text-[color:var(--m-ink)] sm:text-3xl">
          Your partnerships
        </h1>
        <p className="text-sm text-ink/60">
          Tell couples about vendors you work well with. Setnayan HQ reviews each claim
          before the badge appears on your profile — usually within 2 business days.
        </p>
      </header>

      {sp.error ? (
        <FormFlash tone="error">{decodeURIComponent(sp.error)}</FormFlash>
      ) : null}
      {sp.submitted ? (
        <FormFlash tone="success">
          Partnership claim submitted. Our team will review it within 2 business days.
          Once verified, the badge will appear on both profiles in search results.
        </FormFlash>
      ) : null}

      {/* ── ACTIVE LIVE PARTNERSHIPS ──────────────────────────────────── */}
      {activeLive.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Active ({activeLive.length})
          </h2>
          <ul className="space-y-3">
            {activeLive.map((p) => (
              <li key={p.id} className="m-card flex items-center gap-3 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {partnerNameMap.get(p.recommended_vendor_id) ?? p.recommended_vendor_id}
                  </p>
                  <p className="text-xs text-ink/55">
                    {RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Live
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── PENDING REVIEW ───────────────────────────────────────────── */}
      {pendingReview.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Pending review ({pendingReview.length})
          </h2>
          <ul className="space-y-3">
            {pendingReview.map((p) => (
              <li key={p.id} className="m-card flex items-center gap-3 p-4">
                <Clock className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {partnerNameMap.get(p.recommended_vendor_id) ?? p.recommended_vendor_id}
                  </p>
                  <p className="text-xs text-ink/55">
                    {RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}
                    {' · '}Waiting for Setnayan HQ review
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Review
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── INACTIVE / REJECTED ──────────────────────────────────────── */}
      {inactive.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Inactive ({inactive.length})
          </h2>
          <ul className="space-y-2">
            {inactive.map((p) => (
              <li key={p.id} className="m-card flex items-center gap-3 p-3 opacity-50">
                <Handshake className="h-4 w-4 shrink-0 text-ink/40" />
                <p className="text-sm text-ink/60">
                  {partnerNameMap.get(p.recommended_vendor_id) ?? p.recommended_vendor_id}
                  {' · '}
                  {RELATIONSHIP_LABELS_SHORT[p.relationship_type] ?? p.relationship_type}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── SUBMIT PARTNERSHIP CLAIM ──────────────────────────────────── */}
      <section className="rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/30 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <Handshake className="h-6 w-6 shrink-0 text-mulberry" />
          <div>
            <h2 className="text-base font-semibold text-ink">
              Declare a vendor partnership
            </h2>
            <p className="text-xs text-ink/55">
              Work well with another vendor? Tell couples — once Setnayan HQ verifies
              the claim, a badge will appear alongside both of your profiles.
            </p>
          </div>
        </div>

        <form action={submitPartnershipClaim} className="grid gap-4 sm:grid-cols-2">
          {/* Recommended vendor */}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Which vendor do you recommend?</span>
            <select
              name="recommended_vendor_id"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Search for a vendor…</option>
              {vendorOptions.map((v) => (
                <option key={v.vendor_profile_id} value={v.vendor_profile_id}>
                  {v.business_name}
                </option>
              ))}
            </select>
          </label>

          {/* Relationship type */}
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">What kind of partnership is this?</span>
            <select
              name="relationship_type"
              required
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a type…</option>
              {Object.entries(RELATIONSHIP_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Submit for review
            </button>
            <p className="mt-2 text-xs text-ink/45">
              Setnayan HQ will verify this with the other vendor before the badge goes live.
              False claims may result in your profile being flagged.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
