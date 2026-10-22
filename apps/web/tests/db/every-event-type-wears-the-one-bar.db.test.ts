/**
 * 🧭 EVERY EVENT TYPE THE MIGRATIONS PRODUCE WEARS THE ONE BAR (owner 22 Oct 2026, on a Simple event
 * whose bar read "Home · Hub · More": *"Fix both"* → *"I think this might be an issue on other events
 * as well"*) — SOURCE OF TRUTH: every migration replayed, every `event_type_profiles` row read, plus
 * every type in the vocabulary (`event_type_vocab`) and in the needs roster that has no row (those
 * resolve to their code profile, as `resolveProfile` does).
 *
 * The pure sibling (`lib/every-event-wears-the-one-bar.test.ts`) sweeps the code profiles. `resolveProfile`
 * PREFERS the database row, so a seeded row is what prod reads — this closes that gap: seed a type
 * whose row would drop a tab (no `website` → no Hub), or bring a hiding key back into
 * `eventMenuGates`, and this fails naming the type. There is no hand-kept roster.
 *
 * For each type × needs preset × phase × web / app shell: the layout's OWN rule (`eventMenuGates`)
 * handed to the ONE tree must build Home · Guests · Suppliers · Hub, plus More on the web only.
 *
 * `EVENT_BAR_TABLE=<file>` also writes the type × phase table for the PR body (no effect otherwise).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { toProfile, type EventTypeProfile, type ProfileRow } from '../../lib/event-type-profile';
import { eventMenuGates } from '../../lib/event-menu-gates';
import { buildCustomerMenuTree, type EventMenuChild } from '../../lib/customer-menu';
import { DEFAULT_PRESET_BY_TYPE, NEED_PRESETS, defaultPresetFor, needsForPreset, needsHiddenNavKeys } from '../../lib/event-needs';
import type { MenuLifecyclePhase } from '../../lib/day-of-mode';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close();
});

const PHASES: MenuLifecyclePhase[] = ['plan', 'dayof', 'after'];
const SERVICES: EventMenuChild[] = [{ key: 'papic', label: 'Papic', href: '#papic', icon: 'papic' }];
const FOUR = ['home', 'guests', 'explore', 'launch'];
const WORD: Record<string, string> = { home: 'Home', guests: 'Guests', explore: 'Suppliers', launch: 'Hub', studio: 'More' };

async function everyProfile(): Promise<EventTypeProfile[]> {
  const rows = (await replay.db.query<ProfileRow>(`SELECT * FROM public.event_type_profiles ORDER BY event_type`)).rows;
  const vocab = (await replay.db.query<{ event_type: string }>(`SELECT event_type FROM public.event_type_vocab`)).rows;
  const seeded = new Map(rows.map((r) => [r.event_type, toProfile(r)]));
  // A type with no row resolves to its code profile (`resolveProfile` → fallback) — swept the same way.
  for (const t of [...vocab.map((v) => v.event_type), ...Object.keys(DEFAULT_PRESET_BY_TYPE)]) {
    if (!seeded.has(t)) {
      seeded.set(t, toProfile({ event_type: t, terminology: null, enabled_surfaces: null, marketplace_enabled: null } as unknown as ProfileRow));
    }
  }
  return [...seeded.values()].sort((a, b) => a.eventType.localeCompare(b.eventType));
}

function bar(profile: EventTypeProfile, phase: MenuLifecyclePhase, storeShell: boolean, hideKeys: string[] = []): string[] {
  return buildCustomerMenuTree('ev', {
    phase,
    ...eventMenuGates(profile),
    hideKeys,
    studioRows: [],
    storeShell,
    services: storeShell ? [] : SERVICES,
  }).map((m) => m.key);
}

test('🧭 every event type × needs preset × phase × shell in the migrations builds the one bar', async () => {
  const profiles = await everyProfile();
  // Sanity floor FIRST: an empty read passes every assertion below and looks exactly like a pass.
  assert.ok(profiles.length >= 20, `expected the full type roster, got ${profiles.length}`);
  assert.ok(profiles.some((p) => p.marketplaceEnabled === false), 'no vendor-free type in the data — the case that failed is not being swept');
  const wrong: string[] = [];
  for (const p of profiles) {
    for (const preset of NEED_PRESETS) {
      needsForPreset(preset, { marketplace: p.marketplaceEnabled === true });
      for (const phase of PHASES) {
        for (const storeShell of [false, true]) {
          const keys = bar(p, phase, storeShell);
          const want = storeShell ? FOUR : [...FOUR, 'studio'];
          if (keys.join(' ') !== want.join(' ')) {
            wrong.push(`${p.eventType} · ${preset} · ${phase} · ${storeShell ? 'app' : 'web'} → ${keys.map((k) => WORD[k]).join(' · ')}`);
          }
        }
      }
    }
  }
  assert.deepEqual(wrong, [], `a type draws a different bar from the wedding's:\n${wrong.join('\n')}`);

  const out = process.env.EVENT_BAR_TABLE;
  if (out) {
    const words = (k: string[]) => k.map((x) => WORD[x]).join(' · ');
    const lines = [
      '| Type (default needs) | Phase | Before — web bar | Before — app bar | After — web bar | After — app bar |',
      '|---|---|---|---|---|---|',
    ];
    for (const p of profiles) {
      const preset = defaultPresetFor(p.eventType);
      const needs = needsForPreset(preset, { marketplace: p.marketplaceEnabled === true });
      const was = [...new Set([...(p.marketplaceEnabled ? [] : ['explore']), ...needsHiddenNavKeys(needs)])];
      for (const phase of PHASES) {
        lines.push(
          `| ${p.eventType} (${preset}) | ${phase} | ${words(bar(p, phase, false, was))} | ${words(bar(p, phase, true, was))} | ${words(bar(p, phase, false))} | ${words(bar(p, phase, true))} |`,
        );
      }
    }
    writeFileSync(out, lines.join('\n') + '\n');
  }
});
