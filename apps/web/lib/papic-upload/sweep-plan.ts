// lib/papic-upload/sweep-plan.ts — what the upload sweep does with ONE
// never-recorded intent (lib/papic-upload-sweep.ts). Pure: every effect is
// injected, so the rule is tested by running it, not by reading it.
//
// 🛡 Guard A (corpus Papic_Storage_Sustainability_Spec_2026-07-22): an
// attempt's FINAL copy is deleted only when no capture row points at it, and a
// reference check that cannot be read counts as "pointed at" (fail closed).
// The staging upload is never pointed at by a row, so it always goes.
//
// The outcome is 'forget' (both pieces gone — the intent row is deleted) or
// 'set_aside' (something was refused — the row is marked so the next batch
// moves past it instead of reading the same head forever; review 2026-10-23,
// major 6).

export interface SweepPlanDeps {
  deleteStaging: () => Promise<'deleted' | 'refused'>;
  /** true when a capture row points at the ref — or when that cannot be read. */
  isReferenced: (ref: string) => Promise<boolean>;
  deleteFinal: (ref: string) => Promise<'deleted' | 'refused'>;
}

export type SweepOutcome = 'forget' | 'set_aside';

export async function sweepUnsettledIntent(
  finalRef: string | null,
  deps: SweepPlanDeps,
): Promise<SweepOutcome> {
  try {
    const staging = await deps.deleteStaging();
    if (staging !== 'deleted') return 'set_aside';
    if (finalRef && !(await deps.isReferenced(finalRef))) {
      if ((await deps.deleteFinal(finalRef)) !== 'deleted') return 'set_aside';
    }
    return 'forget';
  } catch {
    return 'set_aside';
  }
}
