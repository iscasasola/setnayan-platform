import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isStoreShellRequest } from '@/lib/request-platform';
import type { VendorDossier } from '@/lib/vendor-deep-search';
import { loadDeepSearchOffer } from '@/lib/vendor-deep-search-offer';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { deepSearchPdfFileName, deepSearchPdfHref, deepSearchStillKept } from '@/lib/deep-search-findings';
import { SharePdfButton } from '@/app/_components/share-pdf-button';
import { DeepSearchRunner } from './_components/deep-search-runner';
import { DossierView } from './_components/dossier-view';

/**
 * /vendor-dashboard/deep-search — the Deep Search surface (owner-locked
 * 2026-07-22). A verified, paid-tier vendor runs the web-research deep search on
 * their OWN business and reviews the "What We Learned" result to auto-fill their
 * profile. ₱500 per search; Pro/Enterprise/Custom get 1 free per 28-day cycle,
 * Solo always pays.
 *
 * Doorway: the "Plan & tokens" hub links here (mirrors the Custom-plan sub-route
 * pattern), so it lives OUTSIDE the locked 5-page sidebar IA.
 *
 * Dossiers are stored in the admin-only vendor_web_dossiers table (reusing the
 * verification engine's store). The vendor never reads that table under RLS;
 * this page resolves the vendor's OWN dossiers by the explicit id list carried
 * on their vendor_deep_search_uses rows (admin verification dossiers have no use
 * row, so they can never surface here).
 */

export const metadata = { title: 'Deep Search · Supplier' };

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type UseRow = {
  id: number;
  used_at: string;
  was_free: boolean;
  order_id: string | null;
  dossier_id: number | null;
};

type DossierRow = {
  id: number;
  status: string;
  dossier: VendorDossier | null;
  created_at: string;
};

export default async function VendorDeepSearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = profile.vendor_profile_id;

  // Soft-probe tier + expiry + verification (none in FULL_VENDOR_PROFILE_SELECT).
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (tierRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const tierExpiresAt =
    (tierRow as { tier_expires_at?: string | null } | null)?.tier_expires_at ?? null;
  const verification =
    (tierRow as { verification_state?: string | null } | null)?.verification_state ?? null;

  // 🔎 Price, free search, rails and eligibility: the ONE resolver Shop › Details' card uses too
  // (`lib/vendor-deep-search-offer.ts`, moved from here 2026-10-29 — every rule it carries is the one this page had).
  // TRY-FIRST (2026-09-30): the runner opens for every VERIFIED shop; the paid-plan requirement is asked through the
  // one flag-aware question, only at Run — `planAsks` just draws the ◆ note. 🔒 No ◆ hint in the store shell.
  const planAsks =
    vendorPaywallApplies(isTierAtLeast(tier, 'solo')) && !(await isStoreShellRequest());
  const admin = createAdminClient();
  const offer = await loadDeepSearchOffer(supabase, admin, { vendorProfileId, tier, tierExpiresAt, verification });
  const { eligible, isFreeNow, hasFreeAllowance, cyclePricePhp, openRails } = offer;

  // History — the vendor's own uses (RLS-scoped), resolved to their dossiers by
  // the explicit id list (admin-read; verification dossiers have no use row).
  const { data: usesData } = await supabase
    .from('vendor_deep_search_uses')
    .select('id, used_at, was_free, order_id, dossier_id')
    .eq('vendor_profile_id', vendorProfileId)
    .order('used_at', { ascending: false })
    .limit(12);
  const uses = (usesData ?? []) as UseRow[];
  const dossierIds = uses.map((u) => u.dossier_id).filter((v): v is number => v != null);

  const dossierById = new Map<number, DossierRow>();
  if (dossierIds.length > 0) {
    const { data: dData } = await admin
      .from('vendor_web_dossiers')
      .select('id, status, dossier, created_at')
      .in('id', dossierIds);
    for (const d of (dData ?? []) as DossierRow[]) dossierById.set(d.id, d);
  }

  const latest = uses.find(
    (u) => u.dossier_id != null && dossierById.get(u.dossier_id)?.status === 'complete',
  );
  const latestRow = latest?.dossier_id != null ? dossierById.get(latest.dossier_id) : undefined;
  const latestDossier = latestRow?.dossier ?? null;
  // 📄 Every kept result has its PDF (owner 2026-10-29: "run search would also create a pdf file of the search created").
  const now = Date.now();
  const pdfOf = (d: DossierRow | undefined) =>
    d && d.status === 'complete' && d.dossier && deepSearchStillKept(d.created_at, now)
      ? { dossierId: d.id, searchedAt: d.created_at }
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageMasthead
        title="Learn what the web knows about your business."
      />

      <section className="sn-tile mt-6 p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
          >
            <Search className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink">Run a Deep Search</h2>
            <p className="mt-1 max-w-prose text-sm text-ink/65">
              {hasFreeAllowance
                ? `Your plan includes 1 free search every 28 days, then ${peso(cyclePricePhp)} each.`
                : `Each search is ${peso(cyclePricePhp)} on your plan.`}
            </p>
          </div>
        </div>

        <DeepSearchRunner
          eligible={eligible}
          planAsks={planAsks}
          isFreeNow={isFreeNow}
          hasFreeAllowance={hasFreeAllowance}
          pricePhp={offer.pricePhp}
          openRails={openRails}
        />
      </section>

      {latestDossier ? (
        <section className="mt-6">
          <p className="sn-eye">Your latest result</p>
          <div className="mt-2">
            <DossierView dossier={latestDossier} pdf={pdfOf(latestRow)} />
          </div>
        </section>
      ) : null}

      {uses.length > 0 ? (
        <section className="sn-tile mt-6 p-6">
          <p className="sn-eye">Search history</p>
          <ul className="mt-3 divide-y" style={{ borderColor: 'var(--m-line)' }}>
            {uses.map((u) => {
              const d = u.dossier_id != null ? dossierById.get(u.dossier_id) : undefined;
              const status = d?.status ?? 'running';
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="text-sm text-ink/80">{fmtDateTime(u.used_at)}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    {pdfOf(d) ? (
                      <SharePdfButton
                        href={deepSearchPdfHref(d!.id)}
                        fileName={deepSearchPdfFileName(d!.created_at)}
                        name={`Share this search (PDF) · ${fmtDateTime(u.used_at)}`}
                      />
                    ) : null}
                    <span className="text-xs text-ink/55">
                      {u.was_free ? 'Free (cycle)' : peso(cyclePricePhp)}
                    </span>
                    <span
                      className={
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                        (status === 'complete'
                          ? 'bg-success-100 text-success-800'
                          : status === 'failed'
                            ? 'bg-danger-100 text-danger-800'
                            : 'bg-ink/5 text-ink/60')
                      }
                    >
                      {status === 'complete' ? 'Done' : status === 'failed' ? 'Failed' : 'Running'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
