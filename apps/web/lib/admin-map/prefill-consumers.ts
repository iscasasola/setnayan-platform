/**
 * prefill-consumers.ts — which jobs actually get their answers READ.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The search box can gather answers for any of the 185 form-driven jobs and
 * navigate to `?admin_ask=<job>&aa_<field>=<value>`. Reading those params back
 * is per-page work, and measured over the shipped tree TWO jobs are wired, both
 * on the taxonomy studio. The other 183 are not, and the box says so.
 *
 * Before this registry existed the box asked up to eight questions for any of
 * them, promised on screen that *"the page opens with this filled in"*, and
 * then opened a page that never looked. The admin retyped everything, with no
 * error and nothing to blame. **A promise nothing keeps is the failure this
 * console has paid for repeatedly — a gate with no handle, in a new costume.**
 *
 * 🔴 AND THE FIRST CUT REGISTERED THE WRONG JOB FOR THE OWNER'S OWN SENTENCE.
 * `createCanonicalLeaf` was wired and described in three files as *"the job
 * behind the box's own flagship example"*. It is not. The owner typed **"add a
 * new category on the taxonomy service"**, and a CATEGORY is a node under a
 * parent — `createTaxonomyNode`. `createCanonicalLeaf` adds a SERVICE inside a
 * category that already exists: a different act, on a different form. So the
 * one sentence this whole feature was built for asked its two questions and
 * threw both away, while every guard stayed green because the job that WAS
 * wired was wired correctly. **Naming the flagship wrongly is how a feature
 * comes to be complete for everything except the case it exists for.**
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
export const PREFILL_CONSUMER_JOBS: readonly string[] = [
  /** Add a CATEGORY (a tile under a parent folder) — the owner's own sentence. */
  'createTaxonomyNode',
  /** Add a SERVICE inside a category that already exists. */
  'createCanonicalLeaf',

  // ── The generic reader (app/admin/taxonomy/_components/prepared-jobs.ts) ───
  //
  // Twenty-two more jobs on the same page, served by ONE table + ONE card
  // rather than twenty-two hand-written effects. Every name below is a
  // `preparedJob('<name>', …)` entry, and the guard scans for exactly that
  // call — so a name here without its descriptor fails, and a descriptor
  // deleted while the name stays fails too.
  //
  // Nineteen of that page's jobs are still absent ON PURPOSE — destructive
  // ones, ones that post a list the generator cannot see, ones whose form
  // identity is a bound argument. `prepared-jobs.ts` records each reason and
  // its own guard derives the destructive and list-posting rules from the
  // code rather than trusting the prose.
  'createEventTypeRoster',
  'createFaithVocab',
  'mapCategoryRequest',
  'promoteCategoryRequest',
  'relabelEventTypeVocab',
  'relabelFaithVocab',
  'remapCanonical',
  'renameTaxonomyNode',
  'reorderEventTypeVocab',
  'reorderFaithVocab',
  'resolveCategoryRequest',
  'setCategoryHidden',
  'setCategoryIcon',
  'setEventTypeLaunch',
  'setEventTypeVocabStatus',
  'setFaithLaunchStatus',
  'setFaithLaunchThreshold',
  'setFaithVocabStatus',
  'setServiceFaith',
  'setServiceFlag',
  'unretireEventTypeVocab',
  'updateEventTypePresentation',
];

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
