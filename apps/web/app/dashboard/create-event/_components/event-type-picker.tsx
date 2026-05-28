'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import type { CeremonyTypeKey } from '@/app/_components/ceremony-type-radio-group';
import { createWeddingEvent } from '../actions';
import { WeddingTypePicker, type LaunchStatusRow } from './wedding-type-picker';

/* Retired 2026-05-28 V2 cutover */
// V1 surfaced a DIY / Concierge ₱2,499 / 3-day-trial choice card at the
// end of create-event. V2 retires the trial mechanic entirely and prices
// Today's Focus separately in platform_retail_catalog_v2 (purchased
// post-event-creation from /pricing). Every new event lands in DIY by
// default; hosts upgrade later from the dashboard if they want the
// daily planner. The ConciergeChoice type + hidden form field are kept
// for cutover-period continuity with the server action signature; the
// value is always 'diy' from this surface.
type ConciergeChoice = 'diy';

// V1 tile list (locked 2026-05-16, debut enabled 2026-05-20). The V1.1
// multi-event roster (iteration 0041) is growing one event_type at a
// time; the rest render as "Coming soon" placeholders so couples can see
// what is on the roadmap without being able to pick it yet.
//
// gender_reveal was briefly enabled on 2026-05-20 (PR #177) then reverted
// to "Coming soon" the same day per owner decision. The enum value stays
// in the DB (migration 20260521050000) — it's idempotent and harmless
// when unused; re-enabling later is a one-line flip of `enabled` here +
// ALLOWED_TYPES in actions.ts.
const EVENT_TYPES = [
  { key: 'wedding', label: 'Wedding', emoji: '💍', enabled: true },
  { key: 'debut', label: 'Debut', emoji: '👑', enabled: true },
  { key: 'gender_reveal', label: 'Gender Reveal', emoji: '🎈', enabled: false },
  { key: 'birthday', label: 'Birthday', emoji: '🎂', enabled: false },
  { key: 'celebration', label: 'Celebration', emoji: '🥂', enabled: false },
  { key: 'travel', label: 'Travel', emoji: '✈️', enabled: false },
  { key: 'corporate', label: 'Corporate', emoji: '🏢', enabled: false },
  { key: 'tournament', label: 'Tournament', emoji: '🏆', enabled: false },
  { key: 'christening', label: 'Christening', emoji: '🕯️', enabled: false },
] as const;

type EventTypeKey = (typeof EVENT_TYPES)[number]['key'];
type EventTypeRow = (typeof EVENT_TYPES)[number];

type EventTypePickerProps = {
  launchStatus: LaunchStatusRow[];
  /* Retired 2026-05-28 V2 cutover */
  // V1 gated the Concierge choice card with `conciergeEnabled`. V2 has
  // no choice card on create-event so the prop is unused; kept on the
  // type signature for cutover-period import-source continuity with
  // create-event/page.tsx.
  conciergeEnabled?: boolean;
};

