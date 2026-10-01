'use client';

/**
 * wedding-venues.tsx — "We already have our venue" on the wedding's Area card (Lane 2).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "WE ALREADY HAVE OUR VENUE / PICKING A VENUE IN
 * ONBOARDING = A LIST OF WHAT IS FREE ON THEIR DATES — AND PARISH ↔ RECEPTION
 * CHAIN", "A COUPLE WHO ALREADY HAS A VENUE IS NOT ASKED THE AREA", "THE EVENT HUB
 * FOLLOWS THE LOCKED VENUES"):
 *   · Parish ▾ and Reception ▾ each list the suppliers NOT MARKED BUSY on at least one
 *     of the couple's candidate dates, each row saying which; pick one and the dates
 *     narrow to the ones it is free on; the other list is then ordered NEAREST FIRST
 *     with its distance — in KILOMETRES, never a drive time (owner: "don't guess a
 *     number"), with the rest behind "Show farther options ›";
 *   · a venue picked from the list is SHORTLISTED — the lock stays a Your Team action;
 *   · "Add it yourself" (name · pin · city) is the couple's own venue, locked at once,
 *     no contact asked (Your Team shows "Add contact" later);
 *   · "I'll pick later" · "My supplier will fill this in" write nothing.
 *
 * The rules live in `lib/onboarding/venue-chain.ts` and `venue-picks.ts` (pure,
 * tested); this file draws them. Server reads go through the wedding's existing
 * `searchOnboardingReceptionVenues` — extended, never a second search.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { BranchPinMap } from '@/app/vendor-dashboard/_components/branch-pin-map';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ceremonyChoiceOf } from '@/lib/onboarding/wedding-cards';
import {
  VENUES_FIRST_PAGE,
  chainedList,
  freeStrip,
  narrowDates,
  searchByName,
  type Anchor,
  type VenueCandidate,
  type VenueRow,
} from '@/lib/onboarding/venue-chain';
import {
  OWN_VENUE_NAME_MAX,
  cleanPin,
  narrowedByVenues,
  type VenuePick,
  type VenueRole,
} from '@/lib/onboarding/venue-picks';
import { CITIES, TOP30, cityByKey, kmBetween, resolvePick } from '../_data/wedding-cities';
import type { searchOnboardingReceptionVenues } from '../actions';
import type { OnboardingState } from '../types';


type Patch = (p: Partial<OnboardingState>) => void;
/** The wedding's own venue search (`searchOnboardingReceptionVenues`), handed in by the shell. */
export type VenueSearch = typeof searchOnboardingReceptionVenues;

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The curated city nearest a pin — a picked venue gives the couple's area (ask once). */
export function nearestCityKey(lat: number, lng: number): string | null {
  let best: { k: string; d: number } | null = null;
  for (const c of CITIES) {
    const d = kmBetween({ lat, lon: lng }, { lat: c.lat, lon: c.lon });
    if (!best || d < best.d) best = { k: c.k, d };
  }
  return best?.k ?? null;
}

const ROLE_COPY: Record<VenueRole, { search: string; pick: string }> = {
  parish: { search: 'Search by name', pick: 'Pick a parish' },
  reception: { search: 'Search by name', pick: 'Pick a reception' },
};

/** "Parish" for a church wedding, "Mosque" for a nikah, else the plain "Ceremony venue". */
export function ceremonyVenueWord(s: Pick<OnboardingState, 'kind' | 'faith' | 'ceremonyUndecided'>): string {
  const c = ceremonyChoiceOf(s);
  if (c === 'church') return 'Parish';
  if (c === 'nikah') return 'Mosque';
  return 'Ceremony venue';
}

function pickPin(p: VenuePick | null): Anchor | null {
  if (!p || (p.kind !== 'listed' && p.kind !== 'own')) return null;
  const pin = cleanPin(p.lat, p.lng);
  return pin ? { lat: pin.lat, lng: pin.lng } : null;
}

export function WeddingVenues({ state, patch, search }: { state: OnboardingState; patch: Patch; search: VenueSearch }) {
  const { venues } = state;
  const dates = useMemo(() => (state.dateMode === 'specific' ? state.dateCandidates.filter(Boolean) : []), [state.dateMode, state.dateCandidates]);

  const setPick = (role: VenueRole, pick: VenuePick | null, extra: Partial<OnboardingState> = {}) =>
    patch({ venues: { ...venues, [role]: pick }, ...extra });

  return (
    <div className="mt-4 flex flex-col gap-6" data-wedding-venues>
      <p className="text-xs text-ink/55">
        {dates.length > 0
          ? `Your dates: ${list(dates.map(dayLabel))}. A venue is shortlisted when you pick it; you lock it from Your Team. Pick either first — the other list narrows to what is free and near.`
          : 'A venue is shortlisted when you pick it; you lock it from Your Team. Pick either first — the other list narrows to what is near.'}
      </p>
      {(['parish', 'reception'] as const).map((role) => (
        <VenueRoleRow
          key={role}
          role={role}
          label={role === 'parish' ? ceremonyVenueWord(state) : 'Reception'}
          state={state}
          dates={dates}
          search={search}
          setPick={(pick, extra) => setPick(role, pick, extra)}
        />
      ))}
    </div>
  );
}

