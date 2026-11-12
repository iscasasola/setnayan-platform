'use client';

/**
 * price-basis-rows — "How the price works ▾ One price · Per guest · Per hour" on the couple's Add-a-supplier sheet and
 * its record card (owner-approved 2026-11-13, `prototypes/manual_service_price_basis_2026-11-13/index.html`).
 *
 * ONE new row above the shipped Price row, and the Price row's name follows the choice. The choices are the Card
 * Maker's own (`PRICING_BASIS_OPTIONS`, with the maker's "One price" label — canvas-maker.tsx), in the house PickMenu:
 * a tap OPENS the three choices (a sheet on a phone), it never cycles. One price posts the shipped `total_cost_php`
 * exactly as before; Per guest / Per hour post the rate (`pricing_rate_php`), and the total is rate × the number the
 * database gives (`get_self_added_price_terms`) — never typed, never guessed (lib/self-added-price-basis.ts).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FORM_PICK_CLASS, FormRow, FormRows, TypedRow, usePillWidth, type FormRowAbout } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PRICING_BASIS_OPTIONS } from '@/app/vendor-dashboard/services/_components/pricing-basis-editor';
import { createClient } from '@/lib/supabase/client';
import {
  PRICE_BASIS_FIELD,
  PRICE_RATE_FIELD,
  basisCalc,
  parsePriceTerms,
  priceRowName,
  type PriceTerms,
  type PriceTermsRead,
  type SelfAddedBasis,
} from '@/lib/self-added-price-basis';

/** The Card Maker's three, with the maker's label for a flat price (canvas-maker.tsx `basisOptions`). */
const BASIS_OPTIONS = PRICING_BASIS_OPTIONS.map((o) => ({
  key: o.key,
  label: o.key === 'fixed' ? 'One price' : o.label,
  hint: o.hint,
}));

/** Reads the two numbers a rate multiplies. A lab hands in a stand-in (no session there). */
export type PriceTermsReader = (eventId: string, eventVendorId: string | null) => Promise<PriceTerms | 'unread'>;

/** The couple's own session, straight to the numbers-only read (no server action — the action budget is full). */
export const readPriceTermsInBrowser: PriceTermsReader = async (eventId, eventVendorId) => {
  try {
    const { data, error } = await createClient().rpc('get_self_added_price_terms', {
      p_event_id: eventId,
      p_event_vendor_id: eventVendorId,
    });
    if (error) {
      // Said on screen (GUESTS_UNREAD_WORDS / SCHEDULE_UNREAD_WORDS); the reason goes to the console.
      console.warn('[price-basis] the guest count and schedule times could not be read:', error.message);
      return 'unread';
    }
    return parsePriceTerms(data) ?? 'unread';
  } catch {
    return 'unread';
  }
};

/**
 * The terms, read once the couple picks Per guest or Per hour (or the record opens on one). `'loading'` until the
 * answer is back; a refused read is `'unread'` and is SAID — never drawn as 0 guests or 0 hours.
 */
export function usePriceTerms(
  eventId: string,
  eventVendorId: string | null,
  wanted: boolean,
  reader: PriceTermsReader = readPriceTermsInBrowser,
): PriceTermsRead {
  const [read, setRead] = useState<PriceTermsRead>('loading');
  // Asked once per open. A ref, not state: flipping a state dep re-ran the effect, whose cleanup then dropped the
  // answer it was waiting for (measured in the lab — the sheet sat on "Counting your guest list…").
  const asked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!wanted || asked.current) return;
    asked.current = true;
    void reader(eventId, eventVendorId).then((r) => {
      if (mounted.current) setRead(r);
    });
  }, [wanted, reader, eventId, eventVendorId]);
  return read;
}

