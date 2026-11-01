'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, Loader2, MapPin, Minus, Plus } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { MAX_DECLARABLE_RADIUS_KM } from '@/lib/vendor-service-radius';
import { GetVerifiedLine, UNVERIFIED_REACH_TITLE } from '../../_components/get-verified-line';
import { updateServiceRadius } from '../radius-actions';
import { ReachMap } from './reach-map';

/**
 * My Shop → Coverage reach → the vendor's own two travel distances.
 *
 * Owner-locked 2026-07-27: *"they have inner radius. this radius must comply to
 * give free transportation fee if within this radius. outer radius is the
 * overall range."* · Explore_Replan_BUILD_SPEC_2026-07-27.md §17.
 *
 * WHERE THIS LIVES, AND WHY: directly under the existing `ReachMap` in
 * `BranchPanel`, which is the one place in the product that already presents
 * "how far you cover from your HQ". Its own docstring said the radius was
 * "read-only here; a follow-up makes it vendor-settable up to the tier
 * ceiling" — this is that follow-up. No new page, no new route; the tier ring
 * on the map is now the CEILING and these two numbers are the vendor's own
 * declaration inside it.
 *
 * 📍 RESTYLED, NOT REDRAWN — Shop › Details › Where you work (owner 2026-10-29, Supplier dashboard v13 notes 3 + 4):
 *   · the map now lives HERE, so it redraws as the distances move: the pin at the HQ, the inner ring = "Free transpo",
 *     the outer ring = how far they cover (`ReachMap innerKm/outerKm`);
 *   · "Your pin · Where trips start from · [Move]" — Move opens the shipped Company address row (its address + draggable
 *     pin picker), never a second pin editor;
 *   · the two number fields + "Save distances" became −/＋ steppers that SAVE IN PLACE (a save never resets the screen
 *     — the same `updateServiceRadius` action, debounced; the screen keeps every value it shows);
 *   · ＋ past the plan's farthest does not save: it says how far the NEXT plan reaches, and the ⓘ carries the ladder;
 *   · an unverified Free shop reaches 0 km. Until 2026-10-29 this returned `null` there — the panel went silent. Now it
 *     says why and offers the one step (`GetVerifiedLine`: "Couples can't find you by distance yet · You show up once
 *     you're verified · [Get verified]"), with the map and the rings greyed until approved.
 *
 * COPY DISCIPLINE: no jargon on screen. Not "inner/outer radius" — "Free transpo within" and "You cover up to". The
 * words "inner" and "outer" appear nowhere a vendor can see them.
 *
 * The tier ceiling is ergonomics only here — the real cap check runs server-side in `updateServiceRadius`, which
 * re-reads `tier_state` from the database.
 *
 * A BLANK IS A VALID STATE and is never nagged about: undeclared ("—") means the couple's bench keeps its existing
 * tier-derived reach read.
 */

/** One press moves a distance this far. */
const STEP_KM = 5;
/** Presses land, then ONE save goes for them all. */
const SAVE_AFTER_MS = 700;

const upFrom = (v: number) => Math.floor(v / STEP_KM) * STEP_KM + STEP_KM;
const downFrom = (v: number) => Math.ceil(v / STEP_KM) * STEP_KM - STEP_KM;

