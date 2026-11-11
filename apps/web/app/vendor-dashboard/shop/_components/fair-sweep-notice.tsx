import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { loadClaimWordsFor } from '@/lib/service-card-checks.server';
import { fairSweepItems } from '@/lib/fair-presentation-sweep';
import { FairSweepList } from './fair-sweep-list';
import { VENDOR_PACKAGE_SELECT } from '@/lib/vendor-packages';

/**
 * 🚫 "EDIT YOUR NAME" — the one sweep of live cards and shops, on the Shop tab (owner 2026-11-08, Build 2 item (5)).
 *
 * Every live name the supplier wrote (shop name · tagline · each live card · each live bundle) is asked the same
 * fair-presentation checks the editors ask (`lib/fair-presentation-sweep.ts`); each one that needs an edit is a row
 * with the ruled sentence and a door to the field. In-app only: no email, no push, nothing written, NOTHING TAKEN DOWN —
 * the card stays visible while it is fixed, and the row is gone the moment it is.
 *
 * REQUESTS: 4, streamed in its own <Suspense> so the cover never waits — the word list + this shop's allowances (2, in
 * parallel) and the shop's cards and bundles (2, in parallel with them). Draws NOTHING when every name is fine. A read
 * that failed says so in one quiet line (never "all fine").
 */
export async function FairSweepNotice({ vendorProfileId, shopName, tagline }: { vendorProfileId: string; shopName: string | null; tagline: string | null }) {
  const supabase = await createClient();
  const [words, cards, packages] = await Promise.all([
    loadClaimWordsFor(vendorProfileId), // never throws — unread is `null`, logged where read
    supabase.from('vendor_services').select('vendor_service_id, title, is_active').eq('vendor_profile_id', vendorProfileId),
    supabase.from('vendor_packages').select(VENDOR_PACKAGE_SELECT).eq('vendor_profile_id', vendorProfileId),
  ]);
  if (cards.error) logQueryError('FairSweepNotice.cards', cards.error, { vendorProfileId }, 'graceful_degrade');
  if (packages.error) logQueryError('FairSweepNotice.packages', packages.error, { vendorProfileId }, 'graceful_degrade');
  const items = fairSweepItems(
    {
      shopName,
      tagline,
      cards: ((cards.data ?? []) as { vendor_service_id: string; title: string | null; is_active: boolean | null }[]).map((c) => ({
        id: c.vendor_service_id,
        title: c.title,
        live: c.is_active === true,
      })),
      packages: ((packages.data ?? []) as { package_id: string; package_name: string | null; is_active: boolean | null }[]).map((p) => ({
        id: p.package_id,
        name: p.package_name,
        live: p.is_active === true,
      })),
    },
    words,
  );
  const unread = [words === null ? 'the word list' : null, cards.error ? 'your cards' : null, packages.error ? 'your bundles' : null].filter(
    (x): x is string => x !== null,
  );
  return <FairSweepList items={items} unread={unread} />;
}
