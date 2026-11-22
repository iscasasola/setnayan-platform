/**
 * appearance.ts — WHAT HAPPENS WHEN A PERSON PICKS LIGHT OR DARK.
 *
 * The control is `app/dashboard/(account)/profile/_components/appearance-choice.tsx` — "Appearance", ONE dropdown
 * with two choices (owner 2026-10-07: "keep it simple and have our light/dark theme"; 2026-10-11: "dark mode should
 * work"). There is no "auto": a stored 'auto' is Light (`appliedTheme`, app/_components/theme-bootstrap-script.ts).
 *
 * Pure on purpose — no React, no DOM — so `lib/appearance-control.test.ts` runs the real sequence:
 *   1. the page changes AT ONCE (`setMode`: the class on <html>, the browser bar, this device's cookie);
 *   2. the choice is saved to the account (`users.theme_preference`, through the profile's existing action);
 *   3. if the save fails, step 1 is UNDONE and the caller is told — a page left dark over an account that still
 *      says light would look saved and be gone on the next device, with nothing on screen saying so.
 */
import { appliedTheme, type AppliedTheme } from '@/app/_components/theme-bootstrap-script';

export const APPEARANCE_OPTIONS = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
] as const;

export type AppearanceOutcome = { saved: boolean; theme: AppliedTheme };

export async function chooseAppearance(
  next: string,
  deps: {
    /** What the page is drawn in now — where a failed save returns to. */
    current: AppliedTheme;
    setMode: (theme: AppliedTheme) => void;
    /** The profile's `updateThemePreference` server action. */
    action: (formData: FormData) => Promise<void>;
  },
): Promise<AppearanceOutcome> {
  const chosen = appliedTheme(next);
  if (chosen === deps.current) return { saved: true, theme: chosen };
  deps.setMode(chosen);
  try {
    const formData = new FormData();
    formData.set('theme', chosen);
    await deps.action(formData);
    return { saved: true, theme: chosen };
  } catch {
    deps.setMode(deps.current);
    return { saved: false, theme: deps.current };
  }
}
