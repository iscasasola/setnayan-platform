'use client';

import { useState } from 'react';
import {
  CeremonyTypeRadioGroup,
  type CeremonyTypeKey,
} from '@/app/_components/ceremony-type-radio-group';
import { notifyWhenWeddingTypeLaunches } from '../actions';

// Iteration 0043 + Task #44 (2026-05-22) — wedding-type picker. Renders inline
// inside the create-event form. Persisted columns: ceremony_type,
// venue_setting, ceremony_sub_type, is_mixed_ceremony, secondary_ceremony_type.
//
// Task #44 lock: ceremony_type is now a REQUIRED field with NO silent default.
// New events MUST land with ceremony_type SET — the previous behavior (silent
// 'catholic' default if the host never touched the picker) caused new events
// to land on the dashboard with foundation unset and forced the host to fix
// it via the chip CTA afterward.
//
// V1.1 active faiths: catholic + civil. The other four render as Coming Soon
// radios with an inline email-capture that writes to
// couple_wedding_type_notify_signups (drives vendor-recruitment priority).
// Status is fetched server-side and passed in as `launchStatus`.

export type CeremonyType = CeremonyTypeKey;
export type VenueSetting =
  | 'banquet_hall'
  | 'garden'
  | 'beach'
  | 'destination'
  | 'heritage'
  | 'outdoor_tent'
  | 'civil_registrar';

export type LaunchStatusRow = {
  ceremony_type: Exclude<CeremonyType, 'mixed'>;
  status: 'active' | 'coming_soon' | 'disabled';
};

type VenueCard = {
  key: VenueSetting;
  label: string;
  icon: string;
  description: string;
};

const VENUES: VenueCard[] = [
  { key: 'banquet_hall',    label: 'Banquet Hall',    icon: '🍽️', description: 'Standard utilities, indoor reception' },
  { key: 'garden',          label: 'Garden',          icon: '🌿',  description: 'Generator + tent backup recommended' },
  { key: 'beach',           label: 'Beach',           icon: '🌊',  description: 'Sand-friendly decor, salt-air protection' },
  { key: 'destination',     label: 'Destination',     icon: '✈️',  description: 'Travel coordination + multi-day logistics' },
  { key: 'heritage',        label: 'Heritage',        icon: '🏛️',  description: 'Restoration-aware decor, capacity limits' },
  { key: 'outdoor_tent',    label: 'Outdoor Tent',    icon: '⛺',  description: 'Tent + generator + flooring rental' },
  { key: 'civil_registrar', label: 'Civil Registrar', icon: '📜',  description: 'Compact City Hall ceremony' },
];

const MUSLIM_SUB_TYPES = [
  { key: 'maranao',          label: 'Maranao' },
  { key: 'tausug',           label: 'Tausug' },
  { key: 'maguindanao',      label: 'Maguindanao' },
  { key: 'sama_bajau',       label: 'Sama-Bajau' },
  { key: 'yakan',            label: 'Yakan' },
  { key: 'general_muslim',   label: 'General Muslim' },
];

const CULTURAL_SUB_TYPES = [
  { key: 'igorot_cordillera', label: 'Igorot · Cordillera' },
  { key: 'manobo',            label: 'Manobo' },
  { key: 'visayan_folk',      label: 'Visayan folk' },
  { key: 'tagalog_folk',      label: 'Tagalog folk' },
  { key: 'kapampangan_folk',  label: 'Kapampangan folk' },
  { key: 'other',             label: 'Other tradition' },
];

const SECONDARY_LABELS: Record<Exclude<CeremonyType, 'mixed'>, string> = {
  catholic: 'Catholic',
  muslim: 'Muslim',
  inc: 'INC',
  chinese: 'Chinese',
  born_again: 'Born Again',
  christian: 'Christian',
  cultural: 'Cultural',
  jewish: 'Jewish',
  aglipayan: 'Aglipayan (IFI)',
  lds: 'LDS (Latter-day Saints)',
  sda: 'Seventh-day Adventist',
  jw: "Jehovah's Witnesses",
  hindu: 'Hindu',
  sikh: 'Sikh',
  buddhist: 'Buddhist',
  orthodox: 'Orthodox Christian',
  civil: 'Civil',
};

