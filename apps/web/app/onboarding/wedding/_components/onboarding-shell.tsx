'use client';

/**
 * OnboardingShell — the chrome that holds the V2 wedding-onboarding state +
 * step routing + Brand bar + Back / Skip / Continue CTAs.
 *
 * Architecture (locked):
 *   - Single client component owns the OnboardingState
 *   - Hydrates from localStorage on mount (resume) and saves on every update
 *   - Per-screen content is presentational — each Screen* component accepts
 *     `value` + `onChange` callbacks, never touches localStorage itself
 *   - goNext() handles step transitions including the Civil-skip-faith rule
 *     (kind=civil → jump from screen 2 straight to screen 4, bypassing faith)
 *   - Golden Rules: no scrolling (fixed-height shell, viewzone fills),
 *     brand always visible (top bar), preloaded (no route-prefetch needed
 *     — the whole flow lives in this one client component, instant step
 *     transitions via state toggle)
 *
 * Phase 1 ships screens 0-3 (Welcome · Role · Kind · Faith). Phase 2 extends
 * this file with screens 4-8 by adding entries to SCREEN_SEQUENCE in
 * ../types.ts + new Screen* imports.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wordmark } from '@/app/_components/brand-marks';
import {
  EMPTY_ONBOARDING_STATE,
  ONBOARDING_DRAFT_KEY,
  ONBOARDING_DRAFT_TTL_DAYS,
  SCREEN_SEQUENCE,
  type OnboardingState,
} from '../types';
import { ScreenWelcome } from './screens/welcome';
import { ScreenRole } from './screens/role';
import { ScreenKind } from './screens/kind';
import { ScreenFaith } from './screens/faith';

/** localStorage hydration — returns null if stale / corrupt / missing. */
function loadDraft(): OnboardingState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    if (!parsed || typeof parsed !== 'object') return null;
    // TTL check — drop drafts older than ONBOARDING_DRAFT_TTL_DAYS
    if (parsed.lastSavedAt) {
      const savedAt = new Date(parsed.lastSavedAt).getTime();
      if (!Number.isNaN(savedAt)) {
        const ageDays = (Date.now() - savedAt) / 86_400_000;
        if (ageDays > ONBOARDING_DRAFT_TTL_DAYS) {
          window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
          return null;
        }
      }
    }
    // Merge with EMPTY shape so missing fields stay defaulted (forward-compat
    // as Phase 2-4 add new fields to OnboardingState)
    return { ...EMPTY_ONBOARDING_STATE, ...parsed };
  } catch {
    return null;
  }
}

/** Save the current draft to localStorage (best-effort, never throws). */
function saveDraft(state: OnboardingState) {
  if (typeof window === 'undefined') return;
  try {
    const withTimestamp = { ...state, lastSavedAt: new Date().toISOString() };
    window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(withTimestamp));
  } catch {
    // Storage quota / private mode — silently skip; state still lives in React
  }
}

