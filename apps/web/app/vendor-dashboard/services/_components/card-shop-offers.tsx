'use client';

/**
 * 🏷 SHOP OFFERS ON THIS CARD (Card Maker part 3 · v36 Decided "Offer" · ruling 280d53a9 "Yes, extend it").
 *
 * Inside the shipped one-page maker (More settings › Discounts), on a card that exists (Edit). It lists the shop's
 * offers that reach this card — "Also on 1 other card" · "On all your cards" — with **Take off** (this card), and one
 * dropdown, **Put an offer on this card**, listing the others. **＋ New offer** opens the shipped Offer Maker with this
 * card picked. Couples already see only the best one (`pickBestDiscount`); nothing about that changes.
 *
 * 🔑 NO NEW WRITER, NO NEW READ PATH: it calls the shipped `offerMaker` dispatcher — `load` (read lazily, the first time
 * the fold opens, never on page load) and `save` / `switch` (each with Undo). Every write goes through the Offer Maker's
 * own lock (`canUse('offerMaker')`) and checks (`offerProblem`), so the two screens can never disagree.
 * 🔑 A SAVE NEVER RESETS THE SCREEN: the list updates in place from the stored offer the action returns.
 * 🔑 HONEST: a refused read says so — never "No offers yet". Locked (not Verified) shows the shared lock, Problem →
 *    Solution. Nothing here is a form field: no `name=`, so the card's own Save posts nothing new.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RotateCw, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow } from '@/app/_components/form-row';
import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { pushUndo, guestToast } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { offerMaker, type OfferReply } from '@/app/vendor-dashboard/offers/actions';
import { papersProgress } from '@/lib/locks';
import { offerStatus, priceWords, type Offer } from '@/lib/offers';
import { SHOP_OFFERS_UNREAD, newOfferHref, offerTitle, offersOffCard, offersOnCard, otherCardsLine, withCard, withoutCard } from '@/lib/card-shop-offers';

export type CardShopOffersState =
  | { k: 'idle' }
  | { k: 'loading' }
  | { k: 'locked' }
  | { k: 'unread'; message: string }
  | { k: 'ok'; offers: Offer[]; cardIds: string[]; today: string };

/** The offer a reply carries, when it carries one (`{ ok: true }` alone is a switch, which returns none). */
function savedOffer(r: OfferReply): Offer | null {
  return r.ok && 'offer' in r ? (r.offer as Offer) : null;
}

