'use client';

/**
 * 🏷 THE OFFER EDITOR — an offer rises from its row (the prototype's `offerScreen` · `offerBody`, artifact
 * 1fdSN1HRkYWm1nfbpYRteh). ✕ shrinks it back into the row: the SAME frames as every rise (`riseScreenMotion`), reversed.
 *
 *   PINNED  "As couples see it", COMPACT (owner 9 Nov: *"we want less but more … when keyboard pops up, it uses almost
 *           50% of the screen"*): ≤ 3 text rows — name + offer pill · struck → final · the short verdict ⌄ — with a 40 px
 *           thumb. ⌄ opens the full card (the shipped `ServiceCardFace`), the card picker and the full verdict. While a
 *           field has focus it is forced closed to ONE slim line that still follows the numbers, and comes back as it was.
 *   BODY    the five plain questions (owner 9 Nov), as compact rows:
 *             1 Name · 2 Which cards? (a dropdown, then ticks) · 3 What do they get? (four parts, a switch each — % first,
 *             then ₱ off what is left; a lower first payment as ₱ or %; a gift) · 4 Who gets it? (a dropdown; its field
 *             under it — "Event date in a season" is the off-season offer and opens on the shop's slow months) ·
 *             5 How long does it run? (until I switch it off · until a date — the shared date sheet).
 *   THUMB   Remove | Done, equal widths. Enter in a text box is Done.
 *
 * "Who wins" is never decided here: the verdict asks `pickBestDiscount` — the ONE function couples get — over the card's
 * own rows and every offer, with this draft in its place.
 *
 * ⏳ STILL OPEN (owner, not built): "spreading expected bookings" across the cards of a Pick-per-card gift — the stock
 * line says what is in stock and what each costs, and forecasts nothing. TODO(owner): spreading expected bookings.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, Gift, ImageIcon, Info, Percent, Sparkles, Tag, Trash2, Wallet, X } from 'lucide-react';
import { ActionButton, EqualRow } from '@/components/action-button';
import { BADGE_CLASS } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { formatCount } from '@/lib/format-number';
import { LazyDateSheet } from '@/app/_components/date-sheet-lazy';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { ServiceCardFace } from '@/app/vendor-dashboard/services/_components/service-card-face';
import { prefersReducedMotion } from '@/app/_components/picked/picked-motion';
import { usePortalHost } from '@/lib/use-portal-host';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { riseScreenMotion, type RiseRect } from '@/lib/rise-screen';
import { validUntilChoices } from '@/lib/date-sheet';
import {
  bestFirstPayment,
  blankOffer,
  checkGifts,
  giftName,
  giftsFor,
  giftsOn,
  hasFirstPayment,
  hasGift,
  hasPrice,
  nameFor,
  offAmount,
  offerProblem,
  offerStatus,
  OFFER_WHO,
  packsInStock,
  PART_LABEL,
  reaches,
  recommendGifts,
  shortDate,
  stackCost,
  stockLine,
  WHO_LABEL,
  WHO_SUB,
  workedLine,
  type GiftContext,
  type Offer,
  type OfferCard,
  type OfferGift,
  type OfferPart,
  type OfferWho,
} from '@/lib/offers';
import type { OfferMakerData } from '@/lib/offer-maker.server';
import { offerMaker } from '../actions';
import { bestOn } from './offer-maker';

export type EditorStart = { part?: OfferPart; who?: OfferWho; seasonFrom?: string; seasonTo?: string; card?: string };

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const rectOf = (el: HTMLElement | null): RiseRect | null => {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
};
const numOrNull = (s: string) => {
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/** The short verdict for the compact row, and the full sentence for the opened card (prototype `faceNote` · `offerShort`). */
function verdict(d: Offer, c: OfferCard, others: readonly Offer[], today: string, ctx: GiftContext | null): { ok: boolean; short: string; full: string; pay: number | null } {
  const all = [...others.filter((o) => o.id !== d.id), d];
  const best = bestOn(c, all, today);
  const pay = c.pricePhp == null ? null : c.pricePhp - (best?.savingsPhp ?? 0);
  const st = offerStatus(d, today);
  if (!reaches(d, c.id)) return { ok: false, short: 'Doesn’t reach this card', full: 'Doesn’t reach this card · pick it under 2', pay };
  if (st.k !== 'run') return { ok: false, short: `${st.label} · couples don’t see it`, full: `${st.label} · couples don’t see it${st.k === 'off' ? ' · switch it on in the list' : st.k === 'ended' ? ' · set a later date under 5' : ''}`, pay };
  if (!hasPrice(d) && !hasFirstPayment(d) && !hasGift(d)) return { ok: false, short: 'Nothing picked yet', full: 'Nothing picked yet · choose what they get under 3', pay };
  const t: string[] = [];
  let ok = true;
  if (hasPrice(d) && c.pricePhp != null) {
    if (best?.offerId === d.id) t.push(`Wins here · ${workedLine(d, c.pricePhp)}`);
    else {
      ok = false;
      const winner = best?.offerId ? (all.find((o) => o.id === best.offerId)?.name ?? best.label) : (best?.label ?? 'Another offer');
      const mine = offAmount(d, c.pricePhp);
      t.push(
        best && best.savingsPhp === mine
          ? `${winner} wins here · same as this one (${peso(mine)} each) · couples pay ${peso(c.pricePhp - mine)} either way`
          : `${winner} saves more here (${peso(best?.savingsPhp ?? 0)} vs ${peso(mine)}) · couples see that one`,
      );
    }
  } else if (hasPrice(d)) t.push('This card has no price yet');
  if (hasFirstPayment(d) && pay != null) {
    const fp = bestFirstPayment(all, c.id, pay, today);
    if (fp?.offer.id === d.id) t.push(`reserve for ${peso(fp.amount)}`);
    else if (fp) t.push(`${fp.offer.name} asks less to reserve (${peso(fp.amount)})`);
  }
  if (hasGift(d) && ctx && pay != null) {
    const chk = checkGifts(giftsOn(d, c.id), pay, ctx);
    const good = chk.items.filter((x) => x.ok);
    if (!chk.items.length) t.push('no gift on this card');
    if (good.length) t.push(`${good.map((x) => giftName(x.gift, ctx)).join(' + ')} go${good.length === 1 ? 'es' : ''} along`);
    for (const x of chk.items.filter((y) => !y.ok)) t.push(`${giftName(x.gift, ctx)}: ${x.why}`);
  }
  const gifts = hasGift(d) && ctx && pay != null ? giftsFor(all, c.id, pay, today, ctx).length : 0;
  const short = hasPrice(d)
    ? `${ok ? '✓ Wins here' : `${t[0]?.split(/ (?:saves|wins) /)[0] ?? 'Another offer'} wins here`} · ${pay != null ? peso(pay) : '₱ —'}${gifts ? ` · ${gifts} ${gifts === 1 ? 'gift' : 'gifts'}` : ''}`
    : `✓ ${[hasFirstPayment(d) && pay != null ? `reserve ${peso(bestFirstPayment(all, c.id, pay, today)?.amount ?? 0)}` : '', gifts ? `${gifts} ${gifts === 1 ? 'gift goes' : 'gifts go'} along` : ''].filter(Boolean).join(' · ')}`;
  return { ok, short, full: t.join(' · '), pay };
}

