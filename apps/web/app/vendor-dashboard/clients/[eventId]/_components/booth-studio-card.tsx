'use client';

import { InfoTip } from '@/app/_components/info-tip';
import { useState, useTransition } from 'react';
import { Type } from 'lucide-react';
import { setBoothStudioContent } from '../cocktail/actions';
import { BOOTH_STUDIO_LIMITS, type BoothStudioContent } from '@/lib/booth-studio';

/**
 * "Words on your booth" — the Booth Studio composer. A booked supplier writes a
 * headline, an offer and a price; the couple's 3D room draws them on the
 * supplier's booth IN THE COUPLE'S PALETTE (lib/booth-studio.ts), so the poster
 * sits inside the wedding instead of shouting over it.
 *
 * WHY IT EXISTS: the whole read path shipped in 20270928120000 — the scene RPC
 * carries poster_content, BoothMesh composes it — but the setter
 * (vendor_set_booth_studio_content) had no caller, so nobody could ever write
 * the words it was built to draw. This card is that missing end.
 *
 * Mounted only when NEXT_PUBLIC_BOOTH_STUDIO_ENABLED is on (the page gates it),
 * the same flag the renderer reads — so a supplier is never offered a field
 * that no guest will ever see.
 */
export function BoothStudioCard({
  eventId,
  initial,
}: {
  eventId: string;
  initial: BoothStudioContent | null;
}) {
  const [headline, setHeadline] = useState(initial?.headline ?? '');
  const [offer, setOffer] = useState(initial?.offer ?? '');
  const [price, setPrice] = useState(initial?.price ?? '');
  const [hasSaved, setHasSaved] = useState(initial !== null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const empty = !headline.trim() && !offer.trim() && !price.trim();

  function persist(content: BoothStudioContent | null) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await setBoothStudioContent(eventId, content);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (content) {
        setHasSaved(true);
        setNotice('Saved. It appears on your booth in their 3D plan, in their colours.');
      } else {
        setHeadline('');
        setOffer('');
        setPrice('');
        setHasSaved(false);
        setNotice('Removed from your booth.');
      }
    });
  }

  const field =
    'mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none';

  return (
    // 📐 Design template rule 2: a section, not a tinted card — a small label, the ⓘ for the explaining (rule 7).
    <div className="border-t border-ink/10 pt-4">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">
        <Type aria-hidden className="h-4 w-4 text-terracotta" />
        <InfoTip label="Words on your booth" align="start">
          A few words for <em>this</em> wedding&rsquo;s guests. We draw them on your booth in the couple&rsquo;s own
          colours, so it looks like part of their day, not an ad.
        </InfoTip>
      </h2>

      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (empty) return;
          persist({ headline, offer, price });
        }}
      >
        <label className="block text-xs font-medium text-ink/70">
          Headline
          <input
            className={field}
            value={headline}
            maxLength={BOOTH_STUDIO_LIMITS.headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Fresh blooms, all night"
            disabled={pending}
          />
        </label>
        <label className="block text-xs font-medium text-ink/70">
          Offer
          <input
            className={field}
            value={offer}
            maxLength={BOOTH_STUDIO_LIMITS.offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder="Ask us about a bouquet for your own wedding"
            disabled={pending}
          />
        </label>
        <label className="block text-xs font-medium text-ink/70">
          Price
          <input
            className={field}
            value={price}
            maxLength={BOOTH_STUDIO_LIMITS.price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="From ₱2,500"
            disabled={pending}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || empty}
            className="button-secondary h-10 px-4 text-sm disabled:opacity-50"
          >
            Save to my booth
          </button>
          {hasSaved ? (
            <button
              type="button"
              onClick={() => persist(null)}
              disabled={pending}
              className="text-sm font-medium text-ink/70 underline hover:text-ink disabled:opacity-50"
            >
              Remove the words
            </button>
          ) : null}
        </div>
      </form>

      {pending ? (
        <p role="status" className="mt-2 text-xs text-ink/70">Saving&hellip;
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger-700">{error}</p> : null}
      {notice && !error ? <p className="mt-2 text-xs text-ink/70">{notice}</p> : null}
    </div>
  );
}