function VenueRoleRow({
  role,
  label,
  state,
  dates,
  search,
  setPick,
}: {
  role: VenueRole;
  label: string;
  state: OnboardingState;
  dates: string[];
  search: VenueSearch;
  setPick: (pick: VenuePick | null, extra?: Partial<OnboardingState>) => void;
}) {
  const other: VenueRole = role === 'parish' ? 'reception' : 'parish';
  const pick = state.venues[role];
  const otherPick = state.venues[other];

  // THE CHAIN: the other venue narrows the dates this list is filtered on, and orders it by distance.
  const dateScope = useMemo(
    () => (otherPick?.kind === 'listed' ? narrowDates(dates, otherPick) : dates),
    [dates, otherPick],
  );
  const anchor = pickPin(otherPick);

  const [query, setQuery] = useState('');
  const [all, setAll] = useState<VenueCandidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [farther, setFarther] = useState(false);
  const seq = useRef(0);

  // One read per (role, search, dates, area, ceremony) — debounced for typing; the date list is not
  // re-fetched when the OTHER pick narrows it (freeDates arrive for ALL the candidate dates).
  const datesKey = dates.join(',');
  useEffect(() => {
    const mine = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const rows = await search({
          role,
          kind: state.kind,
          faith: state.faith,
          receptionSettings: [],
          region: state.region,
          pax: state.pax,
          dateCandidates: dates,
          searchQuery: query.trim() || undefined,
        });
        if (mine !== seq.current) return;
        setAll(
          rows.map((r) => ({
            vendorId: r.vendorId,
            name: r.name,
            city: r.city,
            photoUrl: r.photoUrl,
            verified: r.verified,
            lat: r.lat,
            lng: r.lng,
            freeDates: r.freeDates,
          })),
        );
        setFailed(false);
      } catch {
        if (mine !== seq.current) return;
        // A failed read is NOT an empty list: say so, never "no venues".
        setFailed(true);
        setAll([]);
      }
    }, query ? 300 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, query, datesKey, state.region, state.kind, state.faith.join(','), state.pax, search]);

  const rows: VenueRow[] = useMemo(
    () => chainedList({ all: all ?? [], dates: dateScope, anchor }),
    [all, dateScope, anchor],
  );
  const shown = farther ? rows : rows.slice(0, VENUES_FIRST_PAGE);
  const listedKey = pick?.kind === 'listed' ? `v:${pick.vendorId}` : null;
  // The picked row may be beyond the first page or filtered by a later search; keep it selectable.
  const selected = pick?.kind === 'listed' ? pick : null;

  const optionFor = (r: VenueRow) => {
    const strip = dates.length > 0 ? freeStrip(dates, r).map((s) => `${dayLabel(s.date)} ${s.free ? '✓' : '—'}`).join(' · ') : '';
    const parts = [r.city, strip, r.km != null ? `${r.km} km${anchor ? ` from the ${role === 'parish' ? 'reception' : 'parish'}` : ''}` : null].filter(Boolean);
    return { key: `v:${r.vendorId}`, label: r.name, hint: parts.join(' · '), group: dates.length > 0 ? 'Not booked on your dates' : undefined };
  };
  const options = [
    ...shown.map(optionFor),
    ...(selected && !shown.some((r) => r.vendorId === selected.vendorId)
      ? [{ key: `v:${selected.vendorId}`, label: selected.name, hint: selected.city ?? undefined, group: undefined as string | undefined }]
      : []),
    { key: 'own', label: 'Add it yourself', hint: 'Name · pin · city — it is locked as your venue', group: 'Or' },
    { key: 'later', label: 'I’ll pick later', group: 'Or' },
    { key: 'supplier', label: 'My supplier will fill this in', group: 'Or' },
  ];

  const value =
    pick?.kind === 'listed' ? listedKey : pick?.kind === 'own' ? 'own' : pick?.kind === 'later' ? 'later' : pick?.kind === 'supplier' ? 'supplier' : null;

  function onPick(key: string) {
    if (key === 'own') return setPick({ kind: 'own', name: '', city: '', lat: null, lng: null });
    if (key === 'later') return setPick({ kind: 'later' });
    if (key === 'supplier') return setPick({ kind: 'supplier' });
    const r = all?.find((x) => `v:${x.vendorId}` === key);
    if (!r) return;
    // Ask once: a pick with a pin gives the area (the nearest curated city) when none is known yet.
    const pin = cleanPin(r.lat, r.lng);
    const place = state.places.length === 0 && pin ? nearestCityKey(pin.lat, pin.lng) : null;
    setPick(
      { kind: 'listed', vendorId: r.vendorId, name: r.name, city: r.city, lat: pin?.lat ?? null, lng: pin?.lng ?? null, freeDates: [...r.freeDates] },
      place ? { places: [place], region: resolvePick(place).rk } : {},
    );
  }

  const narrowedNote = (() => {
    if (pick?.kind !== 'listed' || dates.length === 0) return null;
    const kept = narrowedByVenues(dates, { ...state.venues, [role]: pick, [other]: role === 'parish' ? state.venues.reception : state.venues.parish });
    return kept.length < dates.length ? `Your dates narrow to ${list(kept.map(dayLabel))} — not booked at ${pick.name}.` : `Your dates stay ${list(dates.map(dayLabel))} — not booked at ${pick.name}.`;
  })();

  return (
    <div data-venue-role={role}>
      <p className="mb-2 text-sm font-medium text-ink/75">{label}</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`${ROLE_COPY[role].search}`}
        aria-label={`Search a ${label.toLowerCase()} by name`}
        className="mb-2 w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-base text-ink outline-none"
      />
      <PickMenu
        label={label}
        value={value}
        buttonText={value ? undefined : ROLE_COPY[role].pick}
        options={options}
        onPick={onPick}
        dataAttr={`data-venue-${role}`}
      />
      {all === null ? <p className="mt-2 text-xs text-ink/50">Looking…</p> : null}
      {failed ? <p className="mt-2 text-xs text-ink/60">We couldn’t load the list just now. You can still add it yourself or pick later.</p> : null}
      {all !== null && !failed && rows.length === 0 ? (
        <p className="mt-2 text-xs text-ink/55">Nothing listed for these dates{query ? ' and that name' : ''} yet. Add it yourself, or pick later.</p>
      ) : null}
      {rows.length > VENUES_FIRST_PAGE ? (
        <button type="button" className="mt-2 text-sm text-ink/60 underline" onClick={() => setFarther((v) => !v)}>
          {farther ? 'Show fewer' : 'Show farther options ›'}
        </button>
      ) : null}
      {pick?.kind === 'listed' ? (
        <p className="mt-2 text-xs text-ink/55">On your shortlist. You lock it from Your Team, and it shows on your Event Hub once locked.</p>
      ) : null}
      {narrowedNote ? <p className="mt-1 text-xs text-ink/55">{narrowedNote}</p> : null}
      {pick?.kind === 'supplier' ? (
        <p className="mt-2 text-xs text-ink/55">Your coordinator or the venue gets a link to add it later.</p>
      ) : null}
      {pick?.kind === 'own' ? <OwnVenueForm pick={pick} setPick={setPick} places={state.places} /> : null}
    </div>
  );
}

