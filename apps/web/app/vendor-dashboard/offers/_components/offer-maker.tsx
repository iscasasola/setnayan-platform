'use client';

/**
 * 🏷 SHOP › OFFERS — THE OFFER MAKER (Build 6 · Lane D). Owner 9 Nov 2026: *"Offer maker"* · *"Improve offer ui and ux"*
 * · *"We want to mix them all"*; 10 Nov: *"service cards can receive multiple offer templates. but only the best offer
 * will show"*; 11 Nov: *"our offer maker already solves this"* (the off-season offer is Who gets it → Event date in a
 * season). THE PROTOTYPE IS THE CONTRACT: Setnayan-specs `prototypes/shop_discounts_bundle_card_open_2026-11-09/
 * discount-maker.html` (artifact 1fdSN1HRkYWm1nfbpYRteh, `src/screens.js` → `discountsScreen` · `offersList` · `orow`).
 *
 *   · RISES FULL SCREEN from its Makers tile (the shared `RiseScreen`: the bars step away, ✕ is the exact reverse).
 *   · ONE short line under the title ("2 running · 1 not · most cards show 10% off"); the per-card strip waits in the ⓘ.
 *   · ONE list — Running first, then Off, then Ended / taken. Each row reads in full: the tile (the price parts stacked,
 *     marks for a first payment and a gift) · the name · the mix · ONE honest status chip · who · which cards · until —
 *     and a switch. Swipe left removes it, with Undo (`deleteWithUndo`: nothing is written until the window closes).
 *   · Tap a row → the editor rises from it (`offer-editor.tsx`). ＋ asks "What do they get?" (a dropdown) and opens the
 *     editor on that part. Search filters the list in place; the filter is one dropdown.
 *   · A refused read says "Couldn't load" — never "No offers yet" (the 2026-08-20 rule).
 *   · 🔒 Behind the shared lock: an unverified shop never reaches this (the Makers tile shows Problem → Solution), and
 *     every write asks `canUse('offerMaker')` on the server (`../actions.ts`).
 *
 * ⏳ STILL OPEN (owner, not built — listed in the PR): "spreading expected bookings" (lib/offers.ts) and
 *   TODO(owner, Bundle Maker): "Send to this couple" truncates at 320 — the Bundle Maker's thumb button, not built here.
 *
 * Not drawn, on purpose (named in the PR): the prototype's "Your payment plan" door (no shop-wide default plan exists
 * on main — it arrives with the Bundle Maker) and offers on BUNDLES (the Bundle Maker lane).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Gift, Plus, Search, Tag, Wallet } from 'lucide-react';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { ActionButton } from '@/components/action-button';
import { BADGE_CLASS } from '@/app/_components/badge';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pickBestDiscount } from '@/lib/vendor-service-public';
import { formatCount } from '@/lib/format-number';
import {
  firstPaymentWords,
  giftName,
  offerCandidatesFor,
  offerStatus,
  PART_LABEL,
  priceWords,
  sortOffers,
  whatTile,
  whoShort,
  type Offer,
  type OfferCard,
  type OfferPart,
} from '@/lib/offers';
import type { OfferMakerData } from '@/lib/offer-maker.server';
import { offerMaker } from '../actions';
import { OfferEditor, type EditorStart } from './offer-editor';

export type OfferMakerStart = EditorStart | null;

/** The winning price result on one card — the SAME call couples get (the card's rows + every offer). */
export function bestOn(card: OfferCard, offers: readonly Offer[], today: string) {
  if (card.pricePhp == null) return null;
  return pickBestDiscount([...(card.discounts ?? []), ...offerCandidatesFor(offers, card.id, today)], card.pricePhp);
}

/** "2 running · 1 not · most cards show 10% off" — the one short line under the title. */
export function summaryLine(offers: readonly Offer[], cards: readonly OfferCard[], today: string): string {
  if (!offers.length) return 'No offers yet · couples pay the card price';
  const run = offers.filter((o) => offerStatus(o, today).k === 'run').length;
  const rest = offers.length - run;
  const wins = new Map<string, number>();
  for (const c of cards) {
    const b = bestOn(c, offers, today);
    const o = b?.offerId ? offers.find((x) => x.id === b.offerId) : null;
    if (o) wins.set(priceWords(o), (wins.get(priceWords(o)) ?? 0) + 1);
  }
  const top = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];
  return `${formatCount(run)} running${rest ? ` · ${formatCount(rest)} not` : ''}${top ? ` · most cards show ${top[0]}` : ' · no price offer reaches a card'}`;
}

