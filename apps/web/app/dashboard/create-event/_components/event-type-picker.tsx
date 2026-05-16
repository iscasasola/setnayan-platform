'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { createWeddingEvent } from '../actions';

// V1 tile list (locked 2026-05-16). Only `wedding` is selectable per
// iteration 0000 § 2.5; the rest render as "Coming soon" placeholders so
// couples can see what is on the roadmap without being able to pick it yet.
const EVENT_TYPES = [
  { key: 'wedding', label: 'Wedding', emoji: '💍', enabled: true },
  { key: 'birthday', label: 'Birthday', emoji: '🎂', enabled: false },
  { key: 'celebration', label: 'Celebration', emoji: '🥂', enabled: false },
  { key: 'travel', label: 'Travel', emoji: '✈️', enabled: false },
  { key: 'corporate', label: 'Corporate', emoji: '🏢', enabled: false },
  { key: 'tournament', label: 'Tournament', emoji: '🏆', enabled: false },
  { key: 'christening', label: 'Christening', emoji: '🕯️', enabled: false },
] as const;

type EventTypeKey = (typeof EVENT_TYPES)[number]['key'];
type EventTypeRow = (typeof EVENT_TYPES)[number];

export function EventTypePicker() {
  const N = EVENT_TYPES.length;
  const [centerIdx, setCenterIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState<EventTypeKey | null>(null);

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
        <form action={createWeddingEvent} className="mt-10 space-y-5">
          <input type="hidden" name="event_type" value={selected.key} />

          <p className="rounded-md border border-ink/10 bg-cream px-4 py-2.5 text-sm text-ink/75">
            <span aria-hidden className="mr-2 text-base">
              {selected.emoji}
            </span>
            Planning a <strong className="font-semibold text-ink">{selected.label}</strong>.{' '}
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta hover:underline"
            >
              Change
            </button>
          </p>

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

          <div className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton
              className="button-primary w-full sm:w-auto"
              pendingLabel="Creating event…"
            >
              Create {selected.label.toLowerCase()} event
            </SubmitButton>
            <Link className="button-secondary w-full sm:w-auto" href="/dashboard">
              Cancel
            </Link>
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