export function ServiceRadiusFields({
  initialInnerKm,
  initialOuterKm,
  tierCapKm,
  lat = null,
  lng = null,
  city = null,
  isVerified = true,
  tierMeasured = true,
  planName = null,
  nextReach = null,
  ladder = null,
  reachNote = null,
}: {
  initialInnerKm: number | null;
  initialOuterKm: number | null;
  /** The vendor's plan ceiling in km. Non-finite / 0 = no reach on this plan. */
  tierCapKm: number;
  /** The HQ pin. Null → no map yet (the address row above sets it). */
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  /** The shop is verified — an unverified shop's 0 km says why, with the one step that opens it. */
  isVerified?: boolean;
  /** The plan could be read. False → say so; never draw a plan's reach that was not read. */
  tierMeasured?: boolean;
  /** "Solo" — the plan's own name, for "Your plan's farthest · Solo 30 km". */
  planName?: string | null;
  /** The next plan up that reaches farther ("Pro", 50) — what ＋ past the cap says. Null at the top. */
  nextReach?: { plan: string; km: number } | null;
  /** "Verified 20 km · Solo 30 · Pro 50 · Ultra 100" — built from the plan table, for the ⓘ. */
  ladder?: string | null;
  /** The shipped sentence about how couples find you at this reach — moved into the ⓘ. */
  reachNote?: string | null;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const hasCap = tierMeasured && Number.isFinite(tierCapKm) && tierCapKm > 0;
  const cap = hasCap ? Math.min(tierCapKm, MAX_DECLARABLE_RADIUS_KM) : 0;
  // What couples are shown is the declaration CLAMPED to today's plan (`effectiveOuterRadiusKm` — a lapsed plan stops
  // buying reach), so that is what the steppers start from; a stale wider number is never drawn as if it applied.
  const startOuter = initialOuterKm === null || !hasCap ? initialOuterKm : Math.min(initialOuterKm, cap);
  const startInner = initialInnerKm === null || !hasCap ? initialInnerKm : Math.min(initialInnerKm, startOuter ?? cap);
  const [inner, setInner] = useState(startInner);
  const [outer, setOuter] = useState(startOuter);
  const saved = useRef({ inner: startInner, outer: startOuter });
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [capNote, setCapNote] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const hasMap = lat !== null && lng !== null;
  const plan = planName ?? 'Your plan';

  function save(next: { inner: number | null; outer: number | null }) {
    setJustSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const fd = new FormData();
      fd.set('inner_radius_km', next.inner === null ? '' : String(next.inner));
      fd.set('outer_radius_km', next.outer === null ? '' : String(next.outer));
      setPending(true);
      startTransition(async () => {
        const res = await updateServiceRadius(null, fd);
        setPending(false);
        if (!res.ok) {
          // Refused: put back what IS saved, and say why. The screen stays where it is.
          toast.error(res.error);
          setInner(saved.current.inner);
          setOuter(saved.current.outer);
          return;
        }
        saved.current = { inner: res.innerRadiusKm, outer: res.outerRadiusKm };
        setJustSaved(true);
      });
    }, SAVE_AFTER_MS);
  }

  /** ＋ past the plan's farthest: no save — how far the next plan reaches, in words. */
  const pastCap = () => (nextReach ? `${plan} reaches ${cap} km · ${nextReach.plan} reaches ${nextReach.km} km` : `${cap} km is the farthest any plan reaches`);

  function stepOuter(dir: 1 | -1) {
    if (!hasCap) return;
    setCapNote(null);
    if (dir === 1) {
      const next = upFrom(outer ?? inner ?? 0);
      if (next > cap) {
        setCapNote(pastCap());
        return;
      }
      setOuter(next);
      save({ inner, outer: next });
    } else {
      if (outer === null) return;
      const next = downFrom(outer);
      if (next < Math.max(inner ?? 0, STEP_KM)) return;
      setOuter(next);
      save({ inner, outer: next });
    }
  }

  function stepInner(dir: 1 | -1) {
    if (!hasCap) return;
    setCapNote(null);
    if (dir === 1) {
      const next = inner === null ? STEP_KM : upFrom(inner);
      if (next > (outer ?? cap)) {
        setCapNote(outer !== null && outer < cap ? 'Free transpo stays inside how far you cover — move that up first' : pastCap());
        return;
      }
      setInner(next);
      save({ inner: next, outer });
    } else {
      if (inner === null || inner <= 0) return;
      const next = Math.max(0, downFrom(inner));
      setInner(next);
      save({ inner: next, outer });
    }
  }

  // Move = the shipped Company address row (address + draggable pin), opened in place.
  function movePin() {
    const trigger = document.querySelector<HTMLButtonElement>('[data-edit-field="maps_pin"]');
    if (!trigger) return;
    trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
  }

  const unverifiedZero = tierMeasured && !hasCap && !isVerified;
  const info = [
    'Your pin is where trips start. Inside the green ring couples pay no transportation fee; the dashed ring is as far as you go.',
    ladder ? `Your plan sets the farthest you can choose: ${ladder} — Free is 0 until you are verified.` : null,
    reachNote,
    'Saves as you change it.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1" data-where-you-work="">
      <InfoTip label="How far you go" labelAs="p" labelClassName="text-sm font-medium text-ink" align="start">
        {info}
      </InfoTip>

      {!tierMeasured ? (
        <p role="status" className="text-sm text-ink/60" data-could-not-load="">
          We couldn&rsquo;t read your plan just now — your distances are unchanged. Refresh in a moment.
        </p>
      ) : unverifiedZero ? (
        <GetVerifiedLine title={UNVERIFIED_REACH_TITLE} data="reach" />
      ) : !hasCap ? (
        <p className="py-2 text-sm text-ink/60" data-reach-none="">
          Couples can&rsquo;t find you by distance yet — your plan has no distance reach.
        </p>
      ) : null}

      {hasMap ? (
        <ReachMap lat={lat} lng={lng} radiusKm={cap} innerKm={hasCap ? inner : null} outerKm={hasCap ? outer : null} muted={!hasCap} />
      ) : (
        <p className="py-2 text-xs" style={{ color: 'var(--m-slate)' }}>
          Add your HQ address above to see how far you cover on a map.
        </p>
      )}

      <div className="divide-y divide-ink/10">
        <Row title="Your pin" line="Where trips start from">
          <span className="max-w-[9rem] truncate text-sm text-ink">{city ? `${city} HQ` : hasMap ? 'Your HQ' : 'Not set yet'}</span>
          <ActionButton tone="neutral" icon={MapPin} label="Move" onClick={movePin} />
        </Row>
        <Row title="Free transpo within" line="No transportation fee inside this">
          <KmStepper
            label="Free transpo within"
            value={inner}
            canDown={hasCap && inner !== null && inner > 0}
            canUp={hasCap}
            onDown={() => stepInner(-1)}
            onUp={() => stepInner(1)}
            data="inner"
          />
        </Row>
        <Row
          title="You cover up to"
          line={
            !hasCap
              ? 'Free reaches 0 km until verified'
              : outer !== null && outer >= cap
                ? `Your plan's farthest · ${plan} ${cap} km`
                : "Couples farther out can't book"
          }
        >
          <KmStepper
            label="You cover up to"
            value={outer}
            canDown={hasCap && outer !== null && outer - STEP_KM >= Math.max(inner ?? 0, STEP_KM)}
            canUp={hasCap}
            onDown={() => stepOuter(-1)}
            onUp={() => stepOuter(1)}
            data="outer"
          />
        </Row>
      </div>

      <p className="min-h-[1.25rem] text-xs text-ink/60" aria-live="polite" data-reach-status="">
        {capNote ? (
          <span data-reach-cap="">{capNote}</span>
        ) : pending ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Saving…
          </span>
        ) : justSaved ? (
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" aria-hidden /> Saved
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** A house form row: the label and its one line at the left, the control at the right; a hairline between rows. */
function Row({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink/60">{line}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </div>
  );
}

/**
 * − value ＋ for a distance. The value reads "—" until they say one (a blank is a real answer). ＋ stays pressable at
 * the plan's farthest so it can say how far the next plan reaches; − stops at what the other distance allows.
 */
function KmStepper({
  label,
  value,
  canDown,
  canUp,
  onDown,
  onUp,
  data,
}: {
  label: string;
  value: number | null;
  canDown: boolean;
  canUp: boolean;
  onDown: () => void;
  onUp: () => void;
  data: string;
}) {
  const btn =
    'sn-press inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 bg-raised text-ink/75 transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:text-ink/25';
  return (
    <span role="group" aria-label={label} data-km-stepper={data} className="inline-flex items-center gap-1">
      <button type="button" aria-label={`${label}: less`} disabled={!canDown} onClick={onDown} className={btn}>
        <Minus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
      </button>
      <span aria-live="polite" className="min-w-[3.75rem] text-center text-[15px] font-medium tabular-nums text-ink">
        {value === null ? '—' : `${value} km`}
      </span>
      <button type="button" aria-label={`${label}: more`} disabled={!canUp} onClick={onUp} className={btn}>
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </span>
  );
}
