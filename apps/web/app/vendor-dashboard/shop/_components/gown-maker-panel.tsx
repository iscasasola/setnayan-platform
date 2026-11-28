'use client';

/**
 * 👗 SHOP › YOUR WIDGETS › ATTIRE MAKER — the designer's own price list, SET ONCE PER SHOP (gown maker port step B4;
 * corpus WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 2.1; the approved drawing for behaviour and words is the prototype
 * `prototypes/gown_maker_2026-11-27/gown_maker_v195.html` "Your price list"; add-ons per DESIGN-REVIEW-v187 § D).
 *
 * Every line reads ONE list (lib/gown-maker.ts): how she prices, her own amounts (an empty one stays unpriced, never
 * zero), what a starting price includes, her markup, her workshop hours and each add-on's state. Saved as ONE row per
 * shop (`vendor_gown_makers`) through `gownAction({ op: 'save' })`, which runs the same `sanitizeGownShopOptions` —
 * a refusal is the sentence shown here. Brides never see this page or any amount on it: they see the estimate.
 *
 * 🔒 A PAID WIDGET: open only when bought in the Toolkit AND on Plus, Pro or Ultra. Locked, the page says so with one door
 * to the Attire Maker's Toolkit page and saves nothing — any saved list stays as it is.
 *
 * Lazy-loaded from the tile (shop-makers.tsx), so none of it is in the Shop's first load.
 */
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { GownStockPanel as GownStockPanelType } from './gown-stock-panel';
import Link from 'next/link';
import { Lock, RotateCcw, RotateCw, Save } from 'lucide-react';
import { GownSeamAllowRows } from './gown-seam-allow';
import { GOWN_SEAM_ALLOW_DEFAULT, GOWN_SEAM_KINDS } from '@/lib/gown-pattern/allowance';
import { GOWN_PAPERS } from '@/lib/gown-pattern/export';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { PillSelector } from '@/app/_components/pill-selector';
import { useToast } from '@/app/_components/toast/toast-provider';
import { formatAmountInput, parseAmountInput } from '@/lib/service-customization-draft';
import { SPECIAL_TOOLS_LOCKED_WORDS } from '@/lib/special-tools';
import { routes } from '@/lib/routes';
import {
  GOWN_ADD_ONS,
  GOWN_HOUR_LABELS,
  GOWN_PRICE_GROUPS,
  GOWN_PRICE_ITEMS,
  type GownAddOnKey,
  type GownAddOnState,
  type GownHourKey,
  type GownPriceKey,
  type GownShopOptions,
  gownSeamAllowIsUsual,
  gownShopPaper,
  gownShopSeamAllow,
} from '@/lib/gown-maker';
import { gownAction } from '@/app/_components/gown-maker/gown-call';

/** Fabrics and looks load only when their view is opened (step B5). */
const GownStockPanel = dynamic(() => import('./gown-stock-panel').then((m) => m.GownStockPanel), {
  loading: () => <div className="sn-frame skeleton h-48" aria-busy="true" />,
});
const VIEWS = [
  { key: 'prices', label: 'Price list' },
  { key: 'fabrics', label: 'Fabrics' },
  { key: 'looks', label: 'Looks' },
] as const;
type View = (typeof VIEWS)[number]['key'];

type Load = { s: 'loading' } | { s: 'failed'; message: string } | { s: 'ok'; options: GownShopOptions; saved: boolean; locked: boolean };

const MODE_OPTIONS = [
  { key: 'covers', label: 'Covers the design until it costs more' },
  { key: 'extras', label: 'Base plus every extra' },
] as const;
const MODE_LINE = {
  covers: 'Enter what each item costs you. The bride sees your starting price until the design costs more, then the higher price.',
  extras: 'Each starting price is locked. Mark what it already includes; every other choice adds the price you enter.',
} as const;
/** v205: "Back to the usual (1.5 · 2.5 · 2.0 · 1.0 cm)", read from the one list of kinds. */
const USUAL_WORDS = GOWN_SEAM_KINDS.map((k) => k[2].toFixed(1)).join(' · ');
const PAPER_OPTIONS = (Object.keys(GOWN_PAPERS) as (keyof typeof GOWN_PAPERS)[]).map((k) => ({ key: k, label: GOWN_PAPERS[k].name }));
const ADD_ON_OPTIONS = [
  { key: 'none', label: 'Not offered' },
  { key: 'priced', label: 'Priced' },
  { key: 'free', label: 'Included' },
  { key: 'request', label: 'On request' },
];
const UNIT_WORD: Record<string, string> = { gown: 'per gown', m: 'per metre', pc: 'per piece', pair: 'per pair', '100 pcs': 'per 100', '10 flowers': 'per 10 flowers', hour: 'per hour' };