/** The mix, spelled out under the name: every part, in order. */
export function mixLine(o: Offer, d: Pick<OfferMakerData, 'gifts'>): string {
  const gifts = !o.gifts.length
    ? ''
    : o.giftMode === 'per'
      ? `Gift by card · ${new Set(o.gifts.map((g) => g.card)).size}`
      : d.gifts
        ? o.gifts.map((g) => giftName(g, d.gifts!)).join(' + ')
        : `${o.gifts.length} ${o.gifts.length === 1 ? 'gift' : 'gifts'}`;
  return [priceWords(o), firstPaymentWords(o), gifts].filter(Boolean).join(' · ') || 'Nothing picked yet';
}

const TONE: Record<string, { bg: string; fg: string }> = {
  price: { bg: 'var(--m-sage)', fg: 'var(--m-ink)' },
  first: { bg: 'rgb(var(--color-info) / .14)', fg: 'rgb(var(--color-info))' },
  gift: { bg: 'var(--m-orange-4)', fg: 'var(--m-orange-deep)' },
  none: { bg: 'var(--m-paper-2)', fg: 'var(--m-slate)' },
};
const CHIP: Record<string, { bg: string; fg: string }> = {
  run: { bg: 'rgb(var(--color-ok) / .12)', fg: 'rgb(var(--color-ok))' },
  off: { bg: 'var(--m-paper-2)', fg: 'var(--m-slate-2)' },
  ended: { bg: 'rgb(var(--color-warn) / .12)', fg: 'rgb(var(--color-warn))' },
  taken: { bg: 'rgb(var(--color-warn) / .12)', fg: 'rgb(var(--color-warn))' },
};

/** The tile at a row's left: the price parts stacked, then small marks (prototype `whatTileHtml`). */
export function OfferTile({ offer, off }: { offer: Offer; off: boolean }) {
  const t = whatTile(offer);
  const tone = off ? TONE.none! : TONE[t.tone]!;
  return (
    <span
      aria-hidden
      className="flex min-h-12 w-[60px] flex-none flex-col items-center justify-center gap-px rounded-xl px-1 py-1 leading-none tabular-nums"
      style={{ background: tone.bg, color: tone.fg }}
      data-offer-tile={t.tone}
    >
      {t.bigs.length ? (
        t.bigs.map((b) => (
          <b key={b} className="whitespace-nowrap text-xs font-bold tracking-tight">
            {b}
          </b>
        ))
      ) : t.tone === 'gift' ? (
        <Gift className="h-5 w-5" strokeWidth={1.75} />
      ) : (
        <Tag className="h-5 w-5" strokeWidth={1.75} />
      )}
      <small className="text-xs leading-tight">{t.small}</small>
      {t.marks.length ? (
        <span className="mt-[3px] flex gap-[3px]">
          {t.marks.map((m) => (m === 'wallet' ? <Wallet key={m} className="h-[11px] w-[11px]" /> : <Gift key={m} className="h-[11px] w-[11px]" />))}
        </span>
      ) : null}
    </span>
  );
}

export function StatusChip({ offer, today }: { offer: Offer; today: string }) {
  const s = offerStatus(offer, today);
  const c = CHIP[s.k]!;
  return (
    <span className={BADGE_CLASS} style={{ background: c.bg, color: c.fg }} data-offer-status={s.k}>
      {s.label}
    </span>
  );
}

type Filter = 'all' | 'run' | 'not';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Every offer' },
  { key: 'run', label: 'Running' },
  { key: 'not', label: 'Off · Ended · taken' },
];

export function OfferMaker({ onClose, start = null }: { onClose: () => void; start?: OfferMakerStart }) {
  const [read, setRead] = useState<{ ok: true; data: OfferMakerData } | { ok: false; message: string } | null>(null);
  useEffect(() => {
    let live = true;
    offerMaker({ op: 'load' })
      .then((r) => live && setRead(r.ok && 'data' in r ? r : { ok: false, message: r.ok ? 'Couldn’t load your offers.' : r.message }))
      .catch(() => live && setRead({ ok: false, message: 'Couldn’t load your offers — check your connection.' }));
    return () => {
      live = false;
    };
  }, []);
  const data = read?.ok ? read.data : null;
  return (
    <>
      {data ? (
        <OffersScreen data={data} onClose={onClose} start={start} />
      ) : (
        <RiseScreen title="Offers" line={read ? 'Couldn’t load' : 'Opening your offers…'} onClose={onClose} data="offer-maker">
          <p role={read ? 'alert' : 'status'} className="px-4 py-6 text-sm text-ink/70" data-offers-read={read ? 'refused' : 'loading'}>
            {read && !read.ok ? read.message : 'Opening your offers…'}
          </p>
        </RiseScreen>
      )}
      <UndoToastHost />
    </>
  );
}

