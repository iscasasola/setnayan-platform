'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, MapPin, Minus, Plus } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { MAX_DECLARABLE_RADIUS_KM } from '@/lib/vendor-service-radius';
import { COVERAGE_REACH_LOCKED_LINE, COVERAGE_REACH_TITLE, GetVerifiedLine } from '../../_components/get-verified-line';
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
 *
 * 🔓 REACH IS NOT A PLAN ALLOWANCE (owner 2026-11-19: *"ok unlock the range. not plan dependend anymore."* ·
 * *"Free Unverified account will have a range of 0km."*). So:
 *   · a VERIFIED shop on any plan sets its own two distances up to `MAX_DECLARABLE_RADIUS_KM` (the typo guard). There
 *     is no "next plan reaches X km" upsell and no plan ladder in the ⓘ any more;
 *   · an UNVERIFIED shop reaches 0 km and sees ONE locked row in place of the map, the rings and the steppers —
 *     "Coverage reach · Get verified to be found · [Get verified]" (`GetVerifiedLine`). Never silent (the pre-2026-10-29
 *     `return null`), never a greyed map that looks like it might work.
 *
 * COPY DISCIPLINE: no jargon on screen. Not "inner/outer radius" — "Free transpo within" and "You cover up to". The
 * words "inner" and "outer" appear nowhere a vendor can see them.
 *
 * The ceiling is ergonomics only here — the real check runs server-side in `updateServiceRadius`, which re-reads
 * `verification_state` from the database.
 *
 * A BLANK IS A VALID STATE and is never nagged about: undeclared ("—") means no distance limit of the shop's own.
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
  reachCeilingKm,
  lat = null,
  lng = null,
  city = null,
  isVerified = true,
  measured = true,
  reachNote = null,
}: {
  initialInnerKm: number | null;
  initialOuterKm: number | null;
  /** `reachCeilingKm(isVerified)` — ∞ verified, 0 unverified. Never a plan's number (owner 2026-11-19). */
  reachCeilingKm: number;
  /** The HQ pin. Null → no map yet (the address row above sets it). */
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  /** The shop is verified — an unverified shop gets the ONE locked "Coverage reach" row. */
  isVerified?: boolean;
  /** The shop's row could be read. False → say so; never draw a reach that was not read. */
  measured?: boolean;
  /** The shipped sentence about how couples find you — in the ⓘ. */
  reachNote?: string | null;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  // A verified shop's ceiling is `Infinity` — still a cap to step under, bounded by MAX_DECLARABLE_RADIUS_KM (the typo
  // guard, the same on every plan), never "no cap at all".
  const hasCap = measured && isVerified && reachCeilingKm > 0;
  const cap = hasCap ? Math.min(reachCeilingKm, MAX_DECLARABLE_RADIUS_KM) : 0;
  // What couples are shown is the declaration CLAMPED to the ceiling (`effectiveOuterRadiusKm`), so that is what the
  // steppers start from; a stale wider number is never drawn as if it applied.
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

  /** ＋ past the farthest: no save — the one limit, said plainly (no plan upsell: reach is not a plan allowance). */
  const pastCap = () => `${cap.toLocaleString('en-PH')} km is the farthest you can set`;

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

  const info = [
    'Your pin is where trips start. Inside the green ring couples pay no transportation fee; the dashed ring is as far as you go.',
    'Every plan sets its own distances once your shop is verified.',
    reachNote,
    'Saves as you change it.',
  ]
    .filter(Boolean)
    .join(' ');

  if (!measured) {
    return (
      <div className="space-y-1" data-where-you-work="">
        <p className="text-sm font-semibold text-ink">How far you go</p>
        <p role="status" className="text-sm text-warn-700" data-could-not-load="">
          We couldn&rsquo;t read your shop just now — your distances are unchanged. Refresh in a moment.
        </p>
      </div>
    );
  }

  // 🔒 UNVERIFIED = 0 km (owner 2026-11-19): ONE locked row, no map, no rings, no steppers.
  if (!isVerified) {
    return (
      <div className="space-y-1" data-where-you-work="" data-reach-locked="">
        <GetVerifiedLine title={COVERAGE_REACH_TITLE} line={COVERAGE_REACH_LOCKED_LINE} data="reach" />
      </div>
    );
  }

  return (
    <div className="space-y-1" data-where-you-work="">
      <InfoTip label="How far you go" labelAs="p" labelClassName="text-sm font-semibold text-ink" align="start">
        {info}
      </InfoTip>

      {hasMap ? (
        <ReachMap lat={lat} lng={lng} radiusKm={cap} innerKm={inner} outerKm={outer} />
      ) : (
        <p className="py-2 text-sm text-[color:var(--m-slate-2)]">
          Add your HQ address above to see how far you cover on a map.
        </p>
      )}

      <div className="divide-y divide-[color:var(--m-line)]">
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
          line={outer !== null && outer >= cap ? 'The farthest you can set' : "Couples farther out can't book"}
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

      <p className="min-h-5 text-sm text-[color:var(--m-slate-2)]" aria-live="polite" data-reach-status="">
        {capNote ? (
          <span data-reach-cap="">{capNote}</span>
        ) : pending ? (
          <span className="inline-flex items-center gap-1">Saving…</span>
        ) : justSaved ? (
          <span className="inline-flex items-center gap-1">
            <Check className="h-4 w-4" aria-hidden /> Saved
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** A house form row: the label and its one line at the left, the control at the right; a hairline between rows. */
function Row({ title, line, children }: { title: string; line: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-snug text-ink">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-[color:var(--m-slate-2)]">{line}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </div>
  );
}

/**
 * − value ＋ for a distance. The value reads "—" until they say one (a blank is a real answer). ＋ stays pressable at
 * the farthest so it can say so; − stops at what the other distance allows.
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
    'sn-press inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--m-line)] bg-raised text-ink transition-colors duration-sn-control ease-sn hover:bg-[color:var(--m-paper-2)] disabled:cursor-not-allowed disabled:text-[color:var(--m-slate-3)]';
  return (
    <span role="group" aria-label={label} data-km-stepper={data} className="inline-flex items-center gap-1">
      <button type="button" aria-label={`${label}: less`} disabled={!canDown} onClick={onDown} className={btn}>
        <Minus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
      </button>
      <span aria-live="polite" className="min-w-[3.75rem] text-center text-base font-bold tabular-nums text-ink">
        {value === null ? '—' : `${value} km`}
      </span>
      <button type="button" aria-label={`${label}: more`} disabled={!canUp} onClick={onUp} className={btn}>
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
      </button>
    </span>
  );
}
