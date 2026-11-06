/**
 * The steps a spotlight run walks: the FIRST run every one; a replay ("Show me around") without the once-only
 * welcome (owner 2026-10-21, prototype first_run_you_and_next_steps P4 — `SpotlightStep.welcome` in lib/tours.ts).
 * Its own file, importing only a type, so the client mount (`spotlight-mount.tsx`) can use it while every tour's
 * words stay on the server (`lib/tours-stay-on-the-server.test.ts`).
 */
import type { SpotlightStep } from './tours';

export function spotlightSteps(steps: ReadonlyArray<SpotlightStep>, firstRun: boolean): ReadonlyArray<SpotlightStep> {
  return firstRun ? steps : steps.filter((s) => !s.welcome);
}