export function PriceBasisRows({
  eventId,
  basis,
  onBasis,
  priceKept,
  priceNote,
  priceAbout,
  onPriceType,
  onPriceKeep,
  rateKept,
  ratePhp,
  onRateType,
  onRateKeep,
  terms,
  after,
}: {
  eventId: string;
  basis: SelfAddedBasis;
  onBasis: (b: SelfAddedBasis) => void;
  /** One price — the shipped row, exactly as it was. */
  priceKept: string;
  priceNote?: ReactNode;
  priceAbout?: FormRowAbout;
  onPriceType: (t: string) => void;
  onPriceKeep: (t: string) => void;
  /** Per guest / Per hour — the rate. */
  rateKept: string;
  ratePhp: number | null;
  onRateType: (t: string) => void;
  onRateKeep: (t: string) => void;
  terms: PriceTermsRead;
  /** More rows of the same list (the record card's Inclusions). */
  after?: ReactNode;
}) {
  return (
    <FormRows width="wide" data="add-manual-terms">
      <BasisRow basis={basis} onBasis={onBasis} />
      {basis === 'fixed' ? (
        <TypedRow
          key="price"
          name="Price"
          fieldName="total_cost_php"
          value={priceKept}
          amount
          placeholder="80000"
          note={priceNote}
          about={priceAbout}
          attrs={{ 'data-manual-field': 'total_cost_php' }}
          onType={onPriceType}
          onKeep={(t) => {
            onPriceKeep(t);
            return { ok: true as const };
          }}
        />
      ) : (
        <TypedRow
          key={basis}
          name={priceRowName(basis)}
          fieldName={PRICE_RATE_FIELD}
          value={rateKept}
          amount
          placeholder={basis === 'per_pax' ? '1350' : '6000'}
          attrs={{ 'data-manual-field': PRICE_RATE_FIELD }}
          onType={onRateType}
          onKeep={(t) => {
            onRateKeep(t);
            return { ok: true as const };
          }}
          below={<BasisCalc eventId={eventId} basis={basis} ratePhp={ratePhp} terms={terms} />}
        />
      )}
      {after}
    </FormRows>
  );
}

function BasisRow({ basis, onBasis }: { basis: SelfAddedBasis; onBasis: (b: SelfAddedBasis) => void }) {
  const width = usePillWidth();
  const current = BASIS_OPTIONS.find((o) => o.key === basis) ?? BASIS_OPTIONS[0]!;
  return (
    <FormRow name="How the price works" note={current.hint} data="price-basis" attrs={{ 'data-price-basis': basis }}>
      <PickMenu
        label="How the price works"
        value={basis}
        options={BASIS_OPTIONS}
        onPick={(k) => onBasis(k as SelfAddedBasis)}
        dataAttr="data-price-basis-pick"
        className={`${FORM_PICK_CLASS} ${width}`}
      />
      <input type="hidden" name={PRICE_BASIS_FIELD} value={basis} />
    </FormRow>
  );
}

function BasisCalc({
  eventId,
  basis,
  ratePhp,
  terms,
}: {
  eventId: string;
  basis: Exclude<SelfAddedBasis, 'fixed'>;
  ratePhp: number | null;
  terms: PriceTermsRead;
}) {
  const c = basisCalc(basis, ratePhp, terms);
  const href = `/dashboard/${eventId}/${basis === 'per_pax' ? 'guests' : 'schedule'}`;
  return (
    <div data-price-basis-calc="" className="-mt-1 pb-1.5 pl-0.5 text-[12.5px] leading-snug text-ink/65">
      {c.calc ? (
        <p data-price-basis-sum="">
          × <b className="font-semibold text-ink">{c.calc.count}</b> {c.calc.tail}
          {c.calc.total ? (
            <>
              {' '}= <span className="font-semibold text-ink" data-price-basis-total="">{c.calc.total}</span>
            </>
          ) : null}
        </p>
      ) : (
        <p data-price-basis-wait="" role={terms === 'unread' ? 'status' : undefined}>
          {c.wait}
        </p>
      )}
      {c.from ? <p className="text-ink/55">{c.from}</p> : null}
      <a href={href} data-price-basis-go={basis === 'per_pax' ? 'guests' : 'schedule'} className="sn-press inline-flex min-h-11 items-center font-semibold text-sn-accent">
        {c.link}
      </a>
    </div>
  );
}
