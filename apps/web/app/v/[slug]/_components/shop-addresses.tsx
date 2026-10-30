import { Globe } from 'lucide-react';

/**
 * The page's addresses (supplier website by plan, owner-approved 2026-10-30): every plan shows its Setnayan address;
 * Pro and Ultra also show their own web address pointing at this page (approved Q4 = A — "the shop's own domain
 * pointing at the page", `custom_domains`, verified rows only). Text, not links: the visitor is already here.
 */
export function ShopAddresses({ setnayanAddress, ownAddress }: { setnayanAddress: string; ownAddress: string | null }) {
  return (
    <p data-shop-addresses="" className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink/55">
      <Globe aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      {ownAddress ? (
        <span data-shop-own-address="">
          <span className="font-semibold text-ink/80">{ownAddress}</span> → this page ·
        </span>
      ) : null}
      <span>{setnayanAddress}</span>
    </p>
  );
}
