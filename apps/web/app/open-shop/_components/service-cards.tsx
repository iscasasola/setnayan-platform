'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, LockOpen, Plus } from 'lucide-react';

import { InfoTip } from '@/app/_components/info-tip';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FIRST_BOOKING_FREE_LABEL, coverageLine, holdsMoreThanFree, whatEachPlanHolds, type MeterService } from '@/lib/open-shop-more-services';
import { ServicePicker, type PickerLeafView, type PickerParentView } from './service-picker';

/** Where a leaf sits in the tree: its tier-2 category (the meter's unit, the card it lands in) and its group. */
export type LeafPlace = {
  categoryId: string;
  categoryLabel: string;
  categoryPhoto: string | null;
  categoryHint: string | null;
  groupId: string;
  groupLabel: string;
  /** Every service of this category, in the tree's order — the card's blank row offers the ones not yet picked. */
  siblings: { key: string; label: string }[];
  allowedEventTypes: string[] | null;
};

/** Leaf key → its place, built once from the picker's own tree. */
export function placeIndex(tree: readonly PickerParentView[]): Map<string, LeafPlace> {
  const out = new Map<string, LeafPlace>();
  for (const p of tree)
    for (const b of p.branches) {
      const siblings = b.leaves.map((l) => ({ key: l.canonicalService, label: l.label }));
      for (const l of b.leaves)
        out.set(l.canonicalService, {
          categoryId: b.tileId,
          categoryLabel: b.label,
          categoryPhoto: b.photoUrl ?? null,
          categoryHint: b.hint ?? null,
          groupId: p.folderId,
          groupLabel: p.label,
          siblings,
          allowedEventTypes: l.allowedEventTypes ?? null,
        });
    }
  return out;
}

/** A picked service: its key and name. The main is the first; the rest were added under it. */
export type PickedService = { key: string; label: string };

/**
 * One specialty question of a service — a chip-shaped refinement of its own schema (`canonical_service_schemas`,
 * `fetchCategoryChipRefinementsMany`). `single` = the schema keeps one value (`enum`, or a one-chip `boolean`).
 */
export type SpecialtyField = { key: string; label: string; options: { value: string; label: string }[]; single: boolean };

/** `{ service: { field: [values] } }` — what the chips hold. */
export type SpecialtyPicks = Record<string, Record<string, string[]>>;

const normName = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');

/**
 * 🗂 "YOUR SERVICES" — ONE PLAIN CARD PER PICKED CATEGORY (prototype v14 → v16 `zPicked` / `catCard`).
 *
 *   · the card: the category's photo, its name, its group (dropped when it equals the category), the category's ⓘ;
 *   · its services as rows (Change for the main, Remove for an added one), each with its specialties (v16: closed with
 *     picks = the picks in ink + "+ Add"; open = every chip + Done; opening one closes the others);
 *   · a category whose only service carries its own name (Cake › Cake) shows the name once — the header IS the service;
 *   · under the last row a BLANK row picks another service of that category ("Also do …?"), or says every one is on;
 *   · after the last card, a dashed "Another category" frame opens the category tiles (frame → tile → row). The card the
 *     pick lands in scrolls into view and flashes once (v16 ①: "a third and fourth category always add").
 *
 * Under the cards: the coverage line ("N categories · M services — ‹plan› covers this ⓘ", the per-category split) and,
 * once the picks are more than Free holds, ONE hint + ⓘ — the plan explainer itself opens on Continue (`PlanSheet`).
 * ⚠ A METER, NOT A GATE: nothing here refuses a service for the plan.
 */