export function OnboardingShell() {
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Mount — restore draft if present
  useEffect(() => {
    const draft = loadDraft();
    if (draft) setState(draft);
    setHydrated(true);
  }, []);

  // Save on every state change (after hydration so we don't overwrite a fresh load)
  useEffect(() => {
    if (!hydrated) return;
    saveDraft(state);
  }, [state, hydrated]);

  const update = useCallback(<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const totalScreens = SCREEN_SEQUENCE.length;
  const progressPct = useMemo(
    () => Math.max(0, Math.min(100, Math.round(((state.step + 1) / totalScreens) * 100))),
    [state.step, totalScreens]
  );

  /**
   * goNext — advance one step, with the Civil-skip-faith rule:
   * if leaving Kind (step 2) AND kind=civil, skip the Faith screen (step 3)
   * and land on the next screen (which Phase 2 will fill — Phase 1 lands on
   * a "Phase 2 coming" placeholder).
   */
  const goNext = useCallback(() => {
    setState((s) => {
      let target = s.step + 1;
      // Civil skips faith
      if (s.step === 2 && s.kind === 'civil') target = s.step + 2;
      return { ...s, step: Math.min(totalScreens - 1, target) };
    });
  }, [totalScreens]);

  /**
   * goBack — reverse, mirror Civil-skip (faith was never shown, so back
   * from screen 4 with kind=civil lands on Kind, not Faith).
   */
  const goBack = useCallback(() => {
    setState((s) => {
      // Re-entering faith would be wrong if kind=civil; jump back to Kind
      let target = s.step - 1;
      if (target === 3 && s.kind === 'civil') target = 2;
      return { ...s, step: Math.max(0, target) };
    });
  }, []);

  /** Skip current screen — moves forward without writing. Defer is the path. */
  const goSkip = goNext;

  // Whether the current screen's primary CTA is enabled
  const canContinue = useMemo(() => {
    if (!hydrated) return false;
    switch (state.step) {
      case 0: return true;                       // Welcome — always free to advance
      case 1: return state.role !== null;        // Role — needs a pick
      case 2: return state.kind !== null;        // Kind — needs a pick
      case 3:                                    // Faith — depends on kind
        if (state.kind === 'religious') return state.faith.length === 1;
        if (state.kind === 'mixed') return state.faith.length >= 1 && state.faith.length <= 2;
        return true;                             // civil = skipped, but defensive: always allow
      default: return true;
    }
  }, [hydrated, state.step, state.role, state.kind, state.faith]);

  // Continue button label per screen
  const continueLabel = useMemo(() => {
    if (state.step === 0) return "Let's go";
    return 'Continue';
  }, [state.step]);

  // Hide Back on screen 0; hide Skip on Welcome too (no defer of the welcome)
  const showBack = state.step > 0;
  const showSkip = state.step > 0;

  // Render the active screen
  const screen = SCREEN_SEQUENCE[state.step];
  let body: React.ReactNode = null;
  if (!hydrated) {
    // Avoid SSR/CSR flash — render nothing until localStorage is read
    body = null;
  } else if (screen === 'welcome') {
    body = <ScreenWelcome />;
  } else if (screen === 'role') {
    body = (
      <ScreenRole
        value={state.role}
        onChange={(v) => update('role', v)}
      />
    );
  } else if (screen === 'kind') {
    body = (
      <ScreenKind
        value={state.kind}
        onChange={(v) => {
          // When kind flips, clear faith picks that no longer match the new rules
          setState((s) => ({ ...s, kind: v, faith: [] }));
        }}
      />
    );
  } else if (screen === 'faith') {
    body = (
      <ScreenFaith
        kind={state.kind}
        value={state.faith}
        onChange={(v) => update('faith', v)}
      />
    );
  } else {
    // Past Phase 1 — placeholder until Phase 2 ships
    body = (
      <div className="flex flex-col items-center justify-center gap-3 px-6 text-center text-ink/70">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">PHASE 2 COMING</p>
        <p className="font-serif italic text-xl text-ink">
          The rest of your plan unlocks next week.
        </p>
        <p className="text-sm">
          You&apos;re all set on the basics — date, region, guest count, and budget land
          in the next update.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-cream text-ink">
      {/* Brand top bar — Wordmark + progress + Back (left) + Skip (right) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur">
        {showBack ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition hover:bg-ink/5 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="h-9 w-9" aria-hidden="true" />
        )}
        <Wordmark className="h-5 flex-1" />
        {showSkip ? (
          <button
            type="button"
            onClick={goSkip}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55 transition hover:text-ink"
          >
            Skip
          </button>
        ) : (
          <span className="w-10" aria-hidden="true" />
        )}
      </header>

      {/* Progress bar — sticks under the brand bar */}
      <div
        className="sticky top-[57px] z-20 h-[2px] w-full bg-ink/5"
        aria-hidden="true"
      >
        <div
          className="h-full bg-[var(--m-orange,#C5A059)] transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Screen body — fills the gap, Golden Rule 1 (no scroll) for short screens */}
      <main className="flex flex-1 flex-col">{body}</main>

      {/* Bottom CTA — full-width primary, mulberry */}
      <footer className="sticky bottom-0 z-20 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={goNext}
          disabled={!canContinue}
          className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--m-mulberry,#5C2542)] px-6 text-sm font-semibold uppercase tracking-[0.15em] text-cream transition hover:bg-[var(--m-mulberry-2,#4A1D36)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  );
}
