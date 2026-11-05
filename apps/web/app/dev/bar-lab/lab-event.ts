/**
 * The event layout's OWN menu gates (`eventMenuGates`) for any event type × needs preset × phase ×
 * shell, from a lab URL — shared by `/dev/bar-lab` and `/dev/home-lab?view=day`. DEV-ONLY.
 */
import { toProfile, type ProfileRow } from '@/lib/event-type-profile';
import { NEED_PRESETS, defaultPresetFor, needsForPreset, needsHiddenNavKeys, type NeedPreset } from '@/lib/event-needs';
import { eventMenuGates } from '@/lib/event-menu-gates';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import type { LabEventBar } from './lab-bar';

/** A type's profile as `resolveProfile` builds it from a row that carries only what migrations seed
 *  differently per type here (`marketplace_enabled = false` on the Simple Event alone). */
function labProfile(type: string) {
  return toProfile({
    event_type: type,
    terminology: null,
    enabled_surfaces: null,
    marketplace_enabled: type === 'simple_event' ? false : null,
  } as unknown as ProfileRow);
}

export function labEventBar(sp: Record<string, string | undefined>): LabEventBar {
  const type = sp.type || 'wedding';
  const profile = labProfile(type);
  const preset: NeedPreset = (NEED_PRESETS as readonly string[]).includes(sp.needs ?? '')
    ? (sp.needs as NeedPreset)
    : defaultPresetFor(type);
  const needs = needsForPreset(preset, { marketplace: profile.marketplaceEnabled === true });
  const phase: MenuLifecyclePhase = sp.phase === 'dayof' || sp.phase === 'after' ? sp.phase : 'plan';
  // `&was=1` — the BEFORE picture: the layout's rule until 22 Oct 2026, replayed (the type's marketplace
  // flag and what the event left off dropped Guests / Suppliers from the bar). The layout no longer has it.
  const hideKeys =
    sp.was === '1'
      ? [...new Set([...(profile.marketplaceEnabled ? [] : ['explore']), ...needsHiddenNavKeys(needs)])]
      : [];
  return { gates: eventMenuGates(profile), hideKeys, phase, storeShell: sp.store === '1' };
}

