'use client';

/**
 * carried-honoree-fields.tsx — WHO "For ▾" named, posted with the Get-together.
 *
 * Owner 2026-10-22 ("yes"): a SHOP is linked on every event created for it. The
 * create grid stashes the "For ▾" answer before it hops here (`stashHonoree`,
 * sessionStorage, single-read, 10-min TTL — a name never rides in the URL); this
 * takes it once and posts it as two hidden fields. Nothing is drawn or asked.
 *
 * ⚠ A CLAIM ONLY. `commitSimpleEvent` hands both to `resolveEventHonoree`, which
 * re-reads the record under `owner_user_id = you` and links it only when it is
 * the caller's own BUSINESS — a person carried here is dropped, label and all.
 */
import { useEffect, useState } from 'react';
import { takeHonoree, type HonoreeCarry } from '@/lib/onboarding/honoree-handoff';

export function CarriedHonoreeFields() {
  const [carried, setCarried] = useState<HonoreeCarry | null>(null);
  useEffect(() => {
    const c = takeHonoree();
    if (c?.dependentId) setCarried(c);
  }, []);
  if (!carried?.dependentId) return null;
  return (
    <>
      <input type="hidden" name="honoree_label" value={carried.name} />
      <input type="hidden" name="honoree_dependent_id" value={carried.dependentId} />
    </>
  );
}