/** The list itself — the maker after its read (exported for `/dev/offer-maker-lab`, which hands it fixture data and,
 *  for a screenshot, `openId` to draw an offer already risen). */
export function OffersScreen({ data, onClose, start, openId = null }: { data: OfferMakerData; onClose: () => void; start: OfferMakerStart; openId?: string | null }) {
  const today = data.today;
  const [offers, setOffers] = useState<Offer[] | null>(data.offers);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<{ offer: Offer | null; start: EditorStart | null; origin: HTMLElement | null } | null>(
    start ? { offer: null, start, origin: null } : openId && data.offers?.some((o) => o.id === openId) ? { offer: data.offers.find((o) => o.id === openId)!, start: null, origin: null } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const addRef = useRef<HTMLSpanElement | null>(null);
  const cards = data.cards ?? [];

  const shown = useMemo(() => {
    if (!offers) return [];
    const q = query.trim().toLowerCase();
    return sortOffers(offers, today).filter((o) => {
      if (hidden.has(o.id)) return false;
      const k = offerStatus(o, today).k;
      if (filter === 'run' && k !== 'run') return false;
      if (filter === 'not' && k === 'run') return false;
      return !q || `${o.name} ${mixLine(o, data)}`.toLowerCase().includes(q);
    });
  }, [offers, hidden, query, filter, today, data]);
  const live = (offers ?? []).filter((o) => !hidden.has(o.id));
  const running = live.filter((o) => offerStatus(o, today).k === 'run').length;

  const toggle = async (o: Offer) => {
    if (!offers) return;
    const on = !o.isOn;
    setOffers(offers.map((x) => (x.id === o.id ? { ...x, isOn: on } : x)));
    const r = await offerMaker({ op: 'switch', id: o.id, on });
    if (!r.ok) {
      setOffers((list) => (list ?? []).map((x) => (x.id === o.id ? { ...x, isOn: !on } : x)));
      setError(r.message);
    }
  };

  const remove = (o: Offer) =>
    deleteWithUndo({
      label: `“${o.name}” removed`,
      hide: () => setHidden((h) => new Set(h).add(o.id)),
      restore: () =>
        setHidden((h) => {
          const n = new Set(h);
          n.delete(o.id);
          return n;
        }),
      commit: async () => {
        const r = await offerMaker({ op: 'remove', id: o.id });
        if (r.ok) setOffers((list) => (list ?? []).filter((x) => x.id !== o.id));
        return r.ok ? { ok: true } : { ok: false, error: r.message };
      },
      failed: 'Couldn’t remove that offer. It’s back — try again.',
    });

  const info = (
    <div className="space-y-2" data-offers-about="">
      <p>
        <b>Couples get the single best offer they qualify for.</b> Several offers can be on at once. Of the % or ₱ off offers, a couple gets only the one that saves them the most on the card they book; they never stack. A lower first payment keeps the price and lowers what they pay to reserve; it goes together with the best price offer, and the lowest one wins. A gift that fits the card goes with both.
      </p>
      <p>Booked couples and sent quotes keep the offer they got.</p>
      {cards.length ? (
        <ul className="divide-y divide-ink/10 border-t border-ink/10 pt-1" data-offers-percard="">
          {cards.map((c) => {
            const b = offers ? bestOn(c, offers, today) : null;
            return (
              <li key={c.id} className="py-1.5">
                <b className="block text-[13px] text-ink">{c.name}</b>
                <small className="block text-xs text-ink/70">
                  {c.pricePhp == null ? 'No price on this card yet' : b ? `₱${c.pricePhp.toLocaleString('en-PH')} → ₱${(c.pricePhp - b.savingsPhp).toLocaleString('en-PH')} · ${b.label}` : `₱${c.pricePhp.toLocaleString('en-PH')} · no price offer`}
                </small>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );

  const newMenu = (
    <PickMenu
      label="New offer · what do they get?"
      value={null}
      buttonText="New offer"
      dataAttr="data-offer-new"
      className="sn-press grid h-12 w-12 flex-none place-items-center rounded-full bg-sn-accent text-sn-on-accent"
      trigger={<Plus aria-hidden className="h-5 w-5" strokeWidth={2} />}
      options={(['pct', 'php', 'down', 'gift'] as OfferPart[]).map((k) => ({ key: k, label: PART_LABEL[k].label, hint: PART_LABEL[k].sub }))}
      onPick={(k) => setEditing({ offer: null, start: { part: k as OfferPart }, origin: addRef.current })}
    />
  );

  const thumb = (
    <div className="flex items-center gap-2" data-offers-thumb="">
      <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-ink/10 bg-raised px-4 text-sm text-ink/70">
        <Search aria-hidden className="h-4 w-4 flex-none text-ink/70" strokeWidth={1.75} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search offers"
          aria-label="Search offers"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink/70"
        />
      </label>
      <PickMenu
        label="Show"
        value={filter}
        buttonText={FILTERS.find((f) => f.key === filter)!.label}
        dataAttr="data-offers-filter"
        className="sn-press grid h-12 w-12 flex-none place-items-center rounded-full border border-ink/10 bg-raised text-ink/75"
        trigger={<Filter aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        options={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        onPick={(k) => setFilter(k as Filter)}
      />
      <span ref={addRef} className="inline-flex">
        {newMenu}
      </span>
    </div>
  );

  return (
    <RiseScreen
      title="Offers"
      info={info}
      thumb={thumb}
      onClose={onClose}
      data="offer-maker"
    >
      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded-xl px-3 py-2 text-[13px]" style={{ background: 'rgb(var(--color-warn) / .12)', color: 'rgb(var(--color-warn))' }}>
          {error}
        </p>
      ) : null}
      {/* The one short line (prototype `.lead`): what runs, and what most cards show. */}
      <p className="px-4 pt-3.5 text-sm leading-snug text-ink/70" data-offers-summary="">
        {offers ? summaryLine(live, cards, today) : 'Couldn’t load your offers'}
      </p>
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">Offers</h2>
        <small className="text-xs text-ink/70" data-offers-count="">
          {offers ? `${live.length ? `${formatCount(running)} of ${formatCount(live.length)} running · ` : ''}the best one wins` : ''}
        </small>
      </div>
      {offers === null ? (
        <p role="alert" className="flex items-start gap-2 px-4 text-[13px] text-ink/70" data-offers-read="refused">
          Couldn’t load your offers — check your connection, then open Offers again.
        </p>
      ) : shown.length === 0 ? (
        <p className="flex items-start gap-2 px-4 text-[13px] leading-snug text-ink/70" data-offers-empty="">
          {live.length ? 'No offer matches that search.' : 'No offers yet · couples pay the card price · start one with ＋'}
        </p>
      ) : (
        <ul className="space-y-2 px-4" data-offers-list="">
          {shown.map((o) => {
            const st = offerStatus(o, today);
            const off = st.k !== 'run';
            return (
              <SwipeToDelete key={o.id} as="li" label={`Remove ${o.name}`} word="Remove" radiusClass="rounded-2xl" surfaceClass="bg-raised" onDelete={() => remove(o)}>
                <div
                  className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-raised px-3.5 py-3" // no-card-ok: an offer row is pressed to open its editor and holds its switch (prototype `.orow`)
                  data-offer-row={o.id}
                  data-off={off ? '' : undefined}
                >
                  <button
                    type="button"
                    className="sn-press flex min-w-0 flex-1 items-start gap-3 text-left"
                    aria-label={`Open ${o.name}`}
                    onClick={(e) => setEditing({ offer: o, start: null, origin: e.currentTarget.closest('[data-offer-row]') as HTMLElement })}
                  >
                    <OfferTile offer={o} off={off} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1 pt-px">
                      <b className={`text-[14.5px] font-semibold leading-tight ${off ? 'text-ink/70' : 'text-ink'}`}>{o.name}</b>
                      <span className={`text-[12.5px] leading-snug ${off ? 'text-ink/70' : 'text-ink'}`}>{mixLine(o, data)}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] leading-snug text-ink/70">
                        <StatusChip offer={o} today={today} />
                        <span>{whoShort(o)}</span>
                      </span>
                    </span>
                  </button>
                  <button type="button" role="switch" aria-checked={o.isOn} aria-label={`${o.name} on`} onClick={() => void toggle(o)} className={`${SWITCH_BUTTON} mt-1`} data-offer-switch={o.id}>
                    <SwitchTrack on={o.isOn} />
                  </button>
                </div>
              </SwipeToDelete>
            );
          })}
        </ul>
      )}
      {offers !== null && cards.length === 0 && data.cards !== null ? (
        <div className="px-4 pt-4" data-offers-no-cards="">
          <ActionButton tone="neutral" icon={Plus} label="Make a service card first" href="/vendor-dashboard/shop#services" className="!h-11" />
        </div>
      ) : null}
      <div className="h-6" />
      {editing ? (
        <OfferEditor
          data={data}
          offers={offers ?? []}
          initial={editing.offer}
          start={editing.start}
          origin={editing.origin}
          onSaved={(saved, wasNew) => {
            setOffers((list) => (wasNew ? [...(list ?? []), saved] : (list ?? []).map((x) => (x.id === saved.id ? saved : x))));
            setEditing(null);
          }}
          onRemove={(o) => {
            setEditing(null);
            remove(o);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </RiseScreen>
  );
}
