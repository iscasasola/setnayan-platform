'use client';

import { useTransition } from 'react';
import { Sun, Moon, Smartphone } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/app/_components/theme-provider';
import { updateThemePreference } from '../actions';

/**
 * Theme mode picker — 3 cards (Light · Dark · Auto).
 *
 * WHY: Brand pivot 2026-05-22 (CLAUDE.md decision-log). Replaces the
 * 5-swatch theme picker (Setnayan Default · Victorian · Classy · iOS ·
 * Forest Theme) with the iOS-style 3-mode pattern. Owner directive: "make
 * our default color be like facebook white and blue. and remove the
 * personalization of colors. It will be light, dark, auto. just like ios".
 *
 * BEHAVIOR
 *   - Clicking a card applies the mode IMMEDIATELY via `useTheme().setMode`
 *     (updates `html.dark` class + localStorage).
 *   - In parallel, a server action persists `users.theme_preference` so the
 *     mode survives a localStorage wipe (different browser, private mode,
 *     etc.). The server action is wrapped in `useTransition` so the click
 *     stays responsive.
 *   - The localStorage write is the source of truth client-side; the DB
 *     write is the durable backup. The FOUC bootstrap script in layout.tsx
 *     reads localStorage on cold load — DB read only happens server-side
 *     for the initial mode prop on Providers.
 */

type Mode = {
  key: ThemeMode;
  label: string;
  caption: string;
  Icon: typeof Sun;
};

const MODES: Mode[] = [
  {
    key: 'light',
    label: 'Light',
    caption: 'Facebook white + blue. Bright always.',
    Icon: Sun,
  },
  {
    key: 'dark',
    label: 'Dark',
    caption: 'Easier on the eyes after sundown.',
    Icon: Moon,
  },
  {
    key: 'auto',
    label: 'Auto',
    caption: 'Matches your device — light by day, dark at night.',
    Icon: Smartphone,
  },
];

export function ThemeModePicker({ initialMode }: { initialMode: ThemeMode }) {
  const { mode, setMode } = useTheme();
  const [isPending, startTransition] = useTransition();

  // `mode` from useTheme is the client-authoritative state; `initialMode`
  // is the SSR-resolved DB value. They agree after hydration; we use
  // `mode` so the active card flips instantly on click.
  const active = mode ?? initialMode;

  const handlePick = (next: ThemeMode) => {
    if (next === active) return;
    // 1. Apply locally first — instant visual feedback.
    setMode(next);
    // 2. Persist to DB in the background. Failures are swallowed; the
    //    localStorage write already succeeded so the user's choice survives
    //    the current session even if the DB write loses.
    startTransition(() => {
      const fd = new FormData();
      fd.set('theme', next);
      updateThemePreference(fd).catch(() => {
        // Silent — user's mode is already applied client-side.
      });
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {MODES.map(({ key, label, caption, Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handlePick(key)}
            disabled={isActive || isPending}
            aria-pressed={isActive}
            className={`group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
              isActive
                ? 'border-terracotta bg-terracotta/10'
                : 'border-ink/10 bg-cream hover:border-terracotta/50'
            } disabled:cursor-default`}
          >
            <span
              aria-hidden
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'bg-terracotta text-cream'
                  : 'bg-ink/5 text-ink/70 group-hover:bg-terracotta/15 group-hover:text-terracotta'
              }`}
            >
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{label}</span>
                {isActive ? (
                  <span className="rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
                    Active
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-ink/55">{caption}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
