/**
 * prefill-consumers.ts — which jobs actually get their answers READ.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The search box can gather answers for any of the 185 form-driven jobs and
 * navigate to `?admin_ask=<job>&aa_<field>=<value>`. Reading those params back
 * is per-page work, and measured over the shipped tree exactly ONE page does
 * it — the taxonomy studio — for exactly ONE job.
 *
 * So for 184 of 185 jobs the box was asking up to eight questions, promising
 * on screen that *"the page opens with this filled in"*, and then opening a
 * page that never looked. The admin retyped everything, with no error and
 * nothing to blame. **A promise nothing keeps is the failure this console has
 * paid for repeatedly — a gate with no handle, in a new costume.**
 *
 * 🔑 THIS LIST IS NOT TRUSTED — IT IS CHECKED. `prefill-consumers.test.ts`
 * scans every admin page for code that compares the ask marker against a job
 * name and fails if the scanned set and this set differ in EITHER direction.
 * A page that starts consuming a job without being registered fails; a name
 * left here after its reader is deleted fails too. A hand-enumerated list is a
 * list of the things somebody thought of; this one has to agree with the tree.
 */

/**
 * Job names whose answers a destination page actually reads back.
 *
 * Add a name here ONLY together with the code that reads it — the guard
 * derives the truth from the pages themselves.
 */
export const PREFILL_CONSUMER_JOBS: readonly string[] = ['createCanonicalLeaf'];

const CONSUMERS = new Set(PREFILL_CONSUMER_JOBS);

/**
 * Will this job's answers be read when the page opens?
 *
 * `false` is not a failure — it means the honest thing to show is the page and
 * the list of what its form will ask for, rather than a questionnaire whose
 * answers go nowhere.
 */
export function jobPrefillIsRead(jobName: string): boolean {
  return CONSUMERS.has(jobName);
}
