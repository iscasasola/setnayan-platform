'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { addChoices, NEW_BUNDLE_HREF } from '@/lib/shop-add-choices';

/**
 * 🧰 SHOP › YOUR SERVICES — the section's head (Build 3 Lane E items 5–6; prototype § 4, approved v3).
 *
 *   · Item 5 (owner: *"Services could have its compressed row when we reach here"*): when the section reaches the top,
 *     its head COMPRESSES into ONE sticky row — "Your services · 1 bundle · 2 cards" · ＋ — like the chat's pinned row.
 *     The 0.7 s house motion (`--sn-pill-dur` + the family spring), never a hand-typed duration; reduced motion = the
 *     same two end states with no movement (the global rule stills transitions).
 *   · Item 6 (owner: *"No need to add coverage. Just add services"* · *"Create new bundle and create new service"*): the
 *     ONE add control offers exactly two choices — New bundle · New service. The "Add a service or coverage" dropdown
 *     and the "+ Add a service" link are gone; the thumb row's ＋ is the same control (`shop-services-thumb.tsx`).
 *   · 9 Nov (owner, verbatim: *"Your Bundles and Services instead of Your services"*): the head and its pinned row read
 *     **Your bundles and services** — bundles are listed first in it.
 * 🔒 shop/the-services-are-one-list.test.ts · shop/bundle-cards-wear-the-card-row.test.ts
 */

export function ShopServicesHead({ line, compact, serviceHref, bundlesOn }: { line: string; compact: string; serviceHref: string; bundlesOn: boolean }) {
  const router = useRouter();
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // The head is stuck once the line just above it has scrolled under the Shop's own pinned row (44 px).
    const io = new IntersectionObserver(([e]) => setStuck(!e!.isIntersecting && e!.boundingClientRect.top < 60), { rootMargin: '-45px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const go = (k: string) => router.push(k === 'bundle' ? NEW_BUNDLE_HREF : serviceHref);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <div
        className="sticky top-11 z-[5] -mx-4 px-4"
        style={{
          background: 'var(--sn-canvas)',
          boxShadow: stuck ? '0 1px 0 color-mix(in srgb, var(--m-ink) 8%, transparent)' : undefined,
          transition: 'box-shadow var(--sn-pill-dur) var(--sn-pill-spring)',
        }}
        data-shop-services-head={stuck ? 'compact' : 'full'}
      >
        <div className="flex min-h-11 items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="shop-services-h" className="sn-eye truncate">
              Your bundles and services
              <span
                className="font-sans normal-case tracking-normal text-ink/70"
                style={{ opacity: stuck ? 1 : 0, transition: 'opacity var(--sn-pill-dur) var(--sn-pill-spring)' }}
                aria-hidden={!stuck}
              >
                {' '}
                · {compact}
              </span>
            </h2>
            <p
              className="overflow-hidden text-[12.5px] leading-snug text-ink/70"
              style={{
                maxHeight: stuck ? 0 : 40,
                opacity: stuck ? 0 : 1,
                transition: 'max-height var(--sn-pill-dur) var(--sn-pill-spring), opacity var(--sn-pill-dur) var(--sn-pill-spring)',
              }}
              data-shop-services-line=""
            >
              {line}
            </p>
          </div>
          <PickMenu
            label="Add"
            value={null}
            options={addChoices(bundlesOn).map((c) => ({ key: c.key, label: c.label }))}
            onPick={go}
            compact
            dataAttr="data-shop-services-add"
            trigger={
              <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-[rgb(var(--sn-accent))] text-[rgb(var(--sn-on-accent))]">
                <Plus className="h-5 w-5" strokeWidth={2} />
              </span>
            }
          />
        </div>
      </div>
    </>
  );
}