export function ServiceCards({
  tree,
  places,
  picked,
  onPickedChange,
  specialties,
  picks,
  onPicksChange,
  openSpecialty,
  onOpenSpecialty,
  adding,
  onAddingChange,
}: {
  tree: PickerParentView[];
  places: Map<string, LeafPlace>;
  /** The main first, then the added ones. */
  picked: PickedService[];
  /** `null` main = "Change" was pressed: the picker is back for the main. */
  onPickedChange: (next: { main: PickedService | null; added: PickedService[] }) => void;
  specialties: Record<string, SpecialtyField[]>;
  picks: SpecialtyPicks;
  onPicksChange: (next: SpecialtyPicks) => void;
  openSpecialty: string | null;
  onOpenSpecialty: (key: string | null) => void;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}) {
  const main = picked[0]!;
  const added = picked.slice(1);
  const rootRef = useRef<HTMLDivElement>(null);
  /** The service just added from "Another category" — its card scrolls into view and flashes once. */
  const [flash, setFlash] = useState<string | null>(null);

  // ① THE CARD A PICK LANDS IN SCROLLS INTO VIEW AND FLASHES ONCE (prototype v16 `lvRender` · `LV.flash`).
  useEffect(() => {
    if (!flash) return;
    const card = rootRef.current?.querySelector<HTMLElement>(`[data-open-shop-card-has~="${CSS.escape(flash)}"]`);
    setFlash(null);
    if (!card) return;
    // No cleanup on purpose: clearing `flash` re-runs this effect, and a cleanup would cancel the scroll.
    card.dataset.flash = '1';
    window.setTimeout(() => card.scrollIntoView({ block: 'center', behavior: 'smooth' }), 30);
    window.setTimeout(() => delete card.dataset.flash, 1400);
  }, [flash]);

  const meterOf = (key: string): MeterService => {
    const p = places.get(key);
    // A key the tree no longer holds (a draft from an older build) still counts — as its own category.
    return { categoryId: p?.categoryId ?? key, categoryLabel: p?.categoryLabel ?? key };
  };
  const list = picked.map((s) => meterOf(s.key));
  const line = coverageLine(list);
  const over = holdsMoreThanFree(list);

  // Picked services grouped by CATEGORY, in the order the categories first appear.
  const byCat: { id: string; services: PickedService[] }[] = [];
  for (const s of picked) {
    const id = places.get(s.key)?.categoryId ?? s.key;
    const hit = byCat.find((c) => c.id === id);
    if (hit) hit.services.push(s);
    else byCat.push({ id, services: [s] });
  }
  const pickedKeys = new Set(picked.map((s) => s.key));

  const remove = (key: string) => {
    onPickedChange({ main, added: added.filter((a) => a.key !== key) });
    if (picks[key]) {
      const next = { ...picks };
      delete next[key];
      onPicksChange(next);
    }
    if (openSpecialty === key) onOpenSpecialty(null);
  };
  const change = () => {
    if (picks[main.key]) {
      const next = { ...picks };
      delete next[main.key];
      onPicksChange(next);
    }
    onOpenSpecialty(null);
    onPickedChange({ main: null, added });
  };
  const addOne = (s: PickedService) => {
    if (pickedKeys.has(s.key)) return;
    onPickedChange({ main, added: [...added, s] });
  };

  const link = 'inline-flex min-h-9 shrink-0 items-center text-[13px] font-medium text-terracotta';
  const svcLink = (s: PickedService) =>
    s.key === main.key ? (
      <button type="button" className={link} onClick={change} aria-label={`Change ${s.label}`}>
        Change
      </button>
    ) : (
      <button type="button" className={link} onClick={() => remove(s.key)} aria-label={`Remove ${s.label}`}>
        Remove
      </button>
    );

  const tip = whatEachPlanHolds();
  const tipBody = (
    <span className="block space-y-1">
      <b className="block">{tip.title}</b>
      <span className="block">{tip.lead}</span>
      {tip.ladder.map((r) => (
        <span key={r.name} className="block">
          <b>{r.name}</b> · {r.caps}
        </span>
      ))}
      <span className="block">{tip.listing}</span>
      <span className="block">{tip.after}</span>
      <b className="block">{tip.firstBooking}</b>
      <span className="block">{tip.fine}</span>
    </span>
  );

  return (
    <div ref={rootRef} className="grid gap-3" data-open-shop-service-cards="">
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start" data-open-shop-cardset="">
        {byCat.map(({ id, services }) => {
          const place = places.get(services[0]!.key);
          const cat = place?.categoryLabel ?? services[0]!.label;
          const group = place?.groupLabel ?? null;
          const siblings = place?.siblings ?? [];
          const one = siblings.length === 1 && normName(siblings[0]!.label) === normName(cat);
          const remain = siblings.filter((x) => !pickedKeys.has(x.key));
          return (
            <div
              key={id}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] rounded-xl border transition-shadow duration-500 data-[flash]:shadow-[0_0_0_2px_var(--m-orange-3)]" // no-card-ok: the owner-approved "one plain card per category" (prototype v14 → v16, 6 Nov)
              style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
              data-open-shop-card={id}
              data-open-shop-card-has={services.map((s) => s.key).join(' ')}
            >
              <div
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 border-b px-3 py-2.5"
                style={{ borderColor: 'var(--m-line)' }}
              >
                <span
                  className="h-11 w-11 overflow-hidden rounded-[var(--m-r-md)]"
                  style={{
                    background: place?.categoryPhoto
                      ? 'var(--m-line)'
                      : 'linear-gradient(135deg, var(--m-orange-deep), var(--m-ink))',
                  }}
                >
                  {place?.categoryPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed catalogue URL, not an optimisable asset
                    <img src={place.categoryPhoto} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <span className="grid min-w-0 text-[15px] font-medium leading-[1.2]" style={{ color: 'var(--m-ink)' }}>
                  <span className="[overflow-wrap:anywhere]">{cat}</span>
                  {group && normName(group) !== normName(cat) ? (
                    <span className="mt-0.5 text-xs font-normal" style={{ color: 'var(--m-slate-3)' }}>
                      {place?.categoryHint ? (
                        <InfoTip label={group} labelClassName="text-xs" ariaLabel={`What is ${cat}?`} align="start">
                          {place.categoryHint}
                        </InfoTip>
                      ) : (
                        group
                      )}
                    </span>
                  ) : null}
                </span>
                {one ? svcLink(services[0]!) : <span />}
              </div>
              {one ? (
                specialties[services[0]!.key]?.length ? (
                  <div className="px-3 pb-2 pt-2">
                    <Specialties
                      service={services[0]!}
                      fields={specialties[services[0]!.key]!}
                      picks={picks}
                      onPicksChange={onPicksChange}
                      open={openSpecialty === services[0]!.key}
                      onOpen={onOpenSpecialty}
                    />
                  </div>
                ) : null
              ) : (
                <>
                  {services.map((s) => (
                    <div
                      key={s.key}
                      className="grid gap-1.5 border-b py-2.5 pl-[66px] pr-3"
                      style={{ borderColor: 'var(--m-line)' }}
                      data-open-shop-service-row-picked={s.key}
                    >
                      <div className="flex min-h-9 items-center justify-between gap-2.5 text-[15px] font-medium" style={{ color: 'var(--m-ink)' }}>
                        <span className="min-w-0 [overflow-wrap:anywhere]">{s.label}</span>
                        {svcLink(s)}
                      </div>
                      {specialties[s.key]?.length ? (
                        <Specialties
                          service={s}
                          fields={specialties[s.key]!}
                          picks={picks}
                          onPicksChange={onPicksChange}
                          open={openSpecialty === s.key}
                          onOpen={onOpenSpecialty}
                        />
                      ) : null}
                    </div>
                  ))}
                  {remain.length ? (
                    /* The blank row (owner 6 Nov: "a blank row under the wine row. to pick more?") — the house dropdown
                       (`PickMenu`): one tap opens the remaining services of THIS category. */
                    <div className="min-w-0 py-2.5 pl-[66px] pr-3" data-open-shop-also-do={id}>
                      <PickMenu
                        label={`Also do ${remain.map((x) => x.label).join(', ')}?`}
                        buttonText={`Also do ${remain.map((x) => x.label).join(', ')}?`}
                        value={null}
                        options={remain.map((x) => ({ key: x.key, label: x.label }))}
                        onPick={(key) => {
                          const hit = remain.find((x) => x.key === key);
                          if (hit) addOne(hit);
                        }}
                        // The blank row's dashed outline (prototype `.srow.blank .pick`); the long name truncates.
                        className="w-full justify-between border border-dashed !font-normal"
                      />
                    </div>
                  ) : siblings.length ? (
                    <div className="flex items-center gap-1.5 px-3 py-2.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                      <Check aria-hidden className="h-[15px] w-[15px]" strokeWidth={2} style={{ color: 'var(--m-sage-deep)' }} />
                      Every {cat} service is on your list
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
        {adding ? null : (
          <button
            type="button"
            onClick={() => {
              onOpenSpecialty(null);
              onAddingChange(true);
            }}
            className="flex min-h-[66px] w-full items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-[15px] font-medium" // no-card-ok: this is the "Another category" <button> itself, a pressable
            style={{ borderColor: 'var(--m-slate-3)', color: 'var(--m-slate-3)' }}
            data-open-shop-another-category=""
          >
            <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Another category
          </button>
        )}
      </div>

      {adding ? (
        <div className="grid gap-1.5" data-open-shop-add-picker="">
          <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            Another category
          </span>
          <ServicePicker
            tree={tree}
            autoFocus
            excludeCategories={new Set(byCat.map((c) => c.id))}
            excludeServices={pickedKeys}
            onPick={(leaf: PickerLeafView) => {
              addOne({ key: leaf.canonicalService, label: leaf.label });
              onAddingChange(false);
              setFlash(leaf.canonicalService);
            }}
          />
          <button type="button" className={`${link} justify-self-start`} onClick={() => onAddingChange(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      {/* The coverage line — "N categories · M services — ‹plan› covers this ⓘ", then the count per category. */}
      <div className="relative grid gap-1 text-[13.5px]" style={{ color: 'var(--m-slate)' }} data-open-shop-coverage="">
        <span className="block">
          <b className="font-semibold" style={{ color: 'var(--m-ink)' }}>
            {line.tally}
          </b>{' '}
          <span aria-hidden>—</span>{' '}
          <InfoTip label={line.verdict} labelClassName="text-[13.5px]" ariaLabel={tip.title} align="start" className="!static !inline [&>button]:ml-1 [&>button]:inline-flex [&>button]:align-[-2px]">
            {tipBody}
          </InfoTip>
        </span>
        {line.split ? (
          <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }} data-open-shop-coverage-split="">
            {line.split}
          </span>
        ) : null}
      </div>
      {/* ② The one-line hint + ⓘ that stays inline; the explainer itself opens on Continue (`PlanSheet`). */}
      {over ? (
        <span className="relative flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }} data-open-shop-plan-note="">
          <LockOpen aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <InfoTip
            label={`${FIRST_BOOKING_FREE_LABEL}. What each plan adds shows before you continue.`}
            labelClassName="text-xs"
            ariaLabel="What each plan adds"
            align="start"
            className="!static"
          >
            {tipBody}
          </InfoTip>
        </span>
      ) : null}
    </div>
  );
}

/**
 * ③ SPECIALTIES COMPILE (prototype v16 `fvBlock`, owner 6 Nov: *"when we add specialization … it should compile and hide
 * the other with an add button"*): closed with picks = the picks in ink · "+ Add"; open = every chip + Done; closed with
 * none = "+ Specialties (optional)". Opening one closes the others (the wizard holds the one open key). Optional —
 * nothing here blocks Continue.
 */
function Specialties({
  service,
  fields,
  picks,
  onPicksChange,
  open,
  onOpen,
}: {
  service: PickedService;
  fields: SpecialtyField[];
  picks: SpecialtyPicks;
  onPicksChange: (next: SpecialtyPicks) => void;
  open: boolean;
  onOpen: (key: string | null) => void;
}) {
  const mine = picks[service.key] ?? {};
  // The opened chips are revealed the house way (owner 2026-11-04, app-wide reveal-on-open): the head is this block.
  const headRef = useRef<HTMLDivElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: headRef.current }));
  const word = fields.every((f) => f.single) ? 'Specialty' : 'Specialties';
  const summary = fields.flatMap((f) =>
    (mine[f.key] ?? []).map((v) => f.options.find((o) => o.value === v)?.label ?? v),
  );
  const quiet = 'inline-flex min-h-8 items-center text-[13px]';
  const toggle = (f: SpecialtyField, value: string) => {
    const cur = mine[f.key] ?? [];
    const nextVals = cur.includes(value) ? cur.filter((v) => v !== value) : f.single ? [value] : [...cur, value];
    const nextMine = { ...mine, [f.key]: nextVals };
    if (!nextVals.length) delete nextMine[f.key];
    const next = { ...picks, [service.key]: nextMine };
    if (!Object.keys(nextMine).length) delete next[service.key];
    onPicksChange(next);
  };

  if (!open) {
    return summary.length ? (
      <div className="-mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5" data-open-shop-specialties={service.key}>
        <span className="min-w-0 text-[13px] [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
          {summary.join(' · ')}
        </span>
        <button
          type="button"
          className={`${quiet} gap-0.5`}
          style={{ color: 'var(--m-slate-3)' }}
          onClick={() => {
            intend();
            onOpen(service.key);
          }}
          aria-expanded={false}
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Add
        </button>
      </div>
    ) : (
      <div className="-mt-1" data-open-shop-specialties={service.key}>
        <button
          type="button"
          className={quiet}
          style={{ color: 'var(--m-slate-3)' }}
          onClick={() => {
            intend();
            onOpen(service.key);
          }}
          aria-expanded={false}
        >
          + {word}&nbsp;<small className="text-xs">(optional)</small>
        </button>
      </div>
    );
  }
  return (
    <div ref={headRef} className="grid gap-2.5" data-open-shop-specialties={service.key} data-open="">
      <div className="-mt-1 flex items-center gap-2.5">
        <button type="button" className={quiet} style={{ color: 'var(--m-slate-3)' }} onClick={() => onOpen(null)} aria-expanded>
          – {word}&nbsp;<small className="text-xs">(optional)</small>
        </button>
        <button type="button" className={`${quiet} ml-auto font-medium text-terracotta`} onClick={() => onOpen(null)}>
          Done
        </button>
      </div>
      {fields.map((f) => {
        const on = mine[f.key] ?? [];
        const lone = f.options.length === 1;
        return (
          <div key={f.key} className="grid gap-1.5">
            {lone ? null : (
              <span className="text-[12.5px]" style={{ color: 'var(--m-slate-3)' }}>
                {/* The prototype's question, then "Pick all that apply." — a schema label carries no punctuation of its
                    own, so a full stop separates the two. */}
                {f.single ? f.label : `${/[.?!]$/.test(f.label) ? f.label : `${f.label}.`} Pick all that apply.`}
              </span>
            )}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={f.label}>
              {f.options.map((o) => {
                const isOn = on.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(f, o.value)}
                    role="checkbox"
                    aria-checked={isOn}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-left text-[13.5px] leading-tight"
                    style={
                      isOn
                        ? { background: 'var(--m-orange-4)', borderColor: 'var(--m-orange-3)', color: 'var(--m-orange-deep)', fontWeight: 500 }
                        : { background: 'var(--m-paper)', borderColor: 'var(--m-line)', color: 'var(--m-ink)' }
                    }
                  >
                    {isOn ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} /> : null}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
