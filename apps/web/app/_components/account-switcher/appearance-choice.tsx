'use client';

/**
 * Appearance — Light · Dark · Automatic (dark mode PR 3, DECISION_LOG 2026-10-13; Automatic added by the owner
 * 2026-10-23: "yes add automatic"). Light stays the default until dark covers every screen (`DEFAULT_APPEARANCE`).
 *
 * WHERE. THE ACCOUNT MENU, one row under "Billing & receipts" (owner 2026-10-25, on a competitor's avatar menu
 * with Appearance in it: "on the upper right, i think the billings&receipts looks nice as well" — read with the
 * controller's recommendation to move Appearance into the menu). It MOVED here from Profile & settings ›
 * Preferences: one place for everything, so Preferences no longer draws a second copy. ONE setting, per person,
 * the same on every screen they sign in to.
 *
 * WHY A DROPDOWN. Three choices fall under the house rule: any set of choices is ONE PickMenu dropdown
 * (owner 2026-09-28) — the shared `PickMenu`, as People uses. It was already a PickMenu on Preferences; the
 * control and its save are the same, only the room changed.
 *
 * HOW IT SAVES (least requests). A pick changes the page AT ONCE: `useTheme().setMode` writes the `sn-theme`
 * cookie in the browser and repaints by the same rule the <head> script uses (Automatic asks the phone).
 * One request follows — `updateThemePreference` writes the column, the cross-device record — and nothing is
 * re-rendered on the server. A failed save is said out loud, never swallowed.
 *
 * WHAT IT SHOWS. The choice THIS browser paints (`useTheme().mode`, read from the cookie) — never a guess.
 *
 * ANOTHER DEVICE. The column arrives as `saved` (read with the switcher data). When it disagrees with this
 * browser's cookie (the choice was made on a phone, this is the laptop) the cookie is brought in line — ONCE per
 * page load, and never after a pick in this tab.
 * 🔑 WHY ONCE: the sheet mounts each time it opens, and the layout's `saved` is the value from when the LAYOUT
 * rendered — a client navigation does not re-render it, and a prefetch may reuse a ≤20 s chrome snapshot. Without
 * the latch, picking Dark, closing the menu and opening it again would put the old Light straight back.
 * `undefined` = the column was not read (the read failed): nothing is reconciled, the cookie stands.
 *
 * ⚠ Dark only reaches screens on the ready-list (`DARK_READY`, lib/appearance.ts) — the rest stay Light until
 * their area is swept (call 3), so on a dark phone Automatic shows a mix until the rollout ends.
 */

import { useEffect, useState, useTransition } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useTheme } from '@/app/_components/theme-provider';
import { InfoTip } from '@/app/_components/info-tip';
import { DEFAULT_APPEARANCE, appearanceFromCookie, isAppearance, type Appearance } from '@/lib/appearance';
import { updateThemePreference } from '@/app/dashboard/(account)/profile/actions';

const ICON = 'h-[18px] w-[18px]';
const OPTIONS = [
  { key: 'light', label: 'Light', icon: <Sun className={ICON} strokeWidth={1.9} /> },
  { key: 'dark', label: 'Dark', icon: <Moon className={ICON} strokeWidth={1.9} /> },
  { key: 'auto', label: 'Automatic', icon: <Monitor className={ICON} strokeWidth={1.9} /> },
];
const MARK: Record<Appearance, typeof Sun> = { light: Sun, dark: Moon, auto: Monitor };

/** Latched for the life of this page load: the account's choice has been brought in, or the person picked here. */
let reconciled = false;

export function AppearanceChoice({ saved, className = '' }: { saved: string | null | undefined; className?: string }) {
  const { mode, setMode } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // null = never chosen → the default; undefined = not read → nothing to bring in.
  const server: Appearance | undefined = saved === undefined ? undefined : isAppearance(saved) ? saved : DEFAULT_APPEARANCE;

  // Bring this browser in line with the account (a choice made on another device) — once per page load.
  useEffect(() => {
    if (reconciled || server === undefined) return;
    reconciled = true;
    if (appearanceFromCookie(document.cookie) !== server) setMode(server);
  }, [server, setMode]);

  const pick = (key: string) => {
    if (!isAppearance(key) || key === mode) return;
    reconciled = true;
    setError(null);
    setMode(key);
    startSaving(async () => {
      const fd = new FormData();
      fd.set('theme', key);
      const res = await updateThemePreference(fd);
      if (!res.ok) setError(res.error);
    });
  };

  const Mark = MARK[mode] ?? Sun;
  return (
    <div className={className} data-setting-appearance="">
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--m-ivory)] text-ink">
        <Mark className={ICON} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <InfoTip label="Appearance" labelClassName="text-[15px] font-medium text-ink" align="start">
          For you on every screen you sign in to. Your event&rsquo;s guest pages keep your design.
        </InfoTip>
        <span className="block text-[12.5px] text-[var(--m-slate-2)] empty:hidden" aria-live="polite">
          {saving ? 'Saving…' : error ? <span className="text-danger-700 dark:text-red-400">{error}</span> : null}
        </span>
      </span>
      <PickMenu
        label="Appearance"
        value={mode}
        options={OPTIONS}
        onPick={pick}
        dataAttr="data-appearance-picker"
        className="shrink-0 border border-ink/15"
      />
    </div>
  );
}
