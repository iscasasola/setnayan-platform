'use client';

/**
 * Appearance — Light · Dark · Automatic (dark mode PR 3, DECISION_LOG 2026-10-13; Automatic added and made the
 * DEFAULT by the owner 2026-10-23: "yes add automatic" … "set it to automatic").
 *
 * WHERE AND WHAT. Account settings › Preferences, the first row, above Planner mode and Display language.
 * ONE setting, per person, the same on every screen they sign in to.
 *
 * WHY A DROPDOWN NOW. Call 2 (2026-10-13) made Appearance a pill because it was a TWO-way choice ("template
 * rule for two choices"). Three choices fall back under the house rule that stands for every other set:
 * any set of choices is ONE PickMenu dropdown (owner 2026-09-28) — the shared `PickMenu`, as People uses.
 *
 * HOW IT SAVES (least requests). A pick changes the page AT ONCE: `useTheme().setMode` writes the `sn-theme`
 * cookie in the browser and repaints by the same rule the <head> script uses (Automatic asks the phone).
 * One request follows — `updateThemePreference` writes the column, the cross-device record — and nothing is
 * re-rendered on the server. A failed save is said out loud, never swallowed.
 *
 * ANOTHER DEVICE. The column arrives as `saved`; when this browser's cookie disagrees (the choice was made on
 * a phone, this is the laptop), the cookie is brought in line on mount.
 *
 * ⚠ Dark only reaches screens on the ready-list (`DARK_READY`, lib/appearance.ts) — the rest stay Light until
 * their area is swept (call 3), so on a dark phone Automatic shows a mix until the rollout ends.
 */

import { useEffect, useState, useTransition } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useTheme } from '@/app/_components/theme-provider';
import { DEFAULT_APPEARANCE, appearanceFromCookie, isAppearance, type Appearance } from '@/lib/appearance';
import { updateThemePreference } from '../actions';

const ICON = 'h-[18px] w-[18px]';
const OPTIONS = [
  { key: 'light', label: 'Light', icon: <Sun className={ICON} strokeWidth={1.9} /> },
  { key: 'dark', label: 'Dark', icon: <Moon className={ICON} strokeWidth={1.9} /> },
  { key: 'auto', label: 'Automatic', icon: <Monitor className={ICON} strokeWidth={1.9} /> },
];

export function AppearanceChoice({ saved }: { saved: string | null }) {
  const { setMode } = useTheme();
  const server: Appearance = isAppearance(saved) ? saved : DEFAULT_APPEARANCE;
  const [picked, setPicked] = useState<Appearance>(server);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Bring this browser in line with the account (a choice made on another device).
  useEffect(() => {
    if (appearanceFromCookie(document.cookie) !== server) setMode(server);
  }, [server, setMode]);

  const pick = (key: string) => {
    if (!isAppearance(key) || key === picked) return;
    setPicked(key);
    setError(null);
    setMode(key);
    startSaving(async () => {
      const fd = new FormData();
      fd.set('theme', key);
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
      <PickMenu
        label="Appearance"
        value={picked}
        options={OPTIONS}
        onPick={pick}
        dataAttr="data-appearance-picker"
        className="shrink-0 self-start border border-ink/15 sm:self-auto"
      />
    </div>
  );
}
