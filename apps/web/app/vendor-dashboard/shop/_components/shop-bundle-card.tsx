'use client';

/**
 * 🧺 ONE BUNDLE CARD ON SHOP › YOUR BUNDLES AND SERVICES — it wears THE SERVICE CARD ROW (owner 11 Nov 2026, verbatim:
 * *"don't forget to reupdate the supplier dashboard artifact with the new service card and bundle card design rule."*;
 * DECISION_LOG 2026-11-11 "BUNDLE CARDS FOLLOW THE SERVICE CARD ROW RULE"; the approved `prototypes/service_card_row_
 * 2026-11-11/`).
 *
 *   · THE CARD IS THE ONLY FRAME — the bundle reads like a card (the ONE face Find draws, `ServiceCardFace`): its name,
 *     its one price, and what its cards come to alone. Tapping it opens the Bundle Maker.
 *   · UNDER IT, ONE ROW — THE SHIPPED `ServiceCardMenuRow` itself (PR #7464), never a copy: ✏ Edit (the Bundle Maker) ·
 *     ↗ Share · the worded Online/Offline switch. The bundle hands it `onToggle` (this card's one call, `bundleCardRow`)
 *     in place of a service card's door: going online is refused with EVERY missing item (`validatePackageDraft`, all
 *     problems, one per line), going offline while a booking is open.
 *   · SWIPE LEFT DELETES, through the shipped swipe, after the house delete warning (Cancel · Delete at equal widths),
 *     then the shipped Undo — the write waits for the Undo window.
 *   · OFF AND DELETE ARE REFUSED WHILE ANY BOOKING OF IT IS OPEN — the line under the row says so, and the server
 *     refuses the same (`bundleCardRow` → `setPackageActive` / `deletePackage`).
 *   · ↗ Share is drawn WAITING, as on the service card: posting into a client's chat sends a notice that is on the
 *     frozen email allowlist — held for the owner's call (PR #7464 says the same).
 *
 * 🔒 app/vendor-dashboard/shop/bundle-cards-wear-the-card-row.test.ts
 */
import { useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { Trash2, X } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { Sheet } from '@/app/_components/sheet';
import { deleteWithUndo, type CommitResult } from '@/app/_components/undo/delete-with-undo';
import { ServiceCardFace } from '@/app/vendor-dashboard/services/_components/service-card-face';
import { ServiceCardMenuRow } from '@/app/vendor-dashboard/services/_components/service-card-menu-row';
import { formatPhpRounded } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { BUNDLE_DELETE_WARNING, bundleHoldLine, bundleRowRefusal } from '@/lib/bundle-card-row';
import { bundleCardRow } from '@/app/vendor-dashboard/packages/actions';

const php = formatPhpRounded;

export type ShopBundle = {
  id: string;
  name: string;
  priceCentavos: number | null;
  live: boolean;
  /** The cards in it, by name, in the bundle's order. */
  cardNames: string[];
  /** What the couple gets — its cards' inclusions, merged (`gatherInclusions`). */
  includes: string[];
  /** Σ of its cards' own prices (what they come to alone), in pesos; null = a card has no price. */
  cardsAlonePhp: number | null;
  /** Open bookings of this bundle; null = could not be checked (off and delete are then refused, with words). */
  openBookings: number | null;
};

export function ShopBundleCard({ bundle }: { bundle: ShopBundle }) {
  const [live, setLive] = useState(bundle.live);
  const [gone, setGone] = useState(false);
  const [warn, setWarn] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const warnTitleId = `bundle-delete-${useId().replace(/:/g, '')}`;
  const editHref = `/vendor-dashboard/packages/${bundle.id}`;
  const hold = bundleHoldLine(bundle.openBookings);
  const total = bundle.priceCentavos != null ? Math.round(bundle.priceCentavos / 100) : null;
  const n = bundle.cardNames.length;

  function toggle() {
    if (live && hold) {
      setRefusal(hold);
      return;
    }
    setRefusal(null);
    const next = !live;
    start(async () => {
      const res = await bundleCardRow(bundle.id, next ? 'online' : 'offline');
      const why = bundleRowRefusal(res);
      if (why) setRefusal(why);
      else setLive(next);
    });
  }

  function onSwipeDelete(close: () => void) {
    close();
    if (hold) {
      setRefusal(hold);
      return;
    }
    setRefusal(null);
    setWarn(true);
  }

  function confirmDelete() {
    setWarn(false);
    deleteWithUndo({
      label: `${bundle.name} deleted`,
      hide: () => setGone(true),
      restore: () => setGone(false),
      commit: async (): Promise<CommitResult> => {
        const why = bundleRowRefusal(await bundleCardRow(bundle.id, 'delete'));
        if (why) {
          setRefusal(why);
          return { ok: false, error: why };
        }
        return { ok: true };
      },
    });
  }

  return (
    <li hidden={gone} className="space-y-2 border-b border-ink/10 pb-5 last:border-b-0 last:pb-0" data-shop-bundle={bundle.id} data-shop-bundle-live={live ? '1' : '0'}>
      <SwipeToDelete label={`Delete ${bundle.name}`} onDelete={onSwipeDelete} radiusClass="rounded-2xl" surfaceClass="bg-cream">
        <Link href={`/vendor-dashboard/packages/${bundle.id}`} className="block w-full" data-shop-bundle-open="" aria-label={`Open ${bundle.name} in the Bundle Maker`}>
          <ServiceCardFace
            snap={{
              name: bundle.name,
              // The bundle's one price, and — when it is lower — what its cards come to alone (the prototype's struck sum).
              priceText:
                total == null
                  ? 'No price yet'
                  : bundle.cardsAlonePhp != null && bundle.cardsAlonePhp > total
                    ? `${php(total)} · ${php(bundle.cardsAlonePhp)} as single cards`
                    : php(total),
              discountBadge: null,
              // The card face's own "Includes" line: the first three gathered inclusions, then "+N more".
              includesLine: bundle.includes.length > 0 ? [...bundle.includes.slice(0, 3), ...(bundle.includes.length > 3 ? [`+${formatCount(bundle.includes.length - 3)} more`] : [])].join(' · ') : null,
              notIncluded: [],
              hasExclusive: false,
              givesSetnayanGift: false,
              hasCover: false,
            }}
            leafPathLabel={n > 0 ? `Bundle · ${bundle.cardNames.join(' · ')}` : 'Bundle'}
            footer={null}
          />
        </Link>
      </SwipeToDelete>

      {/* THE ROW UNDER THE CARD — the service card's own row (Edit · Share · Online/Offline), the bundle's call behind it. */}
      <ServiceCardMenuRow
        vendorServiceId={bundle.id}
        cardName={bundle.name}
        isActive={live}
        held={false}
        editHref={editHref}
        onToggle={toggle}
        toggling={pending}
      />
      {refusal ? (
        <p role="alert" className="whitespace-pre-line text-[12.5px] leading-snug text-terracotta-700" data-bundle-refusal="">
          {refusal}
        </p>
      ) : null}

      <Sheet open={warn} onClose={() => setWarn(false)} labelledById={warnTitleId} title="Delete this bundle" rise>
        <div className="space-y-3 px-5 pb-2 pt-1">
          <h3 id={warnTitleId} className="text-[17px] font-semibold leading-snug text-ink">{`Delete “${bundle.name}”?`}</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-snug text-ink/75" data-bundle-delete-warning="">
            {BUNDLE_DELETE_WARNING.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <EqualRow data="bundle-delete">
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => setWarn(false)} data-bundle-delete-cancel="" />
            <ActionButton tone="danger" main icon={Trash2} label="Delete" onClick={confirmDelete} data-bundle-delete-confirm="" />
          </EqualRow>
        </div>
      </Sheet>
    </li>
  );
}
