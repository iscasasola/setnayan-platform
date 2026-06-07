'use client';

/**
 * LoaderOverlayProvider + useLoader() — the app-wide blocking loader overlay.
 *
 * Mount once near the root (it lives in app/providers.tsx). Any client
 * component can then call `useLoader()` to throw up a full-viewport branded
 * <SDLoader> for a blocking action — sign-in, a heavy submit, a generation
 * flow — and call `complete()` for the "Ready ✓" beat before it auto-dismisses.
 *
 *   const { show, complete, hide } = useLoader();
 *   show({ steps: LOADER_STEPS.signin, hint: 'Signing in' });
 *   // ...when the work resolves:
 *   complete();           // ring draws → holds ~850ms → fades out
 *   // ...or to dismiss without the success beat:
 *   hide();
 *
 * Route-level loading (the 158 `loading.tsx` skeletons) and per-section
 * fallbacks do NOT go through here — they render <SDLoader> (or a skeleton)
 * directly. This overlay is only for blocking, screen-covering moments.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SDLoader } from './sd-loader';

/** How long the "Ready ✓" state breathes before the overlay fades out. */
const COMPLETE_HOLD_MS = 850;

type ShowOptions = {
  steps?: readonly string[];
  hint?: string;
  doneLabel?: string;
  theme?: 'light' | 'dark';
};

type LoaderState = ShowOptions & { active: boolean; done: boolean };

type LoaderContextValue = {
  /** Show the overlay (resets any prior completion state). */
  show: (opts?: ShowOptions) => void;
  /** Enter the success state, then auto-hide after the hold. */
  complete: () => void;
  /** Hide immediately without the success beat. */
  hide: () => void;
};

const LoaderContext = createContext<LoaderContextValue | null>(null);

export function useLoader(): LoaderContextValue {
  const ctx = useContext(LoaderContext);
  if (!ctx) {
    throw new Error('useLoader must be used within <LoaderOverlayProvider>');
  }
  return ctx;
}

export function LoaderOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<LoaderState>({ active: false, done: false });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const show = useCallback(
    (opts?: ShowOptions) => {
      clearHideTimer();
      setState({ active: true, done: false, ...opts });
    },
    [clearHideTimer],
  );

  const hide = useCallback(() => {
    clearHideTimer();
    setState((s) => ({ ...s, active: false, done: false }));
  }, [clearHideTimer]);

  const complete = useCallback(() => {
    clearHideTimer();
    setState((s) => (s.active ? { ...s, done: true } : s));
    hideTimer.current = setTimeout(() => {
      setState((s) => ({ ...s, active: false, done: false }));
      hideTimer.current = null;
    }, COMPLETE_HOLD_MS);
  }, [clearHideTimer]);

  const value = useMemo(
    () => ({ show, complete, hide }),
    [show, complete, hide],
  );

  return (
    <LoaderContext.Provider value={value}>
      {children}
      {state.active ? (
        <div className="sd-overlay" data-done={state.done || undefined}>
          <SDLoader
            steps={state.steps}
            hint={state.hint}
            doneLabel={state.doneLabel}
            theme={state.theme ?? 'light'}
            done={state.done}
          />
        </div>
      ) : null}
    </LoaderContext.Provider>
  );
}
