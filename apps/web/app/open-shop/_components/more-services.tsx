'use client';

import { useState } from 'react';
import { Check, Info, LockOpen, Plus } from 'lucide-react';

import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import {
  FIRST_BOOKING_FREE_LABEL,
  carriesFirstBookingLabel,
  coverageLine,
  whatEachPlanHolds,
  type MeterService,
} from '@/lib/open-shop-more-services';
import { ChosenServiceRow, ServicePicker, type PickerParentView } from './service-picker';
import { EventTiles, type EventTileOption } from './event-tiles';

/** A service added under the main. `events: null` = "Same events as ‹main›". */
export type AddedService = { key: string; label: string; events: string[] | null };

/** Where a leaf sits in the tree: its tier-2 category (the meter's unit) and its group (the chosen row's second line). */
export type LeafPlace = { categoryId: string; categoryLabel: string; groupId: string; groupLabel: string };

/** Leaf key → its place, built once from the picker's own tree. */
export function placeIndex(tree: readonly PickerParentView[]): Map<string, LeafPlace> {
  const out = new Map<string, LeafPlace>();
  for (const p of tree)
    for (const b of p.branches)
      for (const l of b.leaves)
        out.set(l.canonicalService, { categoryId: b.tileId, categoryLabel: b.label, groupId: p.folderId, groupLabel: p.label });
  return out;
}

/**
 * 🧺 THE SERVICES ADDED UNDER THE MAIN — one list with it, above "Events you serve" (owner 2026-11-06: *"can we put
 * them all together with main service? so we detect how many categories they have and services they have to know up
 * to which is covered by which plan. if they added a category, ask if you want to add more for this category? or add
 * a different category."*; prototype v8 `zExtras` / `coverLine` / `extraEvents`).
 *
 * Drawn under the main's chosen row:
 *   · each added service — the same chosen row (Remove), "Free until your first booking on Setnayan is done" ⓘ, and
 *     its own events: "✓ Same events as ‹main› · Change", Change → its own tiles, Select all · Clear · Done;
 *   · the coverage line — counted here, the plan read from `TIER_CAPS` (`lib/open-shop-more-services.ts`);
 *   · "More in ‹group›" (the picker opened inside that group) and "A different category" (all groups).
 *
 * ⚠ A METER, NOT A GATE: nothing here refuses a service for the plan — everything added stays on until the first
 * booking on Setnayan is done. The after-first-booking plan picker is the hold build's, not this component's.
 */
