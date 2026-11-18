'use client';

import { useActionState, useState } from 'react';
import { Check, AlertTriangle, ArrowRightLeft, Save } from 'lucide-react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import type { AiPriceTier } from '@/lib/setnayan-ai-type-pricing';
import {
  effectiveDiscountPct,
  signupPriceFor,
} from '@/lib/onboarding-family-discount';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { TEMPLATE_SUBLINE, TemplateNums, TemplateSection } from '@/app/_components/template-rows';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { FieldPick } from '@/app/admin/_components/field-pick';

export type EventKindView = {
  eventType: string;
  label: string;
  emoji: string;
  enabled: boolean;
  band: AiPriceTier | null;
};

export type AiBandView = {
  band: AiPriceTier;
  serviceCode: string | null;
  regularPhp: number | null;
  signupPhp: number | null;
  isSellable: boolean;
  kinds: EventKindView[];
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/**
 * The Setnayan AI band editor — ported from the binding prototype.
 *
 * ⚠ ONE KIND, ONE BAND, AND THE EXCLUSIVITY IS STRUCTURAL. Ticking a kind into
 * a band writes a single column on that kind's own row, so it leaves whichever
 * band it was in by construction. There is no "untick the others" pass that
 * could half-fail and leave an event quoted two prices.
 */
export function AiBandsEditor({
  bands,
  unassigned,
  totalKinds,
  discountPct,
  setBandAction,
  savePriceAction,
}: {
  bands: AiBandView[];
  unassigned: EventKindView[];
  totalKinds: number;
  discountPct: number;
  setBandAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  /** Sets ONE band's regular price. The sign-up price follows the one sign-up discount. */
  savePriceAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [bandState, bandFormAction] = useActionState<RowActionState, FormData>(setBandAction, {
    ok: false,
    message: null,
  });

  // Every kind, wherever it currently sits — so each band can offer the ones it
  // does not already hold.
  const allKinds: EventKindView[] = [...bands.flatMap((b) => b.kinds), ...unassigned];

  return (
    <div>
      {/* 📐 Clean port (19 Nov): the lede went behind the ⓘ; the four stat boxes are one numbers frame. */}
      <TemplateSection
        first
        label="Price bands"
        tip={
          <>
            Setnayan AI does not cost the same for a wedding as it does for a coffee catch-up. Five
            price bands; every kind of event sits in <strong>exactly one</strong> of them. Ticking
            a kind here takes it out of wherever it was, so the same event can never be quoted two
            prices.
          </>
        }
      >
        <TemplateNums
          items={[
            { label: 'Price bands', value: String(bands.length) },
            { label: 'Kinds of event', value: String(totalKinds) },
            {
              label: 'No price chosen',
              value: String(unassigned.length),
              tone: unassigned.length > 0 ? 'danger' : undefined,
            },
            { label: 'Sold as its own row', value: String(bands.filter((b) => b.isSellable).length) },
          ]}
        />
      </TemplateSection>

      {/*
        ⚠ THE TRAY IS PERMANENT, EVEN WHEN EMPTY. Its whole job is to turn a
        silent default into a visible question — so the NEXT kind of event
        somebody adds cannot start being sold at the middle price with nothing
        anywhere saying so. An empty tray reads as "nothing unanswered", which is
        information; a removed tray reads as nothing at all.
      */}
      <UnassignedTray kinds={unassigned} />

      {bandState.message && (
        <p
          className={`mb-4 text-[13px] font-semibold ${
            bandState.ok ? 'text-success-800' : 'text-danger-700'
          }`}
        >
          {bandState.message}
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        {bands.map((b) => (
          <BandCard
            key={b.band}
            band={b}
            allKinds={allKinds}
            discountPct={discountPct}
            formAction={bandFormAction}
              savePriceAction={savePriceAction}
          />
        ))}
      </div>
    </div>
  );
}

function UnassignedTray({ kinds }: { kinds: EventKindView[] }) {
  const empty = kinds.length === 0;
  return (
    <div className={`${ADMIN_FRAME} my-4 p-4`}>
      <h3
        className={`flex items-center gap-2 text-[15px] font-bold ${
          empty ? 'text-success-800' : 'text-danger-700'
        }`}
      >
        {empty ? (
          <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        <InfoTip
          label={
            empty
              ? 'Every kind of event has a price'
              : `${kinds.length} kind${kinds.length === 1 ? '' : 's'} of event ${
                  kinds.length === 1 ? 'has' : 'have'
                } no price of their own`
          }
          align="start"
        >
          {empty
            ? 'This stays here on purpose. The next kind of event you add will appear in this box until you give it a band — so a price is never chosen for it by accident.'
            : 'These are being charged already — they fall through to the middle band, because that is what happens when nothing is chosen. Nobody decided that price. Give each one a home, or decide out loud that the middle is right for it.'}
        </InfoTip>
      </h3>
      {!empty && (
        <div className="mt-3 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <span key={k.eventType} className="inline-flex items-center gap-2 py-1">
              <span className="text-[17px] leading-none" aria-hidden>
                {k.emoji}
              </span>
              <span className="text-[14px] font-bold">{k.label}</span>
              <Badge tone="no">falling through</Badge>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BandCard({
  band,
  allKinds,
  discountPct,
  formAction,
  savePriceAction,
}: {
  band: AiBandView;
  allKinds: EventKindView[];
  discountPct: number;
  formAction: (fd: FormData) => void;
  savePriceAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const notOffered = band.regularPhp == null;
  const computedSignup =
    band.regularPhp != null ? signupPriceFor(band.regularPhp, discountPct) : null;
  const storedDiscount = effectiveDiscountPct(band.regularPhp ?? 0, band.signupPhp);

  return (
    <section className={`${ADMIN_FRAME} overflow-hidden`}>
      <header className="flex flex-wrap items-center gap-4 border-b border-[color:var(--sn-divider)] p-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[15px] font-bold ${
            notOffered ? 'bg-ink/8 text-ink/55' : 'bg-gold/[0.16] text-gold-deep'
          }`}
        >
          {band.band}
        </span>

        {notOffered ? (
          <div className={`min-w-0 flex-1 ${TEMPLATE_SUBLINE}`}>
            <InfoTip label="Not offered — no price" align="start">
              Setnayan AI is not sold for these at all. <strong>This is not a free version</strong> —
              there are no suppliers to reach, so the planner has nobody to plan with.
            </InfoTip>
          </div>
        ) : (
          <>
            <BandPriceField
              band={band.band}
              regularPhp={band.regularPhp!}
              action={savePriceAction}
            />
            <div className="w-40">
              <span className={`mb-1 block ${TEMPLATE_SUBLINE}`}>At set-up</span>
              <p className="text-[15px] font-bold tabular-nums text-ink">
                {band.signupPhp == null ? '—' : peso(band.signupPhp)}
                {storedDiscount != null && (
                  <span className="ml-1.5 font-sans text-[11.5px] font-semibold text-ink/50">
                    {storedDiscount.toFixed(1)}% off
                  </span>
                )}
              </p>
              {computedSignup != null && computedSignup !== band.signupPhp && (
                <span className="mt-0.5 block text-[11px] font-semibold text-danger-700">
                  the saving above would make this {peso(computedSignup)}
                </span>
              )}
            </div>
          </>
        )}

        <div className="ml-auto flex min-w-0 flex-col gap-1">
          <span className="text-[14.5px] font-bold">
            {band.kinds.length} kind{band.kinds.length === 1 ? '' : 's'}
          </span>
          <span className="self-start">
            <Badge tone={band.isSellable ? 'ok' : 'quiet'}>
              {band.isSellable ? 'Sold as its own row' : notOffered ? 'No row' : 'Price source only'}
            </Badge>
          </span>
        </div>
      </header>

      <div className="p-4">
        {band.kinds.length === 0 ? (
          <p className={TEMPLATE_SUBLINE}>No kind of event pays this price.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {band.kinds.map((k) => (
              <span
                key={k.eventType}
                className="inline-flex items-center gap-2 rounded-md border border-ink/12 bg-cream px-2.5 py-1.5 text-[13.5px] font-semibold"
              >
                <span className="flex h-[17px] w-[17px] items-center justify-center rounded-sm border-[1.5px] border-terracotta-700 bg-terracotta-700 text-cream">
                  <Check className="h-[11px] w-[11px]" strokeWidth={2.6} aria-hidden />
                </span>
                <span className="text-[15px] leading-none" aria-hidden>
                  {k.emoji}
                </span>
                {k.label}
              </span>
            ))}
          </div>
        )}

        {/* Moving a kind IN. The select posts one kind + one band; that write is
            the whole move, because a kind's band is a single column on its row. */}
        {/* ⚡ No refresh beside the write: `setEventTypeBand` revalidates, so its own answer redraws the bands. (The
            refresh that sat here was fired WITHOUT waiting for the write — a second render that could even read the
            row before it changed.) */}
        <form
          action={formAction}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="band" value={band.band} />
          <span className={TEMPLATE_SUBLINE}>Move a kind here</span>
          {/* Only kinds NOT already here — moving a kind into the band it is
              already in is a no-op the action would report as "no changes".
              📐 Clean port: the ▾ house pick, still posting `event_type`. */}
          <FieldPick
            name="event_type"
            required
            label={`Move a kind of event into band ${band.band}`}
            placeholder="Choose an event…"
            className="min-h-9 max-w-[15rem]"
            options={allKinds
              .filter((k) => k.band !== band.band)
              .map((k) => ({
                key: k.eventType,
                label: `${k.emoji} ${k.label}${k.band == null ? ' — no band yet' : ` — now in ${k.band}`}`,
              }))}
          />
          <ActionButton tone="neutral" type="submit" icon={<ArrowRightLeft aria-hidden strokeWidth={1.9} />} label="Move" />
        </form>
      </div>
    </section>
  );
}


/**
 * ONE BAND'S REGULAR PRICE, EDITABLE IN PLACE.
 *
 * ⚖ Owner 2026-08-29: *"i need to be able to edit the prices here as well (the
 * regular price)"*. Three of the four AI prices previously had no editor at all
 * — bands B, C and D are `is_active = false` price SOURCES, so on the main
 * catalog screen they sit in the retired shelf, which is the last place anybody
 * would look for a live price.
 *
 * 🔑 THERE IS NO SIGN-UP FIELD HERE, ON PURPOSE. Setnayan AI carries ONE
 * discount for the whole family (owner 2026-08-28); a per-band sign-up box would
 * rebuild the four drifted discounts that ruling removed. The sign-up price is
 * shown beside this, computed, and it follows whatever is typed here.
 *
 * ⚠ Its own <form>, and it MUST stay out of the "move a kind here" form below —
 * HTML has no nested forms, so a price input inside that one would post with a
 * band assignment and neither save would mean what it says.
 */
function BandPriceField({
  band,
  regularPhp,
  action,
}: {
  band: string;
  regularPhp: number;
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });

  return (
    <form
      // ⚡ `saveAiBandPrice` revalidates: its own answer redraws the page — no refresh beside it.
      action={formAction}
      className="w-40"
    >
      <input type="hidden" name="band" value={band} />
      <label className={`mb-1 block ${TEMPLATE_SUBLINE}`} htmlFor={`ai-band-price-${band}`}>
        Regular price
      </label>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-ink/45">
            ₱
          </span>
          <input
            id={`ai-band-price-${band}`}
            name="regular_price_php"
            type="number"
            min="1"
            step="1"
            defaultValue={String(regularPhp)}
            className="input-field h-9 w-28 pl-5 text-right text-[14px] tabular-nums"
            aria-label={`Regular price for band ${band}`}
          />
        </div>
        <ActionButton tone="neutral" type="submit" icon={<Save aria-hidden strokeWidth={1.9} />} label="Save" />
      </div>
      {state.message && (
        <span
          className={`mt-1 block text-[11px] font-semibold ${
            state.ok ? 'text-success-800' : 'text-danger-700'
          }`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