export function GownMakerPanel({
  seed,
  startView = 'prices',
  stockSeed,
}: { seed?: { options: GownShopOptions; saved: boolean; locked: boolean }; startView?: View; stockSeed?: ComponentProps<typeof GownStockPanelType>['seed'] } = {}) {
  const [view, setView] = useState<View>(startView);
  const [load, setLoad] = useState<Load>(seed ? { s: 'ok', ...seed } : { s: 'loading' });
  const read = useCallback(() => {
    setLoad({ s: 'loading' });
    gownAction({ op: 'options' })
      .then((r) => {
        if (r.ok && r.op === 'options') setLoad({ s: 'ok', options: r.options, saved: r.saved, locked: r.locked });
        else setLoad({ s: 'failed', message: r.ok ? 'Couldn’t load your Attire Maker.' : r.message });
      })
      .catch(() => setLoad({ s: 'failed', message: 'Couldn’t load your Attire Maker.' }));
  }, []);
  useEffect(() => {
    if (!seed) read();
  }, [read, seed]);

  if (load.s === 'loading') {
    return (
      <div className="space-y-3" data-gown-maker="loading" aria-busy="true">
        <div className="sn-frame skeleton h-60" />
      </div>
    );
  }
  if (load.s === 'failed') {
    return (
      <div className="sn-frame space-y-2 p-4" data-gown-maker="failed" role="alert">
        <p className="text-sn-md font-semibold text-ink">Couldn’t load your Attire Maker</p>
        <p className="text-sn-base text-ink/70">{load.message} Nothing was changed.</p>
        <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={read} />
      </div>
    );
  }
  const picker = <PillSelector label="Attire Maker" value={view} options={VIEWS} onPick={(k) => setView(k)} data="gown-view" />;
  if (view !== 'prices') {
    return (
      <div className="space-y-4">
        {picker}
        <GownStockPanel view={view} seed={stockSeed} />
      </div>
    );
  }
  if (load.locked) {
    return (
      <div className="sn-frame flex items-start gap-3 p-4" data-gown-maker="locked">
        <Lock aria-hidden className="mt-0.5 h-4 w-4 flex-none" />
        <span className="min-w-0 flex-1">
          <b className="block text-sn-md text-ink">{SPECIAL_TOOLS_LOCKED_WORDS}</b>
          <small className="block text-sn-base text-ink/70">
            Brides design their gown in your chat, priced from your own list. {load.saved ? 'Your saved price list is kept as it is.' : ''}
          </small>
        </span>
        <Link href={routes.vendorDashboard.shop.store.item('tools', 'attire_tool')} className="text-sn-base font-semibold text-link underline" data-web-only="">
          See in the Toolkit
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {picker}
      <GownMakerEditor start={load.options} />
    </div>
  );
}

function GownMakerEditor({ start }: { start: GownShopOptions }) {
  const toast = useToast();
  const [o, setO] = useState<GownShopOptions>(start);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const extras = o.mode === 'extras';
  const seamAllow = gownShopSeamAllow(o);

  const setPrice = (k: GownPriceKey, raw: string) => {
    const c = parseAmountInput(raw);
    setO((p) => {
      const prices = { ...p.prices };
      if (c > 0) prices[k] = c;
      else delete prices[k];
      return { ...p, prices };
    });
  };
  const setInBase = (k: GownPriceKey, on: boolean) => setO((p) => ({ ...p, inBase: on ? [...new Set([...p.inBase, k])] : p.inBase.filter((x) => x !== k) }));
  const setHour = (k: GownHourKey, raw: string) => {
    const h = Number(raw.replace(',', '.'));
    if (Number.isFinite(h) && h >= 0) setO((p) => ({ ...p, hours: { ...p.hours, [k]: Math.round(h * 100) / 100 } }));
  };
  const setAddOn = (k: GownAddOnKey, next: GownAddOnState) => setO((p) => ({ ...p, addOns: { ...p.addOns, [k]: next } }));

  const save = async () => {
    setSaving(true);
    setProblem(null);
    const r = await gownAction({ op: 'save', options: o });
    setSaving(false);
    if (r.ok) toast.success('Price list saved');
    else {
      setProblem(r.message);
      toast.error(r.message);
    }
  };

  return (
    <div className="space-y-5" data-gown-maker="editor">
      <section className="space-y-1">
        <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">How you price</h3>
        <FormRows>
          <ChosenRow
            name="Pricing"
            value={o.mode}
            options={MODE_OPTIONS}
            onPick={(k) => setO((p) => ({ ...p, mode: k === 'extras' ? 'extras' : 'covers' }))}
            note={MODE_LINE[o.mode]}
            data="gown-mode"
          />
          {extras ? null : (
            <TypedRow
              name="Markup"
              value={o.markupPct > 0 ? String(o.markupPct) : ''}
              empty="0%"
              inputMode="numeric"
              onKeep={(v) => setO((p) => ({ ...p, markupPct: Math.min(500, Math.max(0, Number(v.replace(/\D/g, '')) || 0)) }))}
              note="Added on your costs, percent."
              data="gown-markup"
            />
          )}
        </FormRows>
      </section>

      {GOWN_PRICE_GROUPS.map(([group, inGroup]) => {
        const items = GOWN_PRICE_ITEMS.filter((i) => inGroup(i.key));
        if (!items.length) return null;
        return (
          <section key={group} className="space-y-1" data-gown-group={group}>
            <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">{group}</h3>
            <FormRows>
              {items.map((i) => {
                const supply = !i.key.startsWith('base_') && i.key !== 'rate';
                const included = extras && supply && o.inBase.includes(i.key);
                return (
                  <div key={i.key}>
                    {included ? null : (
                      <TypedRow
                        name={i.label}
                        amount
                        value={formatAmountInput(o.prices[i.key] ?? 0)}
                        empty="Not priced"
                        onType={(v) => setPrice(i.key, v)}
                        onKeep={(v) => setPrice(i.key, v)}
                        note={UNIT_WORD[i.unit]}
                        data="gown-price"
                        attrs={{ 'data-gown-price': i.key }}
                      />
                    )}
                    {extras && supply ? (
                      <SwitchRow name={`${i.label}: in the starting price`} on={included} onChange={(on) => setInBase(i.key, on)} data="gown-in-base" />
                    ) : null}
                  </div>
                );
              })}
            </FormRows>
          </section>
        );
      })}

      <section className="space-y-1" data-gown-group="hours">
        <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Time standards</h3>
        <FormRows>
          {(Object.keys(GOWN_HOUR_LABELS) as GownHourKey[]).map((k) => (
            <TypedRow key={k} name={GOWN_HOUR_LABELS[k]} value={String(o.hours[k])} inputMode="numeric" onKeep={(v) => setHour(k, v)} note="hours" data="gown-hours" />
          ))}
        </FormRows>
      </section>

      <section className="space-y-1" data-gown-group="add-ons">
        <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Add-ons</h3>
        <p className="text-sn-base text-ink/70">Brides only see what you offer. Which ones are free is your choice.</p>
        <FormRows>
          {GOWN_ADD_ONS.map((a) => {
            const st = o.addOns[a.id];
            return (
              <div key={a.id}>
                <ChosenRow
                  name={a.label}
                  value={st.state}
                  options={ADD_ON_OPTIONS}
                  onPick={(k) => setAddOn(a.id, k === 'priced' ? { state: 'priced', centavos: st.state === 'priced' ? st.centavos : null } : ({ state: k } as GownAddOnState))}
                  data="gown-add-on"
                  attrs={{ 'data-gown-add-on': a.id }}
                />
                {st.state === 'priced' ? (
                  <TypedRow
                    name={`${a.label}: your price`}
                    amount
                    value={formatAmountInput(st.centavos ?? 0)}
                    empty="Not priced"
                    onType={(v) => setAddOn(a.id, { state: 'priced', centavos: parseAmountInput(v) || null })}
                    onKeep={(v) => setAddOn(a.id, { state: 'priced', centavos: parseAmountInput(v) || null })}
                    data="gown-add-on-price"
                  />
                ) : null}
              </div>
            );
          })}
        </FormRows>
      </section>

      <section className="space-y-2" data-gown-group="pattern">
        <h3 className="text-sn-sm font-semibold uppercase tracking-wide text-ink/70">Patterns and printing</h3>
        <p className="text-sn-base text-ink/70">Used by the cutting blocks on every order. Only you see this.</p>
        <p className="text-sn-md font-semibold text-ink">Seam allowances</p>
        <p className="text-sn-base text-ink/70">
          Where the cut line sits outside the stitching line, in centimetres. Every order’s cutting blocks start from these; you can change them for one order there.
        </p>
        <GownSeamAllowRows value={seamAllow} onChange={(next) => setO((p) => ({ ...p, seamAllow: next }))} data="shop" />
        {gownSeamAllowIsUsual(seamAllow) ? null : (
          <ActionButton tone="neutral" icon={RotateCcw} label={`Back to the usual (${USUAL_WORDS} cm)`} onClick={() => setO((p) => ({ ...p, seamAllow: { ...GOWN_SEAM_ALLOW_DEFAULT } }))} data-gown-seam-usual="" />
        )}
        <FormRows>
          <ChosenRow
            name="Paper for printing patterns"
            value={gownShopPaper(o)}
            options={PAPER_OPTIONS}
            onPick={(k) => setO((p) => ({ ...p, patPaper: k === 'letter' ? 'letter' : 'a4' }))}
            note="Patterns print at true size, tiled across pages, with a 5 cm test square on every page."
            data="gown-paper"
          />
        </FormRows>
      </section>

      {problem ? (
        <p role="alert" className="text-sn-base font-semibold text-danger-700">
          {problem}
        </p>
      ) : null}
      <ActionButton tone="brand" icon={Save} label={saving ? 'Saving…' : 'Save'} onClick={save} disabled={saving} className="w-full" data-gown-save="" />
    </div>
  );
}
