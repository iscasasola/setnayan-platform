import { hasntAfter } from '../../_lib/names-verb';
import { WishList } from './wish-list';
import { GiftTell } from './gift-tell';
import { PabuyaCardList, PabuyaTrustNote } from '@/app/_components/pabuya/pabuya-card-list';
import { GIFT_DETAILS_WITHHELD_LINE, type GiftPageContent } from '../_lib/gift-cards';

/**
 * 🎁 THE E-GIFTS CONTENT — the couple's words, their registry, the wish list, the ways to give and the trust note —
 * drawn ONCE, here, for both places a guest meets it: `/[slug]/pabuya` and the Welcome page (owner 2026-10-14: *"can't
 * we just have it there instead of a button?"*). Every value arrives in `content` from the one reader
 * (`loadGiftPage`): identifiers are already withheld from a reader the event does not recognise, and nothing here
 * reads a method, a row or a cookie — so it cannot show a number the reader would not have been shown.
 *
 * `wishLimit` is the Welcome page's calm cut: the ways to give in full, the wish list short with "See all" opening the
 * rest in place (`WishList` `limit`). The gift page passes none and draws every wish, as before.
 */
export function GiftPageBody({ content, wishLimit }: { content: GiftPageContent; wishLimit?: number }) {
  const { cards, wishes, identifiersWithheld, hostName, words, registryHref, message } = content;
  return (
    <div data-gift-page-body="">
      {/*
        THE COUPLE'S OWN WORDS — owner 2026-09-15.

        🔑 ABOVE THE METHODS, because it is the part a guest weighs before
        deciding. The page could already say what to DO ("scan a QR"); it had
        nowhere to say WHY, and a money page without the reason reads as a
        request rather than a plan somebody is inviting you into.

        ⚠ NULL RENDERS NOTHING AT ALL — not an empty paragraph. Every event
        that has never touched this reads exactly as it did before the column
        existed, which is why there is no backfill and no default sentence.
      */}
      {message ? (
        <p className="mx-auto mb-8 max-w-prose text-center text-[15px] leading-relaxed text-ink/75">
          {message}
        </p>
      ) : null}

      {/* 🔗 THE REGISTRY (owner 2026-10-07, Studio › E-Gifts › "Paste a link to your
          registry"): one quiet link when the couple set one — http(s) only, read
          through the same rule its writer used (`giftRegistryHref`). */}
      {registryHref ? (
        <p data-gift-registry="" className="mx-auto mb-8 max-w-prose text-center text-[15px]">
          <a href={registryHref} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-ink underline underline-offset-4">
            Our gift registry ↗
          </a>
        </p>
      ) : null}

      {/* 🎁 THE WISH LIST — above the ways to give: a wish is what you give toward, the ways
          are how. Its send sheet is handed the page's OWN cards (`cards`, identifiers
          already withheld from a reader the event does not recognise), drawn a second
          time under their own element ids. */}
      {wishes.length > 0 ? (
        <WishList
          wishes={wishes}
          shape={content.wishShape}
          hostName={hostName}
          hostPossessive={content.hostPossessive}
          limit={wishLimit}
          ways={
            <>
              <PabuyaCardList methods={cards} idScope="wish-send-handle" />
              {identifiersWithheld ? (
                <p className="mt-3 text-center text-sm text-ink/65">
                  {GIFT_DETAILS_WITHHELD_LINE}
                </p>
              ) : null}
            </>
          }
          record={content.reader}
        />
      ) : null}

      {cards.length > 0 ? (
        <div data-gift-ways="">
          {/* With a wish list above them, the ways to give are named — without one the page is unchanged. */}
          {wishes.length > 0 ? (
            <p data-ways-to-give-eyebrow="" className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta-700">
              Ways to give
            </p>
          ) : null}
          <PabuyaCardList methods={cards} />
          {/* 🔑 SAY THAT SOMETHING IS WITHHELD, AND WHY. A card showing a bank
              with no number and no QR, and no sentence, reads as a couple who
              filled the form in wrong. This is the difference between a gate
              and a bug. */}
          {identifiersWithheld ? (
            <p className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-6 text-center text-sm text-ink/65">
              {GIFT_DETAILS_WITHHELD_LINE}
            </p>
          ) : null}
          {/* 🎁 A gift toward NO wish: the same "show them" sheet, with no wish named. */}
          <GiftTell hostName={hostName} record={content.reader} />
        </div>
      ) : registryHref ? null : (
        <p className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-10 text-center text-sm text-ink/70">
          {hostName} {hasntAfter(content.displayName, words.twoPeople)} set up e-gifts yet. Check back soon — or
          visit their page in the meantime.
        </p>
      )}

      <div data-gift-trust="" className="mt-6">
        <PabuyaTrustNote audience="guest" organizerPossessive={words.theOrganizerPossessive} />
      </div>
    </div>
  );
}