export function OfferEditor({
  data,
  offers,
  initial,
  start,
  origin,
  onSaved,
  onRemove,
  onClose,
}: {
  data: OfferMakerData;
  offers: readonly Offer[];
  initial: Offer | null;
  start: EditorStart | null;
  origin: HTMLElement | null;
  onSaved: (o: Offer, wasNew: boolean) => void;
  onRemove: (o: Offer) => void;
  onClose: () => void;
}) {
  const host = usePortalHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const today = data.today;
  const cards = useMemo(() => data.cards ?? [], [data.cards]);
  const ctx = data.gifts;
  const isNew = initial === null;
  const [d, setD] = useState<Offer>(() => {
    const base = initial ?? blankOffer();
    if (!initial && start?.card && (data.cards ?? []).some((c) => c.id === start.card)) return { ...base, reachesAll: false, cards: [start.card] };
    if (!initial && start?.who === 'season') return { ...base, who: 'season', seasonFrom: start.seasonFrom ?? data.season?.from ?? null, seasonTo: start.seasonTo ?? data.season?.to ?? null };
    return base;
  });
  // Which parts are switched on — a part can be ON while its amount is still empty (nothing is guessed).
  const [parts, setParts] = useState<Set<OfferPart>>(() => {
    const s = new Set<OfferPart>();
    if (initial) {
      if ((initial.pctOff ?? 0) > 0) s.add('pct');
      if ((initial.phpOff ?? 0) > 0) s.add('php');
      if ((initial.firstPayment ?? 0) > 0) s.add('down');
      if (initial.gifts.length) s.add('gift');
    } else s.add(start?.part ?? 'pct');
    return s;
  });
  const [named, setNamed] = useState(!isNew);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [pvOpen, setPvOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dateFor, setDateFor] = useState<null | 'from' | 'to' | 'until'>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  // The written-for-you name follows the answers until the supplier types their own.
  const view: Offer = named ? d : { ...d, name: nameFor(d) };
  const set = (p: Partial<Offer>) => setD((x) => ({ ...x, ...p }));

  const reached = cards.filter((c) => reaches(view, c.id));
  const prev = cards.find((c) => c.id === prevId && reaches(view, c.id)) ?? reached[0] ?? cards[0] ?? null;
  const v = prev ? verdict(view, prev, offers, today, ctx) : null;

  // 🎬 Rise out of the row; the close plays the same frames backwards into it.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !host) return;
    const m = riseScreenMotion(rectOf(origin), { width: window.innerWidth, height: window.innerHeight }, prefersReducedMotion());
    if (m && typeof el.animate === 'function') el.animate(m.frames, m.timing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const el = rootRef.current;
    const m = riseScreenMotion(rectOf(origin), { width: window.innerWidth, height: window.innerHeight }, prefersReducedMotion());
    if (!el || !m || typeof el.animate !== 'function') return onClose();
    el.animate(m.frames, { ...m.timing, direction: 'reverse', fill: 'forwards' }).finished.then(onClose, onClose);
  };
  useModalA11y({ open: Boolean(host), onClose: close, containerRef: rootRef });

  // ⌨ The keyboard: a focused text box forces the preview to its slim line; blur gives back the state it was in.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const isField = (t: EventTarget | null) => t instanceof HTMLInputElement && t.type !== 'checkbox';
    const on = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const off = (e: FocusEvent) => isField(e.target) && !isField(e.relatedTarget) && setTyping(false);
    el.addEventListener('focusin', on);
    el.addEventListener('focusout', off);
    return () => {
      el.removeEventListener('focusin', on);
      el.removeEventListener('focusout', off);
    };
  }, [host]);

  const togglePart = (k: OfferPart) => {
    const on = !parts.has(k);
    const next = new Set(parts);
    if (on) next.add(k);
    else next.delete(k);
    setParts(next);
    if (!on) set(k === 'pct' ? { pctOff: null } : k === 'php' ? { phpOff: null } : k === 'down' ? { firstPayment: null } : { gifts: [] });
  };

  const done = async () => {
    const o: Offer = { ...view, name: view.name.trim() };
    const p = offerProblem(o);
    if (p) return setProblem(p);
    setBusy(true);
    setProblem(null);
    const r = await offerMaker({ op: 'save', offer: o });
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    if (!('offer' in r)) return setProblem('Couldn’t save your offer — try again.');
    onSaved(r.offer, isNew);
  };
  const enterIsDone = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void done();
    }
  };

  // ── 2 · Which cards? ──
  const cardsPick = (
    <>
      <PickMenu
        label="Which cards?"
        value={view.reachesAll ? 'all' : 'pick'}
        buttonText={view.reachesAll ? `All cards · ${cards.length}` : `The cards I pick · ${view.cards.length}`}
        dataAttr="data-offer-cards"
        className={BOX}
        options={[
          { key: 'all', label: 'All cards', hint: 'Every card in your shop, now and later' },
          { key: 'pick', label: 'The cards I pick', hint: 'One or several' },
        ]}
        onPick={(k) => set(k === 'all' ? { reachesAll: true, cards: [] } : { reachesAll: false, cards: view.cards.length ? view.cards : prev ? [prev.id] : [] })}
      />
      {!view.reachesAll ? (
        <div className="mt-1.5 grid gap-0.5" data-offer-card-ticks="">
          {cards.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="h-5 w-5 flex-none accent-[rgb(var(--sn-accent))]"
                checked={view.cards.includes(c.id)}
                onChange={(e) => set({ cards: e.target.checked ? [...view.cards, c.id] : view.cards.filter((x) => x !== c.id) })}
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <small className="flex-none text-xs font-semibold tabular-nums text-ink/70">{c.pricePhp != null ? peso(c.pricePhp) : '₱ —'}</small>
            </label>
          ))}
        </div>
      ) : null}
    </>
  );

  // ── 3 · What do they get? ──
  const pctField = (
    <AmountBox lead="%" trail="off the card price" label="Percent off" value={d.pctOff} onChange={(n) => set({ pctOff: n })} onKeyDown={enterIsDone} data="pct" />
  );
  const phpField = (
    <AmountBox lead="₱" trail="off what’s left" label="Pesos off" value={d.phpOff} onChange={(n) => set({ phpOff: n })} onKeyDown={enterIsDone} data="php" money />
  );
  const downField = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Seg
          label="First payment as"
          options={[
            { key: 'php', label: '₱ amount' },
            { key: 'pct', label: '% of price' },
          ]}
          value={d.firstPaymentUnit}
          onPick={(k) => set({ firstPaymentUnit: k as 'php' | 'pct' })}
        />
        <AmountBox lead={d.firstPaymentUnit === 'pct' ? '%' : '₱'} label="First payment" value={d.firstPayment} onChange={(n) => set({ firstPayment: n })} onKeyDown={enterIsDone} data="down" money={d.firstPaymentUnit === 'php'} />
      </div>
      <p className="mt-1.5 text-xs leading-snug text-ink/70">
        The price stays. The first payment becomes {d.firstPayment ? (d.firstPaymentUnit === 'pct' ? `${d.firstPayment}% of the price` : peso(d.firstPayment)) : 'what you set'}; the later payments carry the rest. The lowest first payment on a card wins.
      </p>
    </>
  );
  const giftField = ctx ? (
    <GiftBlock offer={view} cards={reached} others={offers} today={today} ctx={ctx} onChange={(p) => set(p)} />
  ) : (
    <p role="alert" className="text-[13px] text-ink/70" data-offer-gifts-read="refused">
      Couldn’t load your gifts and their limit — close and open Offers again to add a gift.
    </p>
  );

  // ── 4 · Who gets it? ──
  const whoField = (
    <>
      <PickMenu
        label="Who gets it?"
        value={d.who}
        buttonText={WHO_LABEL[d.who]}
        dataAttr="data-offer-who"
        className={BOX}
        options={OFFER_WHO.map((k) => ({ key: k, label: WHO_LABEL[k], hint: WHO_SUB[k] }))}
        onPick={(k) => {
          const who = k as OfferWho;
          set({
            who,
            minLeadMonths: who === 'early_bird' ? (d.minLeadMonths ?? null) : null,
            firstNCap: who === 'first_n' ? (d.firstNCap ?? null) : null,
            // 🌙 The off-season offer opens on the shop's slow months (lib/vendor-lean-months.ts), never on blank days.
            seasonFrom: who === 'season' ? (d.seasonFrom ?? data.season?.from ?? null) : null,
            seasonTo: who === 'season' ? (d.seasonTo ?? data.season?.to ?? null) : null,
          });
        }}
      />
      {d.who === 'early_bird' ? (
        <>
          <AmountBox lead="Books" trail="months ahead or more" label="Months before the event" value={d.minLeadMonths} onChange={(n) => set({ minLeadMonths: n == null ? null : Math.round(n) })} onKeyDown={enterIsDone} data="months" className="mt-1.5" />
          <Hint>
            12 = a year ahead.{' '}
            <InfoTip label="" ariaLabel="About a ladder of early birds" align="start">
              For a ladder add another Early bird (12 months and 6 months); the couple gets the best one.
            </InfoTip>
          </Hint>
        </>
      ) : null}
      {d.who === 'first_n' ? (
        <>
          <AmountBox lead="First" trail="couples" label="How many couples" value={d.firstNCap} onChange={(n) => set({ firstNCap: n == null ? null : Math.round(n) })} onKeyDown={enterIsDone} data="cap" className="mt-1.5" />
          <Hint>{d.firstNCap ? `${formatCount(Math.max(0, d.firstNCap - d.firstNTaken))} of ${formatCount(d.firstNCap)} left · switches itself off at 0` : 'Switches itself off once they are all taken.'}</Hint>
        </>
      ) : null}
      {d.who === 'season' ? (
        <>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <DateBox lead="From" value={d.seasonFrom} onOpen={() => setDateFor('from')} data="season-from" />
            <DateBox lead="To" value={d.seasonTo} onOpen={() => setDateFor('to')} data="season-to" />
          </div>
          <Hint>
            For events whose date falls inside these dates.
            {data.season ? ` Started from your slow months — ${data.season.monthsLabel}.` : ''} When couples can book is question 5.
          </Hint>
        </>
      ) : null}
      {d.who === 'returning' ? <Hint>On their next event with you. Nothing to set.</Hint> : null}
    </>
  );

  // ── 5 · How long does it run? ──
  const untilField = (
    <>
      <Seg
        label="How long does it run?"
        options={[
          { key: 'off', label: 'Until I switch it off' },
          { key: 'date', label: 'Until a date' },
        ]}
        value={d.untilDate ? 'date' : 'off'}
        onPick={(k) => (k === 'off' ? set({ untilDate: null }) : setDateFor('until'))}
      />
      {d.untilDate ? (
        <>
          <DateBox lead="Last day" value={d.untilDate} onOpen={() => setDateFor('until')} data="until" className="mt-1.5" />
          <Hint>
            {d.untilDate < today ? `It ended ${shortDate(d.untilDate)} · pick a later day to run it again.` : 'The last day a couple can book with it.'}
            {d.untilDate < today ? null : (
              <>
                {' '}
                <InfoTip label="" ariaLabel="After the last day" align="start">
                  It switches itself off after.
                </InfoTip>
              </>
            )}
          </Hint>
        </>
      ) : (
        <Hint>Keeps running until you switch it off.</Hint>
      )}
    </>
  );

  const thumb = prev ? <span aria-hidden className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-lg" style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}>{prev.coverUrl ? <img src={prev.coverUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4" />}</span> : null;
  const pill = prev && v && prev.pricePhp != null ? bestOn(prev, [...offers.filter((o) => o.id !== view.id), view], today) : null;
  const slim = typing;
  const open = pvOpen && !slim;

  const screen = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-editor-title"
      className="fixed inset-0 z-sn-modal flex h-[100dvh] flex-col bg-cream text-ink outline-none"
      data-offer-editor={isNew ? 'new' : view.id}
    >
      <div className="shrink-0 border-b border-ink/10 bg-cream pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-[60px] w-full max-w-3xl items-center gap-2.5 px-4 py-2">
          <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={close} />
          <b id="offer-editor-title" className="min-w-0 flex-1 truncate text-[17px] font-bold leading-tight text-ink" data-offer-name-head="">
            {view.name || 'New offer'}
          </b>
          <ActionButton tone="neutral" iconOnly icon={Info} label="About this offer" onClick={() => setAboutOpen((x) => !x)} aria-expanded={aboutOpen} />
        </div>
        {aboutOpen ? (
          <div role="note" className="border-t border-ink/10 bg-raised">
            <p className="mx-auto w-full max-w-3xl px-4 py-2.5 text-[13.5px] leading-relaxed text-ink/75">
              Five answers make an offer. Couples read the name; the card above shows exactly what they get on the card you pick. Switch the offer on or off from the list. Booked couples and sent quotes keep what they got.
            </p>
          </div>
        ) : null}
        {/* 📌 "As couples see it" — compact by default, opens on a tap, one slim line while typing. */}
        {prev && v ? (
          <div className="mx-auto w-full max-w-3xl px-4 pb-1 pt-1" data-offer-preview={open ? 'open' : slim ? 'slim' : 'closed'}>
            <button type="button" className={`sn-press flex w-full items-center gap-2.5 text-left ${slim ? 'min-h-11' : 'min-h-[52px]'}`} aria-expanded={open} aria-label="As couples see it · open or fold" onClick={() => setPvOpen((x) => !x)}>
              {slim ? null : thumb}
              <span className={`min-w-0 flex-1 ${slim ? 'flex items-center gap-2' : ''}`}>
                <b className={`flex items-center gap-1.5 overflow-hidden whitespace-nowrap font-semibold leading-tight ${slim ? 'order-1 min-w-0 flex-1 text-[13.5px]' : 'text-sm'}`}>
                  <span className="min-w-0 truncate">{prev.name}</span>
                  {pill ? (
                    <span className={BADGE_CLASS} style={{ background: 'var(--m-sage)', color: 'var(--m-ink)' }}>
                      {pill.label}
                    </span>
                  ) : null}
                </b>
                <small className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-medium leading-snug ${slim ? 'order-2 flex-none' : ''}`} style={{ color: 'var(--m-orange-2)' }}>
                  {prev.pricePhp == null ? (
                    '₱ —'
                  ) : pill ? (
                    <>
                      {slim ? null : <s className="font-normal text-ink/70">{peso(prev.pricePhp)}</s>}
                      {slim ? null : <span className="text-ink/70">→</span>}
                      {peso(prev.pricePhp - pill.savingsPhp)}
                    </>
                  ) : (
                    peso(prev.pricePhp)
                  )}
                </small>
                {slim ? null : (
                  <small className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs leading-snug" style={{ color: v.ok ? 'rgb(var(--color-ok))' : 'var(--m-slate-2)' }} data-offer-verdict-short="">
                    <span className="min-w-0 truncate">{v.short}</span>
                  </small>
                )}
              </span>
              {slim ? null : <ChevronDown aria-hidden className={`h-4 w-4 flex-none text-ink/70 transition-transform ${open ? 'rotate-180' : ''}`} />}
            </button>
            {open ? (
              <div className="pb-2" data-offer-preview-full="">
                <div className="mb-1.5 mt-0.5 flex items-center justify-between gap-2">
                  <span className="sn-eye">As couples see it</span>
                  {reached.length > 1 ? (
                    <PickMenu label="Preview on" value={prev.id} compact dataAttr="data-offer-preview-card" options={reached.map((c) => ({ key: c.id, label: c.name, hint: c.pricePhp != null ? peso(c.pricePhp) : 'No price yet' }))} onPick={setPrevId} />
                  ) : null}
                </div>
                <ServiceCardFace
                  snap={{
                    name: prev.name,
                    priceText: prev.pricePhp == null ? 'Price on request' : `from ${peso(prev.pricePhp - (pill?.savingsPhp ?? 0))}`,
                    discountBadge: pill?.label ?? null,
                    includesLine: null,
                    notIncluded: [],
                    hasExclusive: false,
                    givesSetnayanGift: false,
                    hasCover: Boolean(prev.coverUrl),
                  }}
                  leafPathLabel={prev.leaf ?? ''}
                  coverUrl={prev.coverUrl ?? null}
                  packLine={extrasLine(prev, [...offers.filter((o) => o.id !== view.id), view], today, ctx, v.pay)}
                />
                <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-snug" style={{ color: v.ok ? 'rgb(var(--color-ok))' : 'var(--m-slate-2)' }} data-offer-verdict="">
                  {v.ok ? <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none" /> : <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none" />}
                  <span>{v.full}</span>
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-offer-editor-body="">
        <div className="mx-auto w-full max-w-3xl pb-6">
          <Q n={1} label="Name" hint="as couples read it">
            <div className={BOX}>
              <input
                // field-ok: the offer's name box in the approved prototype (`.q .qb .box`): Enter is Done, the preview follows each letter
                value={view.name}
                onChange={(e) => {
                  setNamed(true);
                  set({ name: e.target.value });
                }}
                onKeyDown={enterIsDone}
                maxLength={80}
                aria-label="Name"
                enterKeyHint="done"
                className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none"
                data-offer-name=""
              />
            </div>
            {!named ? <Hint>Written for you · change it if you like</Hint> : null}
          </Q>
          <Q n={2} label="Which cards?">
            {cards.length ? cardsPick : <Hint>{data.cards === null ? 'Couldn’t load your cards.' : 'Make a service card first — an offer reaches your cards.'}</Hint>}
          </Q>
          <Q n={3} label="What do they get?" hint="one or more">
            <div className="overflow-hidden rounded-xl border border-ink/10 bg-raised" data-offer-parts=""> {/* no-card-ok: the four parts of 3 are ONE control group of switches (prototype `.parts`) */}
              <Part k="pct" on={parts.has('pct')} onToggle={togglePart}>
                {pctField}
              </Part>
              <Part k="php" on={parts.has('php')} onToggle={togglePart}>
                {phpField}
              </Part>
              {hasPrice(view) && prev?.pricePhp != null ? (
                <p className="flex flex-col gap-0.5 border-t border-ink/10 px-3 pb-2.5 pt-2" style={{ background: 'var(--sn-canvas)' }} data-offer-worked="">
                  <span className="sn-eye">{prev.name}</span>
                  <b className="truncate text-[13px] font-bold tabular-nums text-ink">{workedLine(view, prev.pricePhp)}</b>
                </p>
              ) : null}
              <Part k="down" on={parts.has('down')} onToggle={togglePart}>
                {downField}
              </Part>
              <Part k="gift" on={parts.has('gift')} onToggle={togglePart}>
                {giftField}
              </Part>
            </div>
            <Hint>
              % comes off the card price first, then the ₱ off what’s left.{' '}
              <InfoTip label="" ariaLabel="Across offers" align="start">
                Across offers a couple gets only the one that saves them most; never stacked.
              </InfoTip>
            </Hint>
          </Q>
          <Q n={4} label="Who gets it?">
            {whoField}
          </Q>
          <Q n={5} label="How long does it run?" hint="when couples can book with it">
            {untilField}
          </Q>
          {problem ? (
            <p role="alert" className="mx-4 mt-4 rounded-xl px-3 py-2 text-[13px]" style={{ background: 'rgb(var(--color-warn) / .12)', color: 'rgb(var(--color-warn))' }} data-offer-problem="">
              {problem}
            </p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 bg-cream px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
        <EqualRow className="mx-auto w-full max-w-3xl" data="offer-editor-thumb">
          <ActionButton tone="danger" icon={Trash2} label={isNew ? 'Discard' : 'Remove'} onClick={() => (initial ? onRemove(initial) : close())} />
          <ActionButton tone="ok" main icon={Check} label="Done" onClick={() => void done()} waiting={busy} disabled={busy} />
        </EqualRow>
      </div>

      {dateFor ? (
        <LazyDateSheet
          title={dateFor === 'until' ? 'Last day to book' : dateFor === 'from' ? 'Season starts' : 'Season ends'}
          about={dateFor === 'until' ? 'The last day a couple can book with this offer. It switches itself off after.' : 'The EVENT’s date — weddings in these months get the offer.'}
          value={dateFor === 'until' ? d.untilDate : dateFor === 'from' ? d.seasonFrom : d.seasonTo}
          today={today}
          min={dateFor === 'to' ? (d.seasonFrom ?? today) : today}
          choices={dateFor === 'until' ? validUntilChoices(today) : null}
          onSet={({ day }) => {
            if (dateFor === 'until') set({ untilDate: day });
            else if (dateFor === 'from') set({ seasonFrom: day, seasonTo: d.seasonTo && d.seasonTo < day ? day : d.seasonTo });
            else set({ seasonTo: day });
            setDateFor(null);
          }}
          onCancel={() => setDateFor(null)}
          data={`offer-${dateFor}`}
        />
      ) : null}
    </div>
  );
  return host ? createPortal(screen, host) : screen;
}

/** What a couple reads under the price on this card: the lower first payment, then the gift(s). */
function extrasLine(c: OfferCard, offers: readonly Offer[], today: string, ctx: GiftContext | null, pay: number | null): string | null {
  if (pay == null) return null;
  const parts: string[] = [];
  const fp = bestFirstPayment(offers, c.id, pay, today);
  if (fp) parts.push(`${peso(fp.amount)} to reserve`);
  if (ctx) for (const g of giftsFor(offers, c.id, pay, today, ctx)) parts.push(`+ ${giftName(g.gift, ctx)}`);
  return parts.length ? parts.join(' · ') : null;
}


const BOX = 'sn-press flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-ink/10 bg-raised px-3.5 text-left text-[14.5px] text-ink'; // no-card-ok: BOX dresses only pressables — the dropdown and date buttons (prototype `.q .qb .box`)

function Q({ n, label, hint, children }: { n: number; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 pt-3.5" data-offer-q={n}>
      <span aria-hidden className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink text-xs font-bold tabular-nums text-cream">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-[7px] mt-[3px] text-[13px] font-semibold leading-tight text-ink">
          {label}
          {hint ? <small className="font-normal text-ink/70"> · {hint}</small> : null}
        </p>
        {children}
      </div>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-snug text-ink/70">{children}</p>;
}

const PART_ICON = { pct: Percent, php: Tag, down: Wallet, gift: Gift } as const;
const PART_TONE: Record<OfferPart, { bg: string; fg: string }> = {
  pct: { bg: 'var(--m-sage)', fg: 'var(--m-ink)' },
  php: { bg: 'var(--m-sage)', fg: 'var(--m-ink)' },
  down: { bg: 'rgb(var(--color-info) / .14)', fg: 'rgb(var(--color-info))' },
  gift: { bg: 'var(--m-orange-4)', fg: 'var(--m-orange-deep)' },
};

function Part({ k, on, onToggle, children }: { k: OfferPart; on: boolean; onToggle: (k: OfferPart) => void; children: ReactNode }) {
  const Icon = PART_ICON[k];
  return (
    <div className="border-t border-ink/10 first:border-t-0" data-offer-part={k} data-on={on ? '' : undefined}>
      <div className="flex min-h-[52px] items-center gap-2.5 px-3 py-1.5">
        <span aria-hidden className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg" style={{ background: PART_TONE[k].bg, color: PART_TONE[k].fg }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm font-semibold leading-tight">{PART_LABEL[k].label}</b>
          <small className="block text-xs leading-tight text-ink/70">{PART_LABEL[k].sub}</small>
        </span>
        <button type="button" role="switch" aria-checked={on} aria-label={PART_LABEL[k].label} onClick={() => onToggle(k)} className={SWITCH_BUTTON} data-offer-part-switch={k}>
          <SwitchTrack on={on} />
        </button>
      </div>
      {on ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  );
}

function AmountBox({
  lead,
  trail,
  label,
  value,
  onChange,
  onKeyDown,
  data,
  money = false,
  className = '',
}: {
  lead: string;
  trail?: string;
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  data: string;
  money?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value == null ? '' : money ? value.toLocaleString('en-PH') : String(value));
  useEffect(() => {
    if (numOrNull(text) !== value) setText(value == null ? '' : money ? value.toLocaleString('en-PH') : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className={`flex h-11 items-center gap-1.5 rounded-xl border border-ink/10 bg-raised px-3.5 text-[14.5px] text-ink ${className}`}> {/* no-card-ok: the amount field itself — a lead, the box, a trail (prototype `.q .qb .box`) */}
      <span className="flex-none text-ink/70">{lead}</span>
      <input
        // field-ok: an amount box with a lead and a trail (prototype `.q .qb .box`), live-following the pinned preview
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(numOrNull(e.target.value));
        }}
        onKeyDown={onKeyDown}
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={label}
        className="h-full min-w-0 flex-1 bg-transparent outline-none"
        data-offer-amount={data}
      />
      {trail ? <span className="flex-none text-[13px] text-ink/70">{trail}</span> : null}
    </label>
  );
}

function DateBox({ lead, value, onOpen, data, className = '' }: { lead: string; value: string | null; onOpen: () => void; data: string; className?: string }) {
  return (
    <button type="button" onClick={onOpen} className={`${BOX} h-11 ${className}`} data-offer-date={data} aria-haspopup="dialog">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="flex-none text-ink/70">{lead}</span>
        <span className="truncate">{value ? shortDate(value) : 'Pick a day'}</span>
      </span>
      <CalendarDays aria-hidden className="h-4 w-4 flex-none text-ink/70" />
    </button>
  );
}

function Seg({ label, options, value, onPick }: { label: string; options: { key: string; label: string }[]; value: string; onPick: (k: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid h-12 auto-cols-fr grid-flow-col rounded-xl border border-ink/10 bg-raised p-1"> {/* no-card-ok: a segmented control (prototype `.segc`) */}
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          onClick={() => onPick(o.key)}
          className="truncate rounded-lg px-1.5 text-[13px] font-semibold text-ink/70 transition-colors aria-checked:bg-ink aria-checked:text-cream"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── 🎁 the gift block: Same on every card · Pick per card; your extras first, then Setnayan gifts, then a typed one ──

function GiftBlock({ offer, cards, others, today, ctx, onChange }: { offer: Offer; cards: readonly OfferCard[]; others: readonly Offer[]; today: string; ctx: GiftContext; onChange: (p: Partial<Offer>) => void }) {
  const per = offer.giftMode === 'per';
  const payOn = (c: OfferCard) => (c.pricePhp == null ? null : c.pricePhp - (bestOn(c, [...others.filter((o) => o.id !== offer.id), offer], today)?.savingsPhp ?? 0));
  const setList = (card: string | null, list: OfferGift[]) => {
    const rest = offer.gifts.filter((g) => (card ? g.card !== card : Boolean(g.card)));
    onChange({ gifts: [...rest, ...list.map((g) => (card ? { ...g, card } : { ...g, card: undefined }))] });
  };
  const rows = (card: OfferCard | null) => {
    const list = card ? giftsOn(offer, card.id) : giftsOn(offer, '');
    const pay = card ? payOn(card) : cards.length ? Math.min(...cards.map((c) => payOn(c) ?? Infinity)) : null;
    const chk = pay != null && Number.isFinite(pay) ? checkGifts(list, pay, ctx) : null;
    const rec = card && pay != null ? recommendGifts(pay, [card.id], ctx) : null;
    const add: PickOption[] = [
      ...ctx.addons
        .filter((a) => !card || a.cardId === card.id)
        .map((a) => ({ key: `addon:${a.id}`, label: `Free ${a.label.charAt(0).toLowerCase()}${a.label.slice(1)}`, hint: a.fromPhp != null ? `worth ${peso(a.fromPhp)}` : 'price on request', group: 'Your extras' })),
      ...ctx.packs.map((p) => ({ key: `sn:${p.code}`, label: p.title, hint: stockLine(p, ctx), group: 'Setnayan gifts' })),
      { key: 'typed', label: '＋ Type a gift', hint: 'A one-off, in your words', group: 'Your own' },
    ];
    return (
      <>
        <ul className="divide-y divide-ink/10" data-offer-gift-rows={card?.id ?? 'all'}>
          {list.length ? (
            list.map((g, i) => {
              const verdictOf = chk?.items[i];
              const bad = verdictOf ? !verdictOf.ok : false;
              const pack = g.kind === 'sn' ? ctx.packs.find((p) => p.code === g.code) : null;
              return (
                <SwipeToDelete key={`${g.kind}-${i}`} as="li" label={`Remove ${giftName(g, ctx)}`} word="Remove" radiusClass="rounded-none" onDelete={() => setList(card?.id ?? null, list.filter((_, j) => j !== i))}>
                <div className="flex items-start gap-2 py-2">
                  {g.kind === 'sn' ? <Gift aria-hidden className="mt-0.5 h-4 w-4 flex-none" style={{ color: bad ? 'rgb(var(--color-warn))' : 'var(--m-orange-deep)' }} /> : <Sparkles aria-hidden className="mt-0.5 h-4 w-4 flex-none" style={{ color: 'var(--m-orange-deep)' }} />}
                  <span className="min-w-0 flex-1">
                    {g.kind === 'typed' ? (
                      <span className="flex items-center gap-2">
                        <input
                          // field-ok: a typed gift's words inside its gift row (prototype `.lineitem.grow input.gl`)
                          value={g.label}
                          onChange={(e) => setList(card?.id ?? null, list.map((x, j) => (j === i ? { ...(x as typeof g), label: e.target.value } : x)))}
                          placeholder="Type the gift, e.g. Free tasting for two"
                          aria-label="Gift"
                          maxLength={80}
                          className="h-7 min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
                        />
                        <span className="flex flex-none items-center gap-1 text-xs text-ink/70">
                          worth ₱
                          <input
                            // field-ok: a typed gift's worth inside its gift row (prototype `.lineitem.grow .r input`)
                            value={g.worthPhp ?? ''}
                            onChange={(e) => setList(card?.id ?? null, list.map((x, j) => (j === i ? { ...(x as typeof g), worthPhp: numOrNull(e.target.value) } : x)))}
                            placeholder="optional"
                            inputMode="numeric"
                            aria-label="Worth in pesos"
                            className="h-7 w-[76px] bg-transparent text-ink outline-none"
                          />
                        </span>
                      </span>
                    ) : (
                      <b className="block text-sm font-semibold leading-tight text-ink">{giftName(g, ctx)}</b>
                    )}
                    <small className="block text-xs leading-snug" style={{ color: bad ? 'rgb(var(--color-warn))' : 'var(--m-slate-2)' }}>
                      {[pack ? stockLine(pack, ctx) : g.kind === 'addon' ? (ctx.addons.find((a) => a.id === g.addonId)?.fromPhp != null ? `worth ${peso(ctx.addons.find((a) => a.id === g.addonId)!.fromPhp!)}` : 'price on request') : '', verdictOf?.why ?? ''].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                </div>
                </SwipeToDelete>
              );
            })
          ) : (
            <li className="py-1 text-[12.5px] text-ink/70">{card ? `No gift on this card.` : 'No gift yet · add one below.'}</li>
          )}
        </ul>
        {rec ? (
          <PickMenu
            label="Recommended gifts"
            value={null}
            buttonText="Recommended gifts"
            dataAttr="data-offer-gift-rec"
            className={`${BOX} mt-1.5`}
            options={[
              { key: 'good', label: `Good · ${rec.good.map((x) => giftName(x, ctx)).join(' + ')}`, hint: stackCost(rec.good, ctx) },
              { key: 'better', label: `Better · ${rec.better.map((x) => giftName(x, ctx)).join(' + ')}`, hint: stackCost(rec.better, ctx) },
              { key: 'best', label: `Best · ${rec.best.map((x) => giftName(x, ctx)).join(' + ')}`, hint: stackCost(rec.best, ctx) },
            ]}
            onPick={(k) => card && setList(card.id, rec[k as 'good' | 'better' | 'best'])}
          />
        ) : null}
        <PickMenu
          label="Add a gift"
          value={null}
          buttonText={list.length ? 'Add another gift' : 'Add a gift'}
          dataAttr="data-offer-gift-add"
          className={`${BOX} mt-1.5`}
          stickyGroups
          options={add}
          onPick={(k) => {
            const g: OfferGift = k === 'typed' ? { kind: 'typed', label: '', worthPhp: null } : k.startsWith('addon:') ? { kind: 'addon', addonId: Number(k.slice(6)) } : { kind: 'sn', code: k.slice(3) };
            setList(card?.id ?? null, [...list, g]);
          }}
        />
      </>
    );
  };
  return (
    <div data-offer-gifts={per ? 'per' : 'same'}>
      <p className="mb-1.5 text-[12.5px] text-ink/70">Which gift on which card</p>
      <PickMenu
        label="Which gift on which card"
        value={offer.giftMode}
        buttonText={per ? 'Pick per card' : 'Same on every card'}
        dataAttr="data-offer-gift-mode"
        className={BOX}
        options={[
          { key: 'same', label: 'Same on every card', hint: 'One gift list for every card it reaches' },
          { key: 'per', label: 'Pick per card', hint: 'Each card its own — good, better, best by price' },
        ]}
        onPick={(k) => onChange({ giftMode: k as 'same' | 'per', gifts: [] })}
      />
      <div className="mt-2">
        {per
          ? cards.map((c) => {
              const pay = payOn(c);
              return (
                <div key={c.id} className="mt-2 border-t border-ink/10 pt-2 first:mt-0 first:border-t-0 first:pt-0" data-offer-gift-card={c.id}>
                  <b className="block text-[13.5px] font-semibold">{c.name}</b>
                  <small className="mb-1 block text-xs text-ink/70">
                    {c.pricePhp != null ? peso(c.pricePhp) : 'No price yet'}
                    {pay != null && c.pricePhp != null && pay !== c.pricePhp ? ` → pays ${peso(pay)}` : ''}
                    {pay != null ? ` · limit ${peso(checkGifts([], pay, ctx).limitCentavos / 100)}` : ''}
                  </small>
                  {rows(c)}
                </div>
              );
            })
          : rows(null)}
      </div>
      <p className="mt-1.5 text-xs leading-snug text-ink/70">
        Your extras have no limit. Setnayan gifts are added up against the gift limit at the price couples pay
        {ctx.limitPct ? ` (${ctx.limitPct}% of the booking fee)` : ''}; a gift you&rsquo;ve stocked is already paid for, and with none in stock it goes on the booking fee at the same price. The same gift from two offers is given once.
        {ctx.packs.some((p) => packsInStock(p, ctx.free) === 0) ? ' Stock a bundle to get one free.' : ''}
      </p>
    </div>
  );
}

