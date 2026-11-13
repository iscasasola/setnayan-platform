'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronUp, LockOpen, Plus, Trash2, X } from 'lucide-react';

import { ActionButton, useFitRow } from '@/components/action-button';
import { Count } from '@/components/count';
import { InfoTip } from '@/app/_components/info-tip';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FIRST_BOOKING_FREE_LABEL, coverageLine, holdsMoreThanFree, whatEachPlanHolds, type MeterService } from '@/lib/open-shop-more-services';
import { tileIcon } from '@/lib/taxonomy-icons';
import { ServicePicker, type PickerLeafView, type PickerParentView } from '@/app/_components/service-picker';

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
 *   · its services as rows, each with its specialties (v16: closed with picks = the picks in ink + "+ Add"; open = every
 *     chip + Done; opening one closes the others). v18 (owner 7 Nov, "with the swipe left to delete"): NO row buttons —
 *     a row is removed by the house swipe (`SwipeToDelete`, hover on a computer) with Undo in the toast (the wizard's
 *     `onRemove`); Remove also sits inside the opened specialties. Removing the main makes the next one the main;
 *     removing the last brings the picker back;
 *   · v19 — buttons by meaning (BUTTON_RULE): ⌃ Specialties grey · Remove red · ✓ Done green, one fit row;
 *   · v19 — a category with no photo yet: the wash + line, one lucide icon in gold (`tileIcon`), never a brown gradient;
 *   · v19 — a new card rises once; a re-render never replays it;
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
  onRemove,
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
  /** A service was added (the blank row, "Another category"). */
  onPickedChange: (next: { main: PickedService | null; added: PickedService[] }) => void;
  /** v18 — a row was swiped away (or Remove pressed inside its specialties). The wizard removes it and offers Undo. */
  onRemove: (key: string) => void;
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

  // v19 MOTION — a NEW card rises once (prototype `ANIM.cards`): the categories already drawn are remembered, so a
  // re-render (or a chip tapped inside a card) never replays it. Reduced motion → `.os-rise` does nothing.
  const seenCards = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const c of byCat) seenCards.current.add(c.id);
  });

  const addOne = (s: PickedService) => {
    if (pickedKeys.has(s.key)) return;
    onPickedChange({ main, added: [...added, s] });
  };

  /** v18 — THE ONE SWIPE (`SwipeToDelete`): swipe left on a phone, hover on a computer; Undo is the wizard's toast. */
  const swipe = (s: PickedService, child: React.ReactNode) => (
    <SwipeToDelete
      key={s.key}
      label={`Remove ${s.label}`}
      word="Remove"
      onDelete={() => onRemove(s.key)}
      radiusClass="rounded-none"
      surfaceClass="bg-[var(--m-paper)]"
    >
      {child}
    </SwipeToDelete>
  );

  const tipBody = <PlanTipBody />;

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
          const Icon = tileIcon(id);
          const header = (
            <div
              className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2.5 border-b px-3 py-2.5"
              style={{ borderColor: 'var(--m-line)' }}
            >
              {/* v19 · a category with no photo yet: the app's wash + line, one lucide icon in gold — the owner's
                  photos drop in over it. Never the brown gradient. */}
              <span
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[var(--m-r-md)]"
                style={
                  place?.categoryPhoto
                    ? { background: 'var(--m-line)' }
                    : { background: 'var(--m-paper-2)', boxShadow: 'inset 0 0 0 1px var(--m-line)', color: 'rgb(var(--color-terracotta))' }
                }
                data-open-shop-card-thumb={place?.categoryPhoto ? 'photo' : 'icon'}
              >
                {place?.categoryPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed catalogue URL, not an optimisable asset
                  <img src={place.categoryPhoto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                )}
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
            </div>
          );
          const rise = !seenCards.current.has(id);
          return (
            <div
              key={id}
              className={`grid min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border transition-shadow duration-500 data-[flash]:shadow-[0_0_0_2px_var(--m-orange-3)] ${rise ? 'os-rise' : ''}`} // no-card-ok: the owner-approved "one plain card per category" (prototype v14 → v16, 6 Nov)
              style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) e.currentTarget.classList.remove('os-rise');
              }}
              data-open-shop-card={id}
              data-open-shop-card-has={services.map((s) => s.key).join(' ')}
            >
              {one ? (
                /* A one-service category: the header IS the service — the header is the row that swipes. */
                <>
                  {swipe(services[0]!, header)}
                  {specialties[services[0]!.key]?.length ? (
                    <div className="px-3 pb-2 pt-2">
                      <Specialties
                        service={services[0]!}
                        fields={specialties[services[0]!.key]!}
                        picks={picks}
                        onPicksChange={onPicksChange}
                        open={openSpecialty === services[0]!.key}
                        onOpen={onOpenSpecialty}
                        onRemove={onRemove}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {header}
                  {services.map((s) =>
                    swipe(
                      s,
                      <div
                        className="grid gap-1.5 border-b py-2.5 pl-[66px] pr-3"
                        style={{ borderColor: 'var(--m-line)' }}
                        data-open-shop-service-row-picked={s.key}
                      >
                        <div className="flex min-h-9 items-center text-[15px] font-medium" style={{ color: 'var(--m-ink)' }}>
                          <span className="min-w-0 [overflow-wrap:anywhere]">{s.label}</span>
                        </div>
                        {specialties[s.key]?.length ? (
                          <Specialties
                            service={s}
                            fields={specialties[s.key]!}
                            picks={picks}
                            onPicksChange={onPicksChange}
                            open={openSpecialty === s.key}
                            onOpen={onOpenSpecialty}
                            onRemove={onRemove}
                          />
                        ) : null}
                      </div>,
                    ),
                  )}
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
        <div className="os-rise grid gap-1.5" data-open-shop-add-picker="">
          {/* The picker's head (prototype v18 `.pkhead`): its label, and a grey ✕ Cancel pill — never a text link. */}
          <div
            className="sticky top-0 z-[3] flex items-center justify-between gap-3 py-1.5"
            style={{ background: 'var(--m-paper)' }}
          >
            <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              Another category
            </span>
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => onAddingChange(false)} />
          </div>
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
        </div>
      ) : null}


      <CoverageMeter list={list} />
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
export function Specialties({
  service,
  fields,
  picks,
  onPicksChange,
  open,
  onOpen,
  onRemove,
}: {
  service: PickedService;
  fields: SpecialtyField[];
  picks: SpecialtyPicks;
  onPicksChange: (next: SpecialtyPicks) => void;
  open: boolean;
  onOpen: (key: string | null) => void;
  /** v18 — "Remove also sits inside the open specialties" (the row's swipe is the other way). */
  onRemove: (key: string) => void;
}) {
  const mine = picks[service.key] ?? {};
  // The opened chips are revealed the house way (owner 2026-11-04, app-wide reveal-on-open): the head is this block.
  const headRef = useRef<HTMLDivElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: headRef.current }));
  const word = fields.every((f) => f.single) ? 'Specialty' : 'Specialties';
  const summary = fields.flatMap((f) =>
    (mine[f.key] ?? []).map((v) => f.options.find((o) => o.value === v)?.label ?? v),
  );
  const toggle = (f: SpecialtyField, value: string) => {
    const cur = mine[f.key] ?? [];
    const nextVals = cur.includes(value) ? cur.filter((v) => v !== value) : f.single ? [value] : [...cur, value];
    const nextMine = { ...mine, [f.key]: nextVals };
    if (!nextVals.length) delete nextMine[f.key];
    const next = { ...picks, [service.key]: nextMine };
    if (!Object.keys(nextMine).length) delete next[service.key];
    onPicksChange(next);
  };

  const openIt = () => {
    intend();
    onOpen(service.key);
  };

  // v18 / v19 — BUTTON_RULE: every action is a pill, icon + word, by meaning (grey to open/close, red Remove, green Done).
  if (!open) {
    return summary.length ? (
      <div className="-mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1" data-open-shop-specialties={service.key}>
        <span className="min-w-0 text-[13px] [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
          {summary.join(' · ')}
        </span>
        <ActionButton tone="neutral" icon={Plus} label="Add" name={`Add ${word.toLowerCase()} to ${service.label}`} onClick={openIt} aria-expanded={false} />
      </div>
    ) : (
      <div className="-mt-1" data-open-shop-specialties={service.key}>
        <ActionButton tone="neutral" icon={Plus} label={`${word} (optional)`} onClick={openIt} aria-expanded={false} />
      </div>
    );
  }
  return (
    <div ref={headRef} className="os-rise grid gap-2.5" data-open-shop-specialties={service.key} data-open="">
      <SpecialtiesBar word={word} service={service} onClose={() => onOpen(null)} onRemove={onRemove} />
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

/**
 * v19 — the opened specialties' own row (prototype `fvBlock` open): ⌃ Specialties (grey — closes) · Remove (red — takes
 * the service off, with Undo) · ✓ Done (green — closes the picker). ONE fit row (BUTTON_RULE 3a): when it does not fit,
 * every button drops its icon, then every secondary drops its word — together, never a mix. Its own component so
 * `useFitRow` mounts with the row.
 */
function SpecialtiesBar({
  word,
  service,
  onClose,
  onRemove,
}: {
  word: string;
  service: PickedService;
  onClose: () => void;
  onRemove: (key: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  useFitRow(row);
  return (
    <div ref={row} className="-mt-1 flex flex-nowrap items-center gap-2" data-open-shop-specialties-bar="">
      <ActionButton tone="neutral" icon={ChevronUp} label={word} name={`Close ${word.toLowerCase()}`} onClick={onClose} aria-expanded />
      <ActionButton tone="danger" icon={Trash2} label="Remove" name={`Remove ${service.label}`} onClick={() => onRemove(service.key)} />
      <ActionButton tone="ok" icon={Check} label="Done" onClick={onClose} />
    </div>
  );
}

/** The ⓘ "What each plan adds" — the ladder once, read from `TIER_CAPS` through `whatEachPlanHolds` (never typed). */
export function PlanTipBody() {
  const tip = whatEachPlanHolds();
  return (
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
}

/**
 * THE PLAN METER — "N categories · M services — ‹plan› covers this ⓘ", then the count per category. Every number is
 * counted from `list` or read from `TIER_CAPS` (`coverageLine`); none is typed. ⚠ A METER, NOT A GATE. Drawn by the
 * sign-up's cards and by the dashboard's Add a service (ruling 5820), so the two can never name two different plans.
 */
export function CoverageMeter({ list }: { list: readonly MeterService[] }) {
  const line = coverageLine(list);
  const tip = whatEachPlanHolds();
  const tipBody = <PlanTipBody />;
  // The coverage line — "N categories · M services — ‹plan› covers this ⓘ", then the count per category.
  return (
    <div className="relative grid gap-1 text-[13.5px]" style={{ color: 'var(--m-slate)' }} data-open-shop-coverage="">
      <span className="block">
        {/* v19 — the numbers count to their value (BUTTON_RULE rule 2; `Count` keys on its id, so a re-render never
            replays). The words are `line.tally`'s, pluralised by the same counts. */}
        <b className="font-semibold" style={{ color: 'var(--m-ink)' }} aria-label={line.tally}>
          <Count value={line.categories} id="open-shop-cov-c" /> {line.categories === 1 ? 'category' : 'categories'} ·{' '}
          <Count value={line.services} id="open-shop-cov-n" /> {line.services === 1 ? 'service' : 'services'}
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
  );
}
