'use client';

/**
 * Appearance — Light · Dark (dark mode PR 3, owner "approve all", DECISION_LOG 2026-10-13).
 *
 * WHERE AND WHAT. Account settings › Preferences, the first row, above Planner mode and Display
 * language. ONE setting, per person, the same on every screen they sign in to (the account menu of
 * all five signed-in trees links here). Call 2: a two-way choice is a PILL SELECTOR (template kind 1,
 * the shared `PillSelector`) — superseding "one dropdown" (2026-10-07) — matching its two neighbours.
 *
 * HOW IT SAVES (least requests). A tap changes the page AT ONCE: `useTheme().setMode` writes the
 * `sn-theme` cookie in the browser and repaints by the same rule the <head> script uses. One request
 * follows — `updateThemePreference` writes the column, the cross-device record — and nothing is
 * re-rendered on the server. A failed save is said out loud, never swallowed.
 *
 * ANOTHER DEVICE. The column arrives as `saved`; when this browser's cookie disagrees (the choice
 * was made on a phone, this is the laptop), the cookie is brought in line on mount.
 *
 * ⚠ With the ready-list (`DARK_READY`, lib/appearance.ts) empty, picking Dark changes nothing on any
 * screen yet — dark opens area by area as each is swept (call 3). The choice is kept meanwhile.
 */

import { useEffect, useState, useTransition } from 'react';
import { PillSelector } from '@/app/_components/pill-selector';
import { useTheme } from '@/app/_components/theme-provider';
import { appearanceFromCookie, isAppearance, type Appearance } from '@/lib/appearance';
import { updateThemePreference } from '../actions';

const OPTIONS = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
] as const;

export function AppearanceChoice({ saved }: { saved: string | null }) {
  const { setMode } = useTheme();
  const server: Appearance = isAppearance(saved) ? saved : 'light';
  const [picked, setPicked] = useState<Appearance>(server);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Bring this browser in line with the account (a choice made on another device).
  useEffect(() => {
    if (appearanceFromCookie(document.cookie) !== server) setMode(server);
  }, [server, setMode]);

  const pick = (next: Appearance) => {
    if (next === picked) return;
    setPicked(next);
    setError(null);
    setMode(next);
    startSaving(async () => {
      const fd = new FormData();
      fd.set('theme', next);
      const res = await updateThemePreference(fd);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:justify-between" data-setting-appearance>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">Appearance</p>
        <p className="mt-0.5 text-xs text-ink/60">For you on every screen. Your event&rsquo;s guest pages keep your design.</p>
        <p className="text-xs text-ink/60" aria-live="polite">
          {saving ? 'Saving…' : error ? <span className="text-danger-700">{error}</span> : null}
        </p>
      </div>
      <PillSelector
        label="Appearance"
        value={picked}
        options={OPTIONS}
        onPick={pick}
        grow={false}
        className="shrink-0 self-start bg-ink/[0.06] sm:self-auto"
        data="appearance"
      />
    </div>
  );
}
