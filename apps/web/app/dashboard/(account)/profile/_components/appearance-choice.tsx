'use client';

/**
 * Appearance — Light · Dark, ONE dropdown (owner 2026-10-07 "keep it simple and have our
 * light/dark theme"; 2026-10-11 "dark mode should work"). It sits in Preferences with the other
 * settings: no page of its own, no tour.
 *
 * The page changes the moment a choice is picked; the choice is then saved to the account so the
 * person's other devices follow (`ThemeFromAccount` in the signed-in layouts). What happens, in
 * order, and what a failed save does, is `chooseAppearance` (lib/appearance.ts).
 *
 * `stored` is the account's saved value, read on the server, so the button says the right word in
 * the first HTML. After that the provider is the truth: it holds what is actually drawn.
 */
import { useEffect, useState, useTransition } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useTheme } from '@/app/_components/theme-provider';
import type { AppliedTheme } from '@/app/_components/theme-bootstrap-script';
import { APPEARANCE_OPTIONS, chooseAppearance } from '@/lib/appearance';
import { updateThemePreference } from '../actions';

export function AppearanceChoice({ stored }: { stored: AppliedTheme }) {
  const { resolvedTheme, setMode } = useTheme();
  const [shown, setShown] = useState<AppliedTheme>(stored);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  // After hydration the provider knows what this page is really drawn in.
  useEffect(() => setShown(resolvedTheme), [resolvedTheme]);

  function pick(key: string) {
    setFailed(false);
    startTransition(async () => {
      const outcome = await chooseAppearance(key, { current: shown, setMode, action: updateThemePreference });
      setShown(outcome.theme);
      setFailed(!outcome.saved);
    });
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:justify-between" data-setting-appearance={shown}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">Appearance</p>
        <p className="mt-0.5 text-xs text-ink/60">Light or Dark. Your Event Hub keeps the look you gave it.</p>
        {failed ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            That did not save. Please try again.
          </p>
        ) : null}
      </div>
      <PickMenu label="Appearance" value={shown} options={APPEARANCE_OPTIONS} onPick={pick} dataAttr="data-appearance-pick" className="shrink-0 self-start sm:self-auto" />
    </div>
  );
}