export function MoreServices({
  tree,
  places,
  mainKey,
  mainLabel,
  mainEvents,
  added,
  onAdded,
  eventOptions,
  refused,
}: {
  tree: PickerParentView[];
  places: Map<string, LeafPlace>;
  mainKey: string;
  mainLabel: string;
  mainEvents: string[];
  added: AddedService[];
  onAdded: (next: AddedService[]) => void;
  eventOptions: EventTileOption[];
  /** The step-2 refusal "Pick at least one event for each added service." is up — each empty one says its own. */
  refused: boolean;
}) {
  /** The picker is open: `''` = all groups ("A different category"), a folderId = "More in ‹group›". */
  const [adding, setAdding] = useState<string | null>(null);
  /** The added service whose own events are open. */
  const [eventsFor, setEventsFor] = useState<string | null>(null);

  const meterOf = (key: string): MeterService => {
    const p = places.get(key);
    // A key the tree no longer holds (a draft from an older build) still counts — as its own category.
    return { categoryId: p?.categoryId ?? key, categoryLabel: p?.categoryLabel ?? key };
  };
  const list = [mainKey, ...added.map((a) => a.key)].map(meterOf);
  const line = coverageLine(list);
  const labelled = carriesFirstBookingLabel(list);
  const tip = whatEachPlanHolds();
  const tipBody = (
    <span className="block space-y-1">
      <span className="block">{tip.plans}</span>
      <span className="block">{tip.after}</span>
      <b className="block">{tip.firstBooking}</b>
      <span className="block">{tip.fine}</span>
    </span>
  );

  const lastKey = added.length ? added[added.length - 1]!.key : mainKey;
  const lastGroup = places.get(lastKey) ?? null;
  const setOne = (key: string, events: string[] | null) =>
    onAdded(added.map((a) => (a.key === key ? { ...a, events } : a)));
  const link = 'text-xs font-medium text-terracotta disabled:opacity-40';

  return (
    <div className="space-y-2.5" data-open-shop-more-services="">
      {added.map((a) => {
        const own = a.events;
        const open = eventsFor === a.key;
        const sel = own ?? mainEvents;
        const empty = sel.length === 0;
        return (
          <div key={a.key} className="grid gap-2" data-open-shop-added-service={a.key}>
            <ChosenServiceRow
              label={a.label}
              subline={places.get(a.key)?.groupLabel ?? null}
              action="Remove"
              onAction={() => {
                onAdded(added.filter((x) => x.key !== a.key));
                if (open) setEventsFor(null);
              }}
            />
            {labelled ? (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }} data-open-shop-first-booking-label="">
                <LockOpen aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <InfoTip label={FIRST_BOOKING_FREE_LABEL} labelClassName="text-xs" ariaLabel={tip.title} align="start">
                  {tipBody}
                </InfoTip>
              </span>
            ) : null}
            {!own && !open ? (
              <span className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">Same events as {mainLabel}</span>
                </span>
                <button type="button" className={link} onClick={() => setEventsFor(a.key)}>
                  Change
                </button>
              </span>
            ) : (
              <>
                <span className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                  <span className="min-w-0">
                    Now: {formatCount(sel.length)} of {formatCount(eventOptions.length)} events for {a.label}
                  </span>
                  {open ? (
                    <span className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        className={link}
                        disabled={eventOptions.every((e) => sel.includes(e.key))}
                        onClick={() => setOne(a.key, eventOptions.map((e) => e.key))}
                      >
                        Select all
                      </button>
                      <button type="button" className={link} disabled={empty} onClick={() => setOne(a.key, [])}>
                        Clear
                      </button>
                      <button type="button" className={link} onClick={() => setEventsFor(null)}>
                        Done
                      </button>
                    </span>
                  ) : (
                    <button type="button" className={link} onClick={() => setEventsFor(a.key)}>
                      Change
                    </button>
                  )}
                </span>
                {open ? (
                  <>
                    <EventTiles
                      options={eventOptions}
                      value={sel}
                      onToggle={(k) => setOne(a.key, sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k])}
                    />
                    <button
                      type="button"
                      className={`${link} justify-self-start`}
                      onClick={() => {
                        setOne(a.key, null);
                        setEventsFor(null);
                      }}
                    >
                      Use the same events as {mainLabel}
                    </button>
                  </>
                ) : null}
              </>
            )}
            {refused && empty ? (
              <span
                className="flex items-start gap-1.5 text-xs"
                style={{ color: 'var(--m-mulberry-deep)' }}
                role="alert"
                data-open-shop-field-error="extras"
              >
                <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span>Pick at least one event for {a.label}.</span>
              </span>
            ) : null}
          </div>
        );
      })}

      {/* The coverage line — "N categories · M services — ‹plan› covers this", then the count per category. */}
      {/* `relative` here + `!static` on the tip: "What each plan holds" hangs from the LINE's left edge, under it, as
          the prototype draws it — hung from the verdict, which sits mid-line on a phone, the closed (laid-out) bubble
          widened the page past 390. */}
      <div className="relative grid gap-1 text-[13.5px]" style={{ color: 'var(--m-slate)' }} data-open-shop-coverage="">
        {/* One sentence that wraps as text (the prototype's), the ⓘ at its end. */}
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

      {adding === null ? (
        <div className="flex flex-wrap gap-2" data-open-shop-add-two="">
          {lastGroup ? (
            <button
              type="button"
              onClick={() => {
                setAdding(lastGroup.groupId);
                setEventsFor(null);
              }}
              className="inline-flex min-h-11 flex-auto items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium"
              style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              More in {lastGroup.groupLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setAdding('');
              setEventsFor(null);
            }}
            className="inline-flex min-h-11 flex-auto items-center justify-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />A different category
          </button>
        </div>
      ) : (
        <div className="space-y-1.5" data-open-shop-add-picker="">
          <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            {adding ? `More in ${tree.find((p) => p.folderId === adding)?.label ?? ''}` : 'Another category'}
          </span>
          <ServicePicker
            key={adding || 'all'}
            tree={tree}
            value=""
            labelForValue={null}
            startParent={adding || null}
            onPick={(leaf) => {
              if (leaf && leaf.canonicalService !== mainKey && !added.some((x) => x.key === leaf.canonicalService))
                onAdded([...added, { key: leaf.canonicalService, label: leaf.label, events: null }]);
              setAdding(null);
            }}
          />
          <button type="button" className={link} onClick={() => setAdding(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
