import Link from 'next/link';
import { ChevronRight, PencilLine } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { loadClaimWordsFor } from '@/lib/service-card-checks.server';
import { fairSweepItems, type SweepItem } from '@/lib/fair-presentation-sweep';

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
    loadClaimWordsFor(vendorProfileId).catch(() => null),
    supabase.from('vendor_services').select('vendor_service_id, title, is_active').eq('vendor_profile_id', vendorProfileId),
    supabase.from('vendor_packages').select('package_id, package_name, is_active').eq('vendor_profile_id', vendorProfileId),
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

/** The notice itself, from what the sweep found — drawn by the Shop tab and by the dev lab. */
export function FairSweepList({ items, unread = [] }: { items: ReadonlyArray<SweepItem>; unread?: ReadonlyArray<string> }) {
  if (items.length === 0 && unread.length === 0) return null;
  return (
    <section className="mx-auto w-full max-w-3xl pt-4" data-fair-sweep={items.length} aria-labelledby="fair-sweep-title">
      {items.length > 0 ? (
        <>
          <h2 id="fair-sweep-title" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <PencilLine aria-hidden className="h-4 w-4 flex-none" style={{ color: 'rgb(var(--color-danger))' }} strokeWidth={2} />
            Edit your name
          </h2>
          <ul className="mt-1">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id ?? ''}`} className="border-t border-ink/10 first:border-t-0">
                <Link href={it.href} className="sn-press flex min-h-[52px] items-center gap-3 py-2.5" data-fair-sweep-item={it.kind}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium text-ink">{it.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: 'rgb(var(--color-danger))' }}>
                      {it.line}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/40" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {unread.length > 0 ? (
        <p role="status" className="mt-1 text-[12.5px] text-ink/55" data-fair-sweep-unread="">
          Couldn&rsquo;t check {unread.join(' · ')} for fair presentation just now — nothing on your shop changed.
        </p>
      ) : null}
    </section>
  );
}