export function EventTypePicker({ launchStatus }: EventTypePickerProps) {
  const N = EVENT_TYPES.length;
  const [centerIdx, setCenterIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState<EventTypeKey | null>(null);
  // ConciergeChoice locked to 'diy' on every new event in V2 — hosts
  // upgrade to Today's Focus from the dashboard post-creation.
  const conciergeChoice: ConciergeChoice = 'diy';
  // Task #44 (2026-05-22) — track the ceremony pick so the Save button stays
  // disabled until the host explicitly chooses one. Non-wedding event_types
  // don't render the picker and are allowed to submit without it.
  const [ceremonyType, setCeremonyType] = useState<CeremonyTypeKey | null>(null);

  // Modulo helper that keeps the index positive when going backwards — this
  // is what gives the carousel its "infinite" feel: rewinding from index 0
  // wraps to the last tile, advancing past the last tile wraps back to 0.
  // The math always lands in [0, N-1], so the lookup is non-null by
  // construction — the `!` assertion is what tells TS (under
  // noUncheckedIndexedAccess) that the result can't be undefined.
  const at = (i: number): EventTypeRow => EVENT_TYPES[((i % N) + N) % N]!;

  const goPrev = () => setCenterIdx((i) => (i - 1 + N) % N);
  const goNext = () => setCenterIdx((i) => (i + 1) % N);

  const tilePrev = at(centerIdx - 1);
  const tileCenter = at(centerIdx);
  const tileNext = at(centerIdx + 1);

  const selected = selectedKey
    ? (EVENT_TYPES.find((t) => t.key === selectedKey) ?? null)
    : null;

  function handleSelect(type: EventTypeRow) {
    if (!type.enabled) return;
    setSelectedKey(type.key);
  }

  return (
    <>
      <section aria-label="Event type" className="space-y-4">
        <div className="flex items-stretch gap-2 sm:gap-3">
          <ArrowButton dir="prev" onClick={goPrev} />

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              type={tilePrev}
              isActive={false}
              isSelected={selectedKey === tilePrev.key}
              onSelect={handleSelect}
              className="hidden sm:flex"
            />
            <Tile
              type={tileCenter}
              isActive
              isSelected={selectedKey === tileCenter.key}
              onSelect={handleSelect}
            />
            <Tile
              type={tileNext}
              isActive={false}
              isSelected={selectedKey === tileNext.key}
              onSelect={handleSelect}
              className="hidden sm:flex"
            />
          </div>

          <ArrowButton dir="next" onClick={goNext} />
        </div>

        <div
          role="tablist"
          aria-label="Event type pages"
          className="flex justify-center gap-2"
        >
          {EVENT_TYPES.map((t, i) => {
            const active = i === centerIdx;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Show ${t.label}`}
                onClick={() => setCenterIdx(i)}
                className={`h-2 rounded-full transition-all ${
                  active ? 'w-6 bg-terracotta' : 'w-2 bg-ink/20 hover:bg-ink/40'
                }`}
              />
            );
          })}
        </div>
      </section>

      {selected ? (
        <form action={createWeddingEvent} className="mt-10 space-y-6">
          <input type="hidden" name="event_type" value={selected.key} />
          <input type="hidden" name="concierge_choice" value={conciergeChoice} />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="display_name">
              Event name <span className="text-terracotta">*</span>
            </label>
            <input
              autoComplete="off"
              autoFocus
              className="input-field"
              id="display_name"
              name="display_name"
              placeholder="Maria &amp; Juan"
              required
              type="text"
            />
            <p className="text-xs text-ink/50">
              Usually both names. Date and venue are added later from event settings.
            </p>
          </div>

          {/* Iteration 0043 + Task #44 — two-axis wedding-type picker. Hidden
              inputs feed createWeddingEvent which reads ceremony_type /
              venue_setting / sub-type / mixed columns. For wedding events
              ceremony_type is a REQUIRED field per Task #44 — the parent
              gates Save behind an affirmative pick. Non-wedding event_types
              (debut, etc. per iteration 0041) skip the picker entirely and
              store NULL on the wedding-specific columns. */}
          {selected.key === 'wedding' ? (
            <WeddingTypePicker
              launchStatus={launchStatus}
              onCeremonyChange={setCeremonyType}
            />
          ) : null}

          {/* Retired 2026-05-28 V2 cutover — Concierge choice card removed.
              V1 surfaced DIY / Concierge ₱2,499 / 3-day-trial here; V2 has no
              trial mechanic and prices Today's Focus separately on /pricing.
              Every new event lands in DIY by default. */}

          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <SubmitButton
                className="button-primary w-full sm:w-auto"
                pendingLabel="Creating event…"
                disabled={selected.key === 'wedding' && !ceremonyType}
              >
                Create {selected.label.toLowerCase()} event
              </SubmitButton>
              <Link className="button-secondary w-full sm:w-auto" href="/dashboard">
                Cancel
              </Link>
            </div>
            {/* Task #44 — surface why Save is disabled. Editorial copy per
                [[feedback_setnayan_no_dev_text_post_launch]] — no marketing
                jargon, no exclamation, matter-of-fact about what's missing. */}
            {selected.key === 'wedding' && !ceremonyType ? (
              <p className="text-xs text-ink/55">
                Pick a wedding type so we can match vendors compatible with your ceremony.
              </p>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mt-10 rounded-md border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/55">
          Pick an event type above to name it.
        </p>
      )}
    </>
  );
}

/* Retired 2026-05-28 V2 cutover · ConciergeChoiceCard component deleted.
   V1 surfaced a DIY / Concierge ₱2,499 / 3-day-trial picker at the
   bottom of create-event. V2 has no trial mechanic and prices Today's
   Focus separately on /pricing. Every new event lands in DIY by default;
   hosts upgrade later from the dashboard if they want the daily planner. */

function Tile({
  type,
  isActive,
  isSelected,
  onSelect,
  className,
}: {
  type: EventTypeRow;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (type: EventTypeRow) => void;
  className?: string;
}) {
  const base =
    'relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all';

  const state = type.enabled
    ? isSelected
      ? 'border-terracotta bg-terracotta/5 ring-2 ring-terracotta/30'
      : 'border-ink/15 bg-cream hover:border-terracotta/50 hover:bg-terracotta/[0.04]'
    : 'cursor-not-allowed border-ink/10 bg-ink/[0.03] opacity-60';

  const emphasis = isActive ? '' : 'sm:scale-[0.92] sm:opacity-70';

  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      disabled={!type.enabled}
      aria-pressed={isSelected}
      aria-disabled={!type.enabled}
      className={`${base} ${state} ${emphasis} ${className ?? ''}`.trim()}
    >
      <span aria-hidden className="text-2xl">
        {type.emoji}
      </span>
      <span className="text-base font-medium text-ink">{type.label}</span>
      {!type.enabled ? (
        <span className="absolute right-3 top-3 rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
          Coming soon
        </span>
      ) : (
        <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
          V1
        </span>
      )}
    </button>
  );
}

function ArrowButton({
  dir,
  onClick,
}: {
  dir: 'prev' | 'next';
  onClick: () => void;
}) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'prev' ? 'Previous event type' : 'Next event type'}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border border-ink/15 bg-cream text-ink/70 transition-colors hover:border-terracotta/40 hover:bg-terracotta/10 hover:text-terracotta"
    >
      <Icon aria-hidden className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}
