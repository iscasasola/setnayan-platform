/**
 * onboarding-db.ts — the DB-backed read-through for per-type onboarding CONTENT
 * (the generic, non-wedding flow).
 *
 * Owner directive 2026-06-28: each event type's onboarding is admin-editable.
 * The single override source is `event_type_onboarding` (public read · is_admin()
 * write, migration 20270312483013) — one row per event type, each field an
 * OPTIONAL override of the code DEFAULT. Setnayan HQ edits a type's questions,
 * starter plan, reveal + intro copy from /admin/event-types/[type]/onboarding and
 * the live flow adjusts with zero deploys.
 *
 * The merge is the PURE `resolveOnboardingSpec` (onboarding-spec.ts, unit-tested
 * without a DB); this module only adds the cached Supabase read + the
 * degrade-to-defaults guard. Server-only (reads cookies via the Supabase client).
 */
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import {
  resolveOnboardingSpec,
  type OnboardingOverrideRow,
  type OnboardingSpec,
} from './onboarding-spec';
import type { OnboardingRegister } from './solemn-content';

export type { OnboardingSpec, OnboardingIntro, OnboardingOverrideRow } from './onboarding-spec';
export { resolveOnboardingSpec } from './onboarding-spec';

/**
 * Cached per-request read of a type's onboarding content. Returns the resolved
 * spec (defaults + any admin override). Degrades to all-defaults on any error.
 */
export const getOnboardingSpec = cache(
  async (
    eventType: string,
    packKey: string,
    /**
     * The type's `terminology.register` (from the already-resolved profile).
     * 🔑 It is passed to EVERY degrade path below, not just the happy one — the
     * whole reason the solemn quiz + reveal copy lives in code rather than in
     * `axis_overrides` is that this read fails open, and a wake must not fall
     * back to "Joyful & lively — music, dancing, and a packed floor."
     */
    register: OnboardingRegister = 'celebratory',
  ): Promise<OnboardingSpec> => {
    try {
      const sb = await createClient();
      const { data, error } = await sb
        .from('event_type_onboarding')
        .select('intro, questions, persona_pack, reveal_overrides, axis_overrides')
        .eq('event_type', eventType)
        .maybeSingle();
      if (error) return resolveOnboardingSpec(eventType, packKey, null, register);
      return resolveOnboardingSpec(
        eventType,
        packKey,
        (data as OnboardingOverrideRow | null) ?? null,
        register,
      );
    } catch {
      return resolveOnboardingSpec(eventType, packKey, null, register);
    }
  },
);
