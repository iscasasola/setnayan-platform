'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { MAX_DECLARABLE_RADIUS_KM } from '@/lib/vendor-service-radius';
import { updateServiceRadius } from '../radius-actions';

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
 * COPY DISCIPLINE: no jargon on screen. Not "inner/outer radius" — "Free travel
 * within" and "Furthest we'll travel", with a sentence saying what each one
 * means to a couple. The words "inner" and "outer" appear nowhere a vendor can
 * see them.
 *
 * The tier ceiling is rendered inline and enforced by `max` on the inputs, but
 * that is ergonomics only — the real cap check runs server-side in
 * `updateServiceRadius`, which re-reads `tier_state` from the database.
 *
 * A BLANK IS A VALID STATE and is never nagged about: undeclared means the
 * couple's bench keeps its existing tier-derived reach read. Saving two empty
 * fields clears the declaration.
 */
export function ServiceRadiusFields({
  initialInnerKm,
  initialOuterKm,
  tierCapKm,
}: {
  initialInnerKm: number | null;
  initialOuterKm: number | null;
  /** The vendor's plan ceiling in km. Non-finite / 0 = no reach on this plan. */
  tierCapKm: number;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [savedInner, setSavedInner] = useState(initialInnerKm);
  const [savedOuter, setSavedOuter] = useState(initialOuterKm);
  const [inner, setInner] = useState(initialInnerKm === null ? '' : String(initialInnerKm));
  const [outer, setOuter] = useState(initialOuterKm === null ? '' : String(initialOuterKm));
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const asText = (v: number | null) => (v === null ? '' : String(v));
  const dirty = inner.trim() !== asText(savedInner) || outer.trim() !== asText(savedOuter);

  const hasCap = Number.isFinite(tierCapKm) && tierCapKm > 0;
  const capMax = hasCap ? Math.min(tierCapKm, MAX_DECLARABLE_RADIUS_KM) : MAX_DECLARABLE_RADIUS_KM;

  function save() {
    const fd = new FormData();
    fd.set('inner_radius_km', inner.trim());
    fd.set('outer_radius_km', outer.trim());
    setPending(true);
    setJustSaved(false);
    startTransition(async () => {
      const res = await updateServiceRadius(null, fd);
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSavedInner(res.innerRadiusKm);
      setSavedOuter(res.outerRadiusKm);
      setInner(asText(res.innerRadiusKm));
      setOuter(asText(res.outerRadiusKm));
      setJustSaved(true);
    });
  }

  // No reach on this plan → nothing to declare. The panel above already tells
  // them to upgrade; don't repeat it, and don't show inputs that can only fail.
  if (!hasCap) return null;

  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-sm text-ink outline-none focus:ring-2';

  return (
    <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--m-line)' }}>
      <div>
        <p className="text-sm font-medium text-ink">Your travel distances</p>
        <p className="mt-0.5 text-xs text-ink/55">
          Couples see these on your card. Your plan allows up to{' '}
          <span className="font-medium text-ink">{tierCapKm} km</span>. Leave both blank
          if you&rsquo;d rather not say yet — nothing changes if you do.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-ink">Free travel within</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={capMax}
              step={1}
              value={inner}
              onChange={(e) => {
                setInner(e.target.value);
                setJustSaved(false);
              }}
              placeholder="—"
              aria-label="Free travel within, in kilometres"
              className={inputClass}
              style={{ borderColor: 'var(--m-line)' }}
            />
            <span className="text-xs text-ink/55">km</span>
          </div>
          <span className="mt-1 block text-[11px] leading-snug text-ink/50">
            Inside this, you charge <span className="font-medium">no transportation fee</span>.
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-ink">Furthest we&rsquo;ll travel</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={capMax}
              step={1}
              value={outer}
              onChange={(e) => {
                setOuter(e.target.value);
                setJustSaved(false);
              }}
              placeholder="—"
              aria-label="Furthest we will travel, in kilometres"
              className={inputClass}
              style={{ borderColor: 'var(--m-line)' }}
            />
            <span className="text-xs text-ink/55">km</span>
          </div>
          <span className="mt-1 block text-[11px] leading-snug text-ink/50">
            Past your free distance you still come, but a{' '}
            <span className="font-medium">travel fee applies</span>. Beyond this you&rsquo;re
            out of range.
          </span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--m-terracotta, #b65d3c)' }}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {pending ? 'Saving…' : 'Save distances'}
        </button>
        {justSaved && !dirty ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink/55">
            <Check className="h-3.5 w-3.5" aria-hidden /> Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}