type Props = {
  launchStatus: LaunchStatusRow[];
  /** Called when the host selects a ceremony so the parent can enable Save. */
  onCeremonyChange?: (ceremony: CeremonyType | null) => void;
};

export function WeddingTypePicker({ launchStatus, onCeremonyChange }: Props) {
  // Task #44 — no silent default. `ceremony` starts as null so the parent
  // form can gate Save behind an affirmative pick.
  const [ceremony, setCeremony] = useState<CeremonyType | null>(null);
  const [venue, setVenue] = useState<VenueSetting>('banquet_hall');
  const [subType, setSubType] = useState<string>('');
  const [secondary, setSecondary] = useState<Exclude<CeremonyType, 'mixed'> | ''>('');
  const [notifyOpenFor, setNotifyOpenFor] = useState<Exclude<CeremonyType, 'mixed'> | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyState, setNotifyState] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');

  // Active faiths in this region. Mixed is always available (it pairs two
  // already-active faiths). Coming-soon options stay visible but block
  // selection — picking one opens the notify-me capture instead.
  const activeMap = new Map<string, boolean>(
    launchStatus.map((row) => [row.ceremony_type, row.status === 'active']),
  );
  const isCeremonyActive = (key: CeremonyType) =>
    key === 'mixed' ? true : (activeMap.get(key) ?? false);

  function handleCeremonyChange(key: CeremonyType) {
    if (!isCeremonyActive(key)) {
      // Coming-soon → open notify-capture beneath the group.
      setNotifyOpenFor(key as Exclude<CeremonyType, 'mixed'>);
      setNotifyState('idle');
      return;
    }
    setCeremony(key);
    setNotifyOpenFor(null);
    // Clear conditional fields that no longer apply.
    if (key !== 'muslim' && key !== 'cultural') setSubType('');
    if (key !== 'mixed') setSecondary('');
    onCeremonyChange?.(key);
  }

  async function submitNotify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!notifyOpenFor || !notifyEmail.trim()) return;
    setNotifyState('submitting');
    try {
      const fd = new FormData();
      fd.set('email', notifyEmail.trim());
      fd.set('ceremony_type_interested', notifyOpenFor);
      const res = await notifyWhenWeddingTypeLaunches(fd);
      setNotifyState(res.ok ? 'sent' : 'error');
    } catch {
      setNotifyState('error');
    }
  }

  const subTypeOptions =
    ceremony === 'muslim' ? MUSLIM_SUB_TYPES :
    ceremony === 'cultural' ? CULTURAL_SUB_TYPES :
    null;

  return (
    <section
      aria-labelledby="wedding-type-heading"
      className="space-y-6 rounded-2xl border border-ink/10 bg-cream/40 p-4 sm:p-5"
    >
      {/* Hidden inputs read by the createWeddingEvent action. Note:
          ceremony_type is intentionally absent from the radio name attribute
          coming from CeremonyTypeRadioGroup — the radio handles the visual
          state, this hidden input is what FormData submits to the server. */}
      <input type="hidden" name="ceremony_type" value={ceremony ?? ''} />
      <input type="hidden" name="venue_setting" value={venue} />
      <input type="hidden" name="ceremony_sub_type" value={subType} />
      <input type="hidden" name="is_mixed_ceremony" value={ceremony === 'mixed' ? 'true' : 'false'} />
      <input type="hidden" name="secondary_ceremony_type" value={secondary} />

      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Step 2 of 2
        </p>
        <h2
          id="wedding-type-heading"
          className="text-base font-semibold tracking-tight text-ink sm:text-lg"
        >
          Wedding type <span className="text-terracotta">*</span>
        </h2>
        <p className="text-xs text-ink/55">
          Drives which vendors, copy, and timelines we surface for you. Pick the
          ceremony that matches your plans.
        </p>
      </header>

      {/* Axis A — Ceremony (shared radio group, Task #44 / 2026-05-22). The
          notify-me capture only opens when the host taps a Coming Soon option;
          the active ones flow into `handleCeremonyChange` and bubble up to the
          parent form so it can enable Save. */}
      <CeremonyTypeRadioGroup
        value={ceremony}
        onChange={handleCeremonyChange}
        name="ceremony_type_radio"
        legend="Wedding type"
        isOptionDisabled={(key) => !isCeremonyActive(key)}
        renderOptionBadge={(key) =>
          !isCeremonyActive(key) ? (
            <span className="rounded-full bg-ink/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink/60">
              Coming soon
            </span>
          ) : null
        }
      />

      {/* Notify-me capture, appears under ceremony radios when a coming-soon
          option is tapped. */}
      {notifyOpenFor ? (
        <div className="rounded-lg border border-terracotta/20 bg-terracotta/[0.04] p-3">
          <p className="mb-2 text-sm text-ink">
            <strong className="font-semibold">{SECONDARY_LABELS[notifyOpenFor]}</strong>{' '}
            weddings are coming soon. Want a heads-up when we launch support?
          </p>
          {notifyState === 'sent' ? (
            <p className="text-xs text-ink/65">
              Got it — we&apos;ll email you when {SECONDARY_LABELS[notifyOpenFor]} support is ready.
            </p>
          ) : (
            <form onSubmit={submitNotify} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                className="input-field flex-1"
              />
              <button
                type="submit"
                disabled={notifyState === 'submitting'}
                className="button-secondary whitespace-nowrap"
              >
                {notifyState === 'submitting' ? 'Submitting…' : 'Notify me'}
              </button>
            </form>
          )}
          {notifyState === 'error' ? (
            <p className="mt-2 text-[11px] text-terracotta-700">
              Couldn&apos;t save that — try again or skip for now.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setNotifyOpenFor(null)}
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 hover:text-terracotta"
          >
            Close
          </button>
        </div>
      ) : null}

      {/* Conditional — sub-type for Muslim / Cultural */}
      {subTypeOptions ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Tradition
          </p>
          <div className="flex flex-wrap gap-2">
            {subTypeOptions.map((s) => {
              const selected = subType === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSubType(s.key)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                    selected
                      ? 'border-terracotta bg-terracotta/[0.08] text-terracotta-700'
                      : 'border-ink/15 bg-cream text-ink/75 hover:border-terracotta/40'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Conditional — secondary ceremony for Mixed */}
      {ceremony === 'mixed' ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Secondary ceremony
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(SECONDARY_LABELS) as Array<Exclude<CeremonyType, 'mixed'>>).map((key) => {
              const active = isCeremonyActive(key);
              const selected = secondary === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => active && setSecondary(key)}
                  disabled={!active}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    selected
                      ? 'border-terracotta bg-terracotta/[0.07] ring-2 ring-terracotta/30'
                      : active
                        ? 'border-ink/15 bg-cream hover:border-terracotta/40'
                        : 'border-ink/10 bg-ink/[0.03] opacity-60'
                  }`}
                >
                  <span>{SECONDARY_LABELS[key]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Axis B — Venue */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Venue setting
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VENUES.map((v) => {
            const selected = venue === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setVenue(v.key)}
                aria-pressed={selected}
                title={v.description}
                className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all ${
                  selected
                    ? 'border-terracotta bg-terracotta/[0.07] ring-2 ring-terracotta/30'
                    : 'border-ink/15 bg-cream hover:border-terracotta/40 hover:bg-terracotta/[0.04]'
                }`}
              >
                <span aria-hidden className="text-xl">{v.icon}</span>
                <span className="text-sm font-medium text-ink">{v.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink/50">{
          VENUES.find((v) => v.key === venue)?.description ?? ''
        }</p>
      </div>
    </section>
  );
}
