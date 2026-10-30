/**
 * 🔗🖼 THE SHOP PAGE'S "INSPIRATION" SECTION (owner 2026-10-30: DECISION_LOG "A SUPPLIER'S INSPIRATION PHOTO IS
 * CONNECTED FOUR WAYS …" item 3, drawn as the APPROVED website-by-plan design — corpus
 * `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/index.html`, `<section id="inspiration">`: eyebrow
 * "Inspiration ⓘ", the lede "N looks · each one belongs to a service card, or to the shop", a masonry of tiles — 2
 * columns on a phone, 3 on a tablet, 4 on a desktop — each tile the photo + its part + "Card · from ₱X" or
 * "<shop> · no card yet"). Placed where the design places it: after Packages, before the portfolio.
 *
 * A look WITH a card is pressable — it goes to that card on this page ("Open card" in the design's viewer); that is the
 * one press this section has, so only those tiles carry a frame (house rule: frames only on what you press). A look
 * with no card belongs to the shop and is drawn without one.
 *
 * ⚠ NOT DRAWN HERE (the design's full-screen viewer with ♥ Save and Ask): this build is the page's read; the viewer is
 * the couple side's template (`carry-2026-10-29`) and is a separate build. Said in the PR, not silently dropped.
 *
 * Server component — plain data in, no client JavaScript.
 */
import { InfoTip } from '@/app/_components/info-tip';

export type InspirationTile = {
  id: string;
  url: string;
  part: string;
  /** The linked card on THIS page: its name, its price line and its anchor. null = the shop only. */
  card: { label: string; priceLabel: string; anchorId: string } | null;
};

export function ShopInspirationSection({ tiles, shopName }: { tiles: readonly InspirationTile[]; shopName: string }) {
  if (tiles.length === 0) return null;
  return (
    <section id="inspiration" className="scroll-mt-24 space-y-3 border-b border-ink/10 py-8" data-shop-inspiration={tiles.length}>
      <header className="space-y-1">
        <InfoTip
          label="Inspiration"
          labelAs="h2"
          labelClassName="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
          align="start"
        >
          Every look this shop has shared, checked by Setnayan. A look belongs to one of its service cards — tap it to
          see that card and its price. A look with no card yet belongs to the shop; ask the shop about it.
        </InfoTip>
        <p className="text-sm text-ink/65">
          {tiles.length === 1 ? '1 look' : `${tiles.length} looks`} · each one belongs to a service card, or to the shop
        </p>
      </header>
      <ul className="columns-2 gap-2.5 sm:columns-3 lg:columns-4">
        {tiles.map((t) => (
          <li key={t.id} className="mb-2.5 break-inside-avoid">
            {t.card ? (
              <a
                href={`#${t.card.anchorId}`}
                className="block overflow-hidden rounded-xl border border-ink/10 bg-cream transition-colors hover:border-terracotta/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                aria-label={`${t.part} — ${t.card.label}, ${t.card.priceLabel}. Open the card`}
                data-inspiration-tile="card"
              >
                <TilePhoto url={t.url} part={t.part} />
                <span className="block px-2.5 pb-2 pt-1.5 text-[12.5px] leading-snug">
                  <b className="block font-medium text-ink">{t.part}</b>
                  <span className="block truncate text-ink/60">
                    {t.card.label} · {t.card.priceLabel}
                  </span>
                </span>
              </a>
            ) : (
              <div data-inspiration-tile="shop">
                <TilePhoto url={t.url} part={t.part} rounded />
                <span className="block px-0.5 pb-1 pt-1.5 text-[12.5px] leading-snug">
                  <b className="block font-medium text-ink">{t.part}</b>
                  <span className="block truncate text-ink/60">{shopName} · no card yet</span>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TilePhoto({ url, part, rounded = false }: { url: string; part: string; rounded?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an approved library photo (public bucket); masonry keeps its own height
    <img src={url} alt={part} loading="lazy" className={`block h-auto w-full bg-ink/5 ${rounded ? 'rounded-xl' : ''}`} />
  );
}
