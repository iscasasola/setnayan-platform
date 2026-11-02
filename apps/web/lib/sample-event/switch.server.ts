import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { envFlagEnabled } from '@/lib/env-flag';
import { GLOBAL_SETTINGS_TAGS, rememberedGlobalRead } from '@/lib/global-settings-cache';
import { discoverOpensHere } from '@/lib/request-platform';
import { viewerIsInternal } from '@/lib/view-as-free.server';
import { sampleOpensFor } from './gate';
import { readSampleEvent, readSampleGuest, SAMPLE_EVENT_ID, type SampleEventSnapshot, type SampleGuest } from './snapshot';

/**
 * apps/web/lib/sample-event/switch.server.ts
 *
 * 🎭 THE SAMPLE'S ONE SWITCH — `platform_settings.sample_event_enabled`
 * (migration 20271302376604), built dark (corpus RELEASE_LIST_DARK_LAUNCHES.md).
 *
 * TRI-STATE, the `resolveSetnayanAiPaywallEnabled` shape (lib/integration-config.ts):
 *   • NULL  → defer to the server-only `SAMPLE_EVENT_ENABLED` env var (unset = OFF).
 *   • TRUE  → open for everyone.
 *   • FALSE → off (internal accounts still see it — `./gate.ts`).
 * Never a `NEXT_PUBLIC_*` build flag: "go" is a flip, not a redeploy.
 *
 * REMEMBERED like every platform_settings read, and the flip is still seen on
 * the next request: the one writer (`setSampleEventSwitch`,
 * app/admin/settings/actions.ts) clears `GLOBAL_SETTINGS_TAGS.platformSettings`
 * in the same action. A refused read is never remembered; it falls to the env
 * var for this request only — off, unless someone set it.
 */
export async function resolveSampleEventEnabled(): Promise<boolean> {
  try {
    const dbVal = await rememberedGlobalRead('platform_settings-sample-event-v1', GLOBAL_SETTINGS_TAGS.platformSettings, async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('platform_settings')
        .select('sample_event_enabled')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      const v = (data as { sample_event_enabled?: boolean | null } | null)?.sample_event_enabled;
      return typeof v === 'boolean' ? v : null;
    });
    if (typeof dbVal === 'boolean') return dbVal;
  } catch {
    // DB unreachable / column absent (pre-migration) → env fallback below.
  }
  return envFlagEnabled(process.env.SAMPLE_EVENT_ENABLED);
}

/** Does the sample open on this request? Asks "internal?" only while the switch is off. */
export const sampleOpensHere = cache(async (): Promise<boolean> => {
  const webShell = await discoverOpensHere();
  if (!webShell) return false;
  const switchOn = await resolveSampleEventEnabled();
  const internal = switchOn ? false : await viewerIsInternal();
  return sampleOpensFor({ webShell, switchOn, internal });
});

/**
 * Every /sample page's first line: the sample, or the 404.
 *
 * 404 when the sample is closed to this viewer (switch off and not internal, or
 * the app shell) — and 404 for any `key` that is not the sample's own id. Pages
 * that take no key read the one sample; a page that is handed a key (a route
 * param) passes it here and never looks anything up itself.
 */
export async function loadSampleOrNotFound(key: unknown = SAMPLE_EVENT_ID): Promise<SampleEventSnapshot> {
  if (!(await sampleOpensHere())) notFound();
  const snapshot = readSampleEvent(key);
  if (!snapshot) notFound();
  return snapshot;
}

/**
 * `/sample/hub/[guestKey]`'s first line: the sample and that one sample guest, or
 * the 404 — closed sample, or a key that is not a sample guest's (a real guest's
 * uuid, `S89G-` id or QR token never resolves here).
 */
export async function loadSampleGuestOrNotFound(
  guestKey: unknown,
): Promise<{ sample: SampleEventSnapshot; guest: SampleGuest }> {
  const sample = await loadSampleOrNotFound();
  const guest = readSampleGuest(guestKey);
  if (!guest) notFound();
  return { sample, guest };
}
