'use client';

/**
 * useSaveLoader — the one-line way to put a client-handler save behind the
 * app-wide "no touch until saving is complete" veil (owner 2026-07-05, Rule 2).
 *
 * <SubmitButton> already raises the veil automatically for `<form action>`
 * saves. This hook is its counterpart for the ~onClick + useState/useTransition
 * saves that don't go through a form: wrap the async write in `run()` and the
 * branded blocking overlay covers the screen, narrates, and clears with a
 * "Saved ✓" beat — or hides cleanly on error.
 *
 *   const save = useSaveLoader();
 *   // in a click handler:
 *   await save.run(() => updateProfile(data));
 *   // with bespoke copy / no success beat:
 *   await save.run(() => publish(id), { steps: LOADER_STEPS.default, showDone: false });
 *
 * `run()` re-throws so callers keep their own try/catch, toast, and state.
 */

import { useCallback } from 'react';
import { useLoader } from './loader-overlay';
import { LOADER_STEPS } from './loader-steps';

export type SaveLoaderOptions = {
  /** Narration lines. Defaults to LOADER_STEPS.saving. */
  steps?: readonly string[];
  /** Uppercase sublabel. Defaults to 'Saving'. */
  hint?: string;
  /** Completion label for the ✓ beat. Defaults to 'Saved'. */
  doneLabel?: string;
  /** Show the "Saved ✓" beat on success (default) or hide immediately. */
  showDone?: boolean;
};

export function useSaveLoader() {
  const { show, complete, hide } = useLoader();

  const run = useCallback(
    async <T>(fn: () => Promise<T>, opts?: SaveLoaderOptions): Promise<T> => {
      show({
        steps: opts?.steps ?? LOADER_STEPS.saving,
        hint: opts?.hint ?? 'Saving',
        doneLabel: opts?.doneLabel ?? 'Saved',
      });
      try {
        const result = await fn();
        if (opts?.showDone === false) hide();
        else complete();
        return result;
      } catch (err) {
        hide();
        throw err;
      }
    },
    [show, complete, hide],
  );

  return { run };
}