function OwnVenueForm({
  pick,
  setPick,
  places,
}: {
  pick: Extract<VenuePick, { kind: 'own' }>;
  setPick: (pick: VenuePick | null, extra?: Partial<OnboardingState>) => void;
  places: string[];
}) {
  const city = CITIES.find((c) => c.n === pick.city) ?? null;
  const top = TOP30.map((k) => cityByKey(k)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const rest = CITIES.filter((c) => !TOP30.includes(c.k)).sort((a, b) => a.n.localeCompare(b.n));
  const center = city ? { lat: city.lat, lng: city.lon } : { lat: 14.5995, lng: 120.9842 };
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[var(--m-r-md)] border border-ink/12 p-3" data-own-venue>
      <input
        value={pick.name}
        maxLength={OWN_VENUE_NAME_MAX}
        onChange={(e) => setPick({ ...pick, name: e.target.value })}
        placeholder="Type the venue’s name"
        aria-label="Venue name"
        className="w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-base text-ink outline-none"
      />
      <PickMenu
        label="City or area"
        value={city?.k ?? null}
        buttonText={city ? undefined : 'City or area'}
        options={[
          ...top.map((c) => ({ key: c.k, label: c.n, hint: c.r, group: 'Most chosen' })),
          ...rest.map((c) => ({ key: c.k, label: c.n, hint: c.r, group: 'All places A–Z' })),
        ]}
        onPick={(key) => {
          const c = cityByKey(key);
          if (!c) return;
          // The city is the couple's area too (ask once) — unless they already chose one.
          setPick({ ...pick, city: c.n }, places.length === 0 ? { places: [key], region: resolvePick(key).rk } : {});
        }}
        dataAttr="data-own-venue-city"
        stickyGroups
      />
      <div className="overflow-hidden rounded-md border border-ink/15">
        <BranchPinMap
          value={cleanPin(pick.lat, pick.lng)}
          onChange={(v) => setPick({ ...pick, lat: v.lat, lng: v.lng })}
          initialCenter={center}
        />
      </div>
      <p className="text-xs text-ink/55">
        Drag the map until the pin sits on the door. Your Event Hub follows this venue from now on. You can add a contact later from Your Team.
      </p>
    </div>
  );
}
