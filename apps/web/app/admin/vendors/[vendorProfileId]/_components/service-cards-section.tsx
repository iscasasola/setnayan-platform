import Link from 'next/link';
import { ImageOff, LayoutGrid } from 'lucide-react';

import { ReadFailed } from '@/app/admin/_components/read-failed';
import { CARD_STATUS_LABEL, type CardStatus } from '@/lib/service-card-moderation';
import { moderateServiceCard } from '../card-actions';
import { CardReasonForm } from './card-reason-form';

/**
 * "Service cards" on the admin supplier page — every card the shop has, live or
 * not, with the three moderation actions (take down · put back · remove photo).
 * A server component; the only client code is the reason field
 * (`CardReasonForm`, the house Field template).
 *
 * `cards === null` means the read was REFUSED, and it says so — never "No
 * cards yet" over a shop that has them.
 */

export type AdminCardPhoto = { key: string; url: string | null };

export type AdminServiceCard = {
  id: string;
  publicId: string | null;
  title: string;
  kind: string;
  price: string;
  status: CardStatus;
  takenDownReason: string | null;
  cover: AdminCardPhoto | null;
  showcase: AdminCardPhoto[];
  /** The card on the shop's public page, or null when couples cannot open it. */
  publicHref: string | null;
};

const STATUS_CHIP: Readonly<Record<CardStatus, string>> = {
  live: 'bg-success-100 text-success-900',
  draft: 'bg-ink/10 text-ink/70',
  taken_down: 'bg-danger-100 text-danger-900',
};

function Thumb({ photo, label }: { photo: AdminCardPhoto; label: string }) {
  return photo.url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a signed/stored ref, not a static asset
    <img src={photo.url} alt={label} className="h-full w-full object-cover" loading="lazy" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-ink/5 text-ink/40" title={photo.key}>
      <ImageOff aria-hidden className="h-5 w-5" strokeWidth={1.5} />
      <span className="sr-only">{label} (preview unavailable)</span>
    </span>
  );
}

function RemovePhoto({
  shopId,
  card,
  photo,
  slot,
  label,
}: {
  shopId: string;
  card: AdminServiceCard;
  photo: AdminCardPhoto;
  slot: 'cover' | 'showcase';
  label: string;
}) {
  return (
    <details>
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-xs font-medium text-ink underline underline-offset-2">
        Remove photo
      </summary>
      <CardReasonForm
        op="remove_photo"
        shopId={shopId}
        cardId={card.id}
        slot={slot}
        photoKey={photo.key}
        label={`Why remove this ${label.toLowerCase()}?`}
        submit="Remove this photo"
      />
    </details>
  );
}

export function ServiceCardsSection({
  shopId,
  cards,
  cap,
}: {
  shopId: string;
  cards: AdminServiceCard[] | null;
  cap: number;
}) {
  return (
    <section id="cards" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-ink">Service cards</h2>
        {cards ? (
          <p className="text-xs text-ink/55">
            {cards.length === 1 ? '1 card' : `${cards.length} cards`}
            {cards.length >= cap ? ` — showing the first ${cap}` : ''}
          </p>
        ) : null}
      </div>

      {cards === null ? (
        <ReadFailed what="this supplier's service cards" />
      ) : cards.length === 0 ? (
        <div className="sn-tile flex items-start gap-3 p-5 text-sm text-ink/70">
          <LayoutGrid aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <p>No service cards yet. A card appears here as soon as the supplier saves one, even as a draft.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id} id={`card-${card.id}`} className="sn-tile scroll-mt-20 p-4">
              <div className="flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-24">
                  {card.cover ? (
                    <Thumb photo={card.cover} label="Cover photo" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-ink/5 text-center text-[11px] text-ink/50">
                      No cover
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words text-sm font-medium text-ink">{card.title}</p>
                  <p className="text-xs text-ink/60">
                    {card.kind} · {card.price}
                  </p>
                  <p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[card.status]}`}>
                      {CARD_STATUS_LABEL[card.status]}
                    </span>
                  </p>
                  {card.publicId ? <p className="font-mono text-[11px] text-ink/50">{card.publicId}</p> : null}
                </div>
              </div>

              {card.status === 'taken_down' && card.takenDownReason ? (
                <p className="mt-3 rounded-lg bg-danger-100/60 p-2 text-xs text-ink">
                  <span className="font-medium">Why: </span>
                  {card.takenDownReason}
                </p>
              ) : null}

              {card.cover || card.showcase.length > 0 ? (
                <div className="mt-3">
                  <h3 className="mb-1 text-xs text-ink/55">Photos</h3>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {card.cover ? (
                      <li className="space-y-1">
                        <div className="aspect-square overflow-hidden rounded-md ring-2 ring-ink/30">
                          <Thumb photo={card.cover} label="Cover photo" />
                        </div>
                        <p className="text-[11px] text-ink/55">Cover</p>
                        <RemovePhoto shopId={shopId} card={card} photo={card.cover} slot="cover" label="Cover photo" />
                      </li>
                    ) : null}
                    {card.showcase.map((photo, i) => (
                      <li key={photo.key} className="space-y-1">
                        <div className="aspect-square overflow-hidden rounded-md">
                          <Thumb photo={photo} label={`Showcase photo ${i + 1}`} />
                        </div>
                        <p className="text-[11px] text-ink/55">Showcase {i + 1}</p>
                        <RemovePhoto shopId={shopId} card={card} photo={photo} slot="showcase" label="Showcase photo" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-1">
                {card.publicHref ? (
                  <Link
                    href={card.publicHref}
                    target="_blank"
                    className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink underline underline-offset-2"
                  >
                    Open the public card
                  </Link>
                ) : (
                  <span className="inline-flex min-h-[44px] items-center text-sm text-ink/55">Not public</span>
                )}

                {card.status === 'taken_down' ? (
                  <form action={moderateServiceCard}>
                    <input type="hidden" name="op" value="put_back" />
                    <input type="hidden" name="vendor_profile_id" value={shopId} />
                    <input type="hidden" name="vendor_service_id" value={card.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] items-center rounded-lg bg-ink/5 px-4 text-sm font-medium text-ink hover:bg-ink/10"
                    >
                      Put back
                    </button>
                  </form>
                ) : (
                  <details className="w-full sm:w-96">
                    <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center rounded-lg bg-ink/5 px-4 text-sm font-medium text-ink hover:bg-ink/10">
                      Take down card
                    </summary>
                    <CardReasonForm
                      op="take_down"
                      shopId={shopId}
                      cardId={card.id}
                      label="Why take this card down?"
                      note="Couples stop seeing it at once. The supplier is told why and cannot publish it again until you put it back."
                      submit="Take down"
                    />
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