export function CardShopOffers({
  cardId,
  initial,
}: {
  cardId: string;
  /** A state handed in (the dev lab's sample offers, with no database); the card itself never passes one. */
  initial?: CardShopOffersState;
}) {
  const [state, setState] = useState<CardShopOffersState>(initial ?? { k: 'idle' });
  const [busy, setBusy] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  /* Read the first time the fold around it opens (its parts lose `inert`), never on page load. */
  const load = useCallback(async () => {
      setState({ k: 'loading' });
      const r = await offerMaker({ op: 'load' }).catch(() => null);
      if (!r || !r.ok) {
        setState(r && 'locked' in r && r.locked ? { k: 'locked' } : { k: 'unread', message: SHOP_OFFERS_UNREAD });
        return;
      }
      if (!('data' in r) || r.data.offers === null || r.data.cards === null) {
        setState({ k: 'unread', message: SHOP_OFFERS_UNREAD });
        return;
      }
      setState({ k: 'ok', offers: r.data.offers, cardIds: r.data.cards.map((c) => c.id), today: r.data.today });
  }, []);

  useEffect(() => {
    if (initial) return;
    const parts = root.current?.closest('[data-form-row-parts]');
    if (!parts || !parts.hasAttribute('inert')) {
      void load();
      return;
    }
    const watch = new MutationObserver(() => {
      if (parts.hasAttribute('inert')) return;
      watch.disconnect();
      void load();
    });
    watch.observe(parts, { attributes: true, attributeFilter: ['inert'] });
    return () => watch.disconnect();
  }, [initial, load]);

  const replace = (next: Offer) =>
    setState((s) => (s.k === 'ok' ? { ...s, offers: s.offers.map((o) => (o.id === next.id ? next : o)) } : s));

  /** Save one offer as changed, in place; Undo saves it back as it was. */
  const write = async (before: Offer, after: Offer | { switchOff: true }, label: string) => {
    setBusy(before.id);
    const r = 'switchOff' in after ? await offerMaker({ op: 'switch', id: before.id, on: false }).catch(() => null) : await offerMaker({ op: 'save', offer: after }).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) {
      guestToast.error(r && !r.ok ? r.message : 'Couldn’t save your offer — check your connection and try again.');
      return;
    }
    replace(savedOffer(r) ?? { ...before, isOn: false });
    pushUndo({
      label,
      undo: async () => {
        const back = 'switchOff' in after ? await offerMaker({ op: 'switch', id: before.id, on: true }) : await offerMaker({ op: 'save', offer: before });
        if (back.ok) replace(savedOffer(back) ?? before);
        else guestToast.error(back.message);
      },
    });
  };

  return (
    <div ref={root} className="space-y-2 pb-3 pt-1" data-card-shop-offers="">
      {state.k === 'idle' || state.k === 'loading' ? (
        <p className="py-2 text-[13px] text-ink/60" role="status" data-card-shop-offers-state="loading">
          Reading your offers…
        </p>
      ) : state.k === 'locked' ? (
        <LockedFeature lock="offerMaker" need={{ kind: 'verify', progress: papersProgress(null) }} data="card-shop-offers-lock" />
      ) : state.k === 'unread' ? (
        <div className="flex items-center gap-3 py-1" data-card-shop-offers-state="unread">
          <p className="min-w-0 flex-1 text-[13px] text-ink/70" role="status">
            {state.message}
          </p>
          <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={() => void load()} />
        </div>
      ) : (
        <OfferList
          cardId={cardId}
          offers={state.offers}
          today={state.today}
          busy={busy}
          onTakeOff={(o) => {
            const next = withoutCard(o, cardId, state.cardIds);
            void write(o, next ?? { switchOff: true }, next ? `“${offerTitle(o)}” taken off this card` : `“${offerTitle(o)}” switched off`);
          }}
          onPut={(o) => void write(o, withCard(o, cardId), `“${offerTitle(o)}” is on this card`)}
        />
      )}
    </div>
  );
}

function OfferList({
  cardId,
  offers,
  today,
  busy,
  onTakeOff,
  onPut,
}: {
  cardId: string;
  offers: Offer[];
  today: string;
  busy: string | null;
  onTakeOff: (o: Offer) => void;
  onPut: (o: Offer) => void;
}) {
  const on = offersOnCard(offers, cardId);
  const off = offersOffCard(offers, cardId);
  return (
    <>
      {on.length === 0 ? (
        <p className="py-1 text-[13px] text-ink/60" data-card-shop-offers-state="none">
          No shop offer is on this card yet.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0" data-card-shop-offers-on="">
          {on.map((o) => {
            const status = offerStatus(o, today);
            const only = !o.reachesAll && o.cards.filter((c) => c !== cardId).length === 0;
            return (
              <li key={o.id} className="sn-row flex items-center gap-3 px-3 py-2" data-card-shop-offer={o.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold">{offerTitle(o)}</p>
                  <p className="text-[12.5px] leading-snug text-ink/60">
                    {[priceWords(o), otherCardsLine(o, cardId), status.k === 'run' ? '' : status.label].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {status.k === 'off' && only ? null : (
                  <ActionButton
                    tone="neutral"
                    icon={X}
                    label={only ? 'Switch off' : 'Take off'}
                    waiting={busy === o.id}
                    onClick={() => onTakeOff(o)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {off.length > 0 ? (
        <ChosenRow
          name="Put an offer on this card"
          label="Your offers"
          value={null}
          buttonText="Pick one"
          options={off.map((o) => ({ key: o.id, label: offerTitle(o) }))}
          onPick={(id) => {
            const o = off.find((x) => x.id === id);
            if (o) onPut(o);
          }}
          dataAttr="data-card-shop-offers-put"
          data="card-shop-offers-put"
        />
      ) : null}
      <div className="flex">
        <ActionButton tone="brand" icon={Plus} label="New offer" href={newOfferHref(cardId)} />
      </div>
    </>
  );
}
