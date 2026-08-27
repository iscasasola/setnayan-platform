/**
 * prepared-jobs.ts — ONE reader for many of the taxonomy page's jobs.
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────
 * The admin search box can gather a job's answers and navigate to
 * `?admin_ask=<job>&aa_<field>=<value>`. Reading those answers back is
 * per-page work, and until now the taxonomy studio read exactly TWO jobs
 * (`createTaxonomyNode` · `createCanonicalLeaf`), each with its own hand-written
 * effect and its own hand-written form. Measured on the shipped tree, this page
 * hosts **43 form-driven jobs**, so 41 of them gathered answers and threw them
 * away — the box asked, the admin answered, the page never looked.
 *
 * Writing 41 more bespoke effects would be 41 more chances to forget one. This
 * file is the generic half instead: a TABLE of job → what its form needs, and a
 * resolver that turns the admin's WORDS into real values. `prepared-job-card.tsx`
 * renders one card from a table entry, posting the REAL server action.
 *
 * 🔒 IT PREPARES, IT NEVER PRESSES. Every entry renders a real `<form action=…>`
 * whose values are `defaultValue`s the admin can edit. Nothing happens until
 * THEY press. That is the one-person admin plan (owner-locked 2026-07-11) and it
 * is asserted, not assumed.
 *
 * 🔑 A MISS IS SAID OUT LOUD, NEVER GUESSED. The box only ever holds the words
 * somebody typed — it has no ids. A `choice` field is resolved against the real
 * catalog; when nothing matches, the value is left EMPTY and the words are
 * reported on screen. Silently filing a category under the wrong folder is far
 * worse than one more question, and that posture is copied from the shipped
 * category reader rather than reinvented.
 *
 * ── WHAT IS DELIBERATELY *NOT* HERE, AND WHY ────────────────────────────────
 * Nineteen of the 41 are left alone on purpose. Each reason is a measurement,
 * not a shrug:
 *
 *  · **DESTRUCTIVE (5)** — `deleteTaxonomyNode` · `clearLastMinuteStart` ·
 *    `retireEventTypeVocab` · `retireLeafAttributeFieldAction` ·
 *    `retireLeafAttributeOptionAction`. A prepared card puts an irreversible act
 *    ONE PRESS away from a record resolved out of typed words. The studio's own
 *    delete goes through a confirmation with a destination picker; replacing
 *    that with a pre-filled button is a safety regression, not a feature.
 *    `prepared-jobs.test.ts` derives this rule from the generated `destructive`
 *    flag, so a job that BECOMES destructive fails rather than sliding through.
 *
 *  · **THEY POST A LIST, AND A PREPARED FORM WOULD WIPE IT (3)** —
 *    `setCategoryEventTypes` · `setFolderEventTypes` · `setServiceSecondaryTiles`.
 *    Each reads `formData.getAll('…')` for its real payload, and that read is
 *    INVISIBLE to the job generator, which records only single-value fields. A
 *    card posting the generated field list alone would submit an EMPTY list —
 *    turning an event-scoped tile universal, or clearing a service's
 *    cross-listing — reporting success the whole way. The guard derives this set
 *    by looking for `getAll(` in the action body rather than trusting this
 *    paragraph.
 *
 *  · **THE FORM'S IDENTITY IS A BOUND ARGUMENT (3)** — `addRefinementOption` ·
 *    `updateRefinementLeaf` · `updateRefinementOption` are rendered as
 *    `action={fn.bind(null, leaf.leafKey)}`, so which leaf they edit is not a
 *    posted field at all. A standalone card cannot post them correctly.
 *
 *  · **THE BOX NEVER ASKS WHICH SERVICE (3)** — `addLeafAttributeFieldAction` ·
 *    `addLeafAttributeOptionAction` · `relabelLeafAttributeFieldAction` all
 *    require `canonical_service`, read inside the shared
 *    `applyLeafAttributeMutation` helper. The generator scans the ACTION, not
 *    the helpers it delegates to, so that field is missing from the job's field
 *    list and the box never asks for it. Wiring them would produce a card that
 *    is always half-empty. **The generator's blind spot is the real defect and
 *    is reported, not patched here** — it spans all 185 jobs, not these three.
 *
 *  · **IT WOULD BE THE ONLY DOOR (2)** — `createEventTypeVocab` ·
 *    `moveTaxonomyNode` are rendered by no form anywhere on this page. Giving
 *    them one is a product change, not prefill wiring.
 *
 *  · **THE PAGE DOES NOT HOLD THE LIST (2)** — `setLastMinuteStart` ·
 *    `updatePlanningDeadline` name records (`ref_key` · `deadline_id`) the
 *    studio is never handed, so there is nothing to resolve against and nothing
 *    to offer as a picker. Filling them would be guessing.
 *
 *  · **YOU CANNOT TYPE A PHOTOGRAPH (1)** — `setCategoryPhoto` takes an upload
 *    reference produced by the file picker.
 *
 * 22 wired + 2 already shipped = 24 of this page's 43.
 */

import { askParamKey } from '@/lib/admin-map/humanize-field';

// ── Catalogs ─────────────────────────────────────────────────────────────────

/**
 * The real lists a `choice` field resolves against. Every one of these is data
 * the studio ALREADY receives as a prop — nothing new is fetched, so a prepared
 * card can never be more or less current than the page around it.
 */
export type PreparedCatalogKey =
  | 'eventType'
  | 'faith'
  | 'tile'
  /** Folders AND tiles — both are taxonomy nodes and both can be renamed. */
  | 'node'
  | 'service'
  | 'request'
  | 'icon';

export type PreparedOption = { value: string; label: string };

export type PreparedCatalogs = Record<PreparedCatalogKey, readonly PreparedOption[]>;

// ── Field descriptors ────────────────────────────────────────────────────────

export type PreparedField =
  /** Free text the admin typed — carried through verbatim. */
  | { field: string; kind: 'text'; label: string; hint?: string; multiline?: boolean }
  /** Names an existing record. Resolved against a catalog; a miss stays empty. */
  | { field: string; kind: 'choice'; label: string; from: PreparedCatalogKey; allowEmpty?: boolean; emptyLabel?: string }
  /** One of a closed set the action itself validates. */
  | { field: string; kind: 'pick'; label: string; options: readonly PreparedOption[] }
  /**
   * Internal plumbing (which view to return to). Carried HIDDEN and verbatim —
   * never shown, never discarded. Dropping it would re-create in miniature the
   * bug this whole feature exists to fix: an answer gathered and binned.
   */
  | { field: string; kind: 'carry' };

export type PreparedJobSpec = {
  /** The button the admin presses. Names the act, so nothing is ambiguous. */
  verb: string;
  /** One line saying what pressing it will do. */
  summary: string;
  fields: readonly PreparedField[];
};

/**
 * Declare one prepared job.
 *
 * 🔑 THIS CALL *IS* THE READER. `prefill-consumers.test.ts` scans the admin tree
 * for `preparedJob('<name>'` and requires the registry to match what it finds,
 * so a name cannot be registered without the descriptor that makes it work, and
 * a descriptor cannot be deleted while the box still promises the fill.
 */
export function preparedJob(name: string, spec: PreparedJobSpec): [string, PreparedJobSpec] {
  return [name, spec];
}

// ── Closed value sets, copied from the actions that validate them ────────────

const YES_NO = (yes: string, no: string): readonly PreparedOption[] => [
  { value: '1', label: yes },
  { value: '0', label: no },
];
const UP_DOWN: readonly PreparedOption[] = [
  { value: 'up', label: 'Move up' },
  { value: 'down', label: 'Move down' },
];
/** `LAUNCH_STATUSES` in lib/wedding-types-mutations.ts. */
const LAUNCH: readonly PreparedOption[] = [
  { value: 'active', label: 'Live for couples' },
  { value: 'coming_soon', label: 'Coming soon' },
  { value: 'disabled', label: 'Switched off' },
];
/** `SERVICE_BOOLEAN_FLAGS` in ../actions.ts. */
const SERVICE_FLAGS: readonly PreparedOption[] = [
  { value: 'is_tradition', label: 'Cultural / tradition' },
  { value: 'is_ph', label: 'PH-specific' },
  { value: 'is_rental', label: 'Rental' },
  { value: 'marketplace_hidden', label: 'Hidden from marketplace' },
];
const REQUEST_OUTCOME: readonly PreparedOption[] = [
  { value: 'kept_private', label: 'Keep it private' },
  { value: 'rejected', label: 'Reject it' },
];

// ── The table ────────────────────────────────────────────────────────────────

/**
 * Every job on this page whose answers the studio now reads back.
 *
 * The field list of each entry must equal the job's GENERATED field list —
 * `prepared-jobs.test.ts` compares the two in both directions, so an action that
 * grows a field fails here instead of silently dropping that answer, which is
 * the shape of the original bug one size smaller.
 */
export const PREPARED_TAXONOMY_JOBS: ReadonlyMap<string, PreparedJobSpec> = new Map([
  // ── Event-type vocabulary ────────────────────────────────────────────────
  preparedJob('relabelEventTypeVocab', {
    verb: 'Rename event type',
    summary: 'Renames what couples read. The key behind it never changes.',
    fields: [
      { field: 'event_type', kind: 'choice', label: 'Which event type', from: 'eventType' },
      { field: 'label_en', kind: 'text', label: 'New name' },
    ],
  }),
  preparedJob('setEventTypeVocabStatus', {
    verb: 'Save',
    summary: 'An inactive type can no longer be used to scope tiles and services.',
    fields: [
      { field: 'event_type', kind: 'choice', label: 'Which event type', from: 'eventType' },
      { field: 'active', kind: 'pick', label: 'Active?', options: YES_NO('Active', 'Not active') },
    ],
  }),
  preparedJob('setEventTypeLaunch', {
    verb: 'Save',
    summary: 'Shows or hides this type in the picker couples use to create an event.',
    fields: [
      { field: 'event_type', kind: 'choice', label: 'Which event type', from: 'eventType' },
      { field: 'enabled', kind: 'pick', label: 'Show in picker?', options: YES_NO('Show it', 'Hide it') },
    ],
  }),
  preparedJob('unretireEventTypeVocab', {
    verb: 'Bring it back',
    summary: 'Restores a retired event type.',
    fields: [{ field: 'event_type', kind: 'choice', label: 'Which event type', from: 'eventType' }],
  }),
  preparedJob('reorderEventTypeVocab', {
    verb: 'Move it',
    summary: 'Changes where this type sits in the couple picker.',
    fields: [
      { field: 'event_type', kind: 'choice', label: 'Which event type', from: 'eventType' },
      { field: 'dir', kind: 'pick', label: 'Which way', options: UP_DOWN },
    ],
  }),
  preparedJob('updateEventTypePresentation', {
    verb: 'Save event type',
    summary: 'Edits how this type looks in the couple picker. Its key is permanent.',
    fields: [
      { field: 'event_type', kind: 'choice', label: 'Which event type', from: 'eventType' },
      { field: 'label_en', kind: 'text', label: 'Name' },
      { field: 'emoji', kind: 'text', label: 'Emoji' },
      { field: 'description', kind: 'text', label: 'Tagline', multiline: true },
      { field: 'onboarding_href', kind: 'text', label: 'Onboarding link' },
      { field: 'hero_photo_url', kind: 'text', label: 'Hero photo URL' },
      { field: 'sort_order', kind: 'text', label: 'Sort order', hint: 'A number' },
    ],
  }),
  preparedJob('createEventTypeRoster', {
    verb: 'Create event type',
    // The key is NEW here — createEventTypeCore refuses one that already exists —
    // so it is deliberately free text and never resolved against the catalog.
    summary:
      'Creates a new event type. Keys are permanent, and it stays out of the couple picker until you turn it on.',
    fields: [
      { field: 'event_type', kind: 'text', label: 'New key', hint: 'Lower case, permanent' },
      { field: 'label_en', kind: 'text', label: 'Name' },
      { field: 'emoji', kind: 'text', label: 'Emoji' },
      { field: 'description', kind: 'text', label: 'Tagline', multiline: true },
      { field: 'sort_order', kind: 'text', label: 'Sort order', hint: 'A number' },
    ],
  }),

  // ── Faith vocabulary ─────────────────────────────────────────────────────
  preparedJob('relabelFaithVocab', {
    verb: 'Rename faith',
    summary: 'Renames what couples read. The key behind it never changes.',
    fields: [
      { field: 'faith_key', kind: 'choice', label: 'Which faith', from: 'faith' },
      { field: 'label_en', kind: 'text', label: 'New name' },
    ],
  }),
  preparedJob('setFaithVocabStatus', {
    verb: 'Save',
    summary: 'An inactive faith can no longer be tagged onto services.',
    fields: [
      { field: 'faith_key', kind: 'choice', label: 'Which faith', from: 'faith' },
      { field: 'active', kind: 'pick', label: 'Active?', options: YES_NO('Active', 'Not active') },
    ],
  }),
  preparedJob('reorderFaithVocab', {
    verb: 'Move it',
    summary: 'Changes where this faith sits in the list.',
    fields: [
      { field: 'faith_key', kind: 'choice', label: 'Which faith', from: 'faith' },
      { field: 'dir', kind: 'pick', label: 'Which way', options: UP_DOWN },
    ],
  }),
  preparedJob('setFaithLaunchStatus', {
    verb: 'Save',
    summary: 'Decides whether couples can pick this ceremony type yet.',
    fields: [
      { field: 'faith_key', kind: 'choice', label: 'Which faith', from: 'faith' },
      { field: 'status', kind: 'pick', label: 'Status for couples', options: LAUNCH },
    ],
  }),
  preparedJob('setFaithLaunchThreshold', {
    verb: 'Save threshold',
    summary: 'How many suppliers this faith needs before it is ready to open.',
    fields: [
      { field: 'faith_key', kind: 'choice', label: 'Which faith', from: 'faith' },
      { field: 'threshold', kind: 'text', label: 'Suppliers needed', hint: 'A number' },
    ],
  }),
  preparedJob('createFaithVocab', {
    verb: 'Create faith',
    summary: 'Adds a new faith. Its key is derived from the name and is permanent.',
    fields: [{ field: 'label_en', kind: 'text', label: 'Name' }],
  }),

  // ── Tiles (categories) ───────────────────────────────────────────────────
  preparedJob('renameTaxonomyNode', {
    verb: 'Rename',
    summary: 'Renames a folder or tile. Its address never changes.',
    fields: [
      // FOLDERS TOO, not just tiles. This action renames any taxonomy node, and
      // offering only tiles would leave "rename the Food folder" resolving to
      // nothing with no way to finish the job from the card — a dead end
      // wearing the honest-miss notice.
      { field: 'id', kind: 'choice', label: 'Which folder or tile', from: 'node' },
      { field: 'label_en', kind: 'text', label: 'New name' },
    ],
  }),
  preparedJob('setCategoryHidden', {
    verb: 'Save',
    summary: 'A hidden tile never shows on the marketplace or in onboarding.',
    fields: [
      { field: 'category_id', kind: 'choice', label: 'Which tile', from: 'tile' },
      { field: 'hidden', kind: 'pick', label: 'Hidden?', options: YES_NO('Hide it', 'Show it') },
    ],
  }),
  preparedJob('setCategoryIcon', {
    verb: 'Save icon',
    summary: 'Sets the icon couples see on this tile.',
    fields: [
      { field: 'category_id', kind: 'choice', label: 'Which tile', from: 'tile' },
      { field: 'icon_name', kind: 'choice', label: 'Icon', from: 'icon', allowEmpty: true, emptyLabel: 'No icon' },
    ],
  }),

  // ── Services (canonicals) ────────────────────────────────────────────────
  preparedJob('setServiceFaith', {
    verb: 'Save faith',
    summary: 'Tags a service to one faith, or clears the tag.',
    fields: [
      { field: 'canonical_service', kind: 'choice', label: 'Which service', from: 'service' },
      { field: 'faith', kind: 'choice', label: 'Faith', from: 'faith', allowEmpty: true, emptyLabel: 'No faith' },
    ],
  }),
  preparedJob('setServiceFlag', {
    verb: 'Save',
    summary: 'Turns one of a service’s four marks on or off.',
    fields: [
      { field: 'canonical_service', kind: 'choice', label: 'Which service', from: 'service' },
      { field: 'flag', kind: 'pick', label: 'Which mark', options: SERVICE_FLAGS },
      { field: 'value', kind: 'pick', label: 'On or off', options: YES_NO('On', 'Off') },
    ],
  }),
  preparedJob('remapCanonical', {
    verb: 'Move service',
    summary: 'Moves a service onto a different tile. Its id and address are untouched.',
    fields: [
      { field: 'canonical_service', kind: 'choice', label: 'Which service', from: 'service' },
      { field: 'tile_id', kind: 'choice', label: 'Move it to', from: 'tile' },
      { field: '_view', kind: 'carry' },
    ],
  }),

  // ── Category requests from suppliers ─────────────────────────────────────
  preparedJob('mapCategoryRequest', {
    verb: 'Map it',
    summary: 'Points a supplier’s request at a service that already exists.',
    fields: [
      { field: 'request_id', kind: 'choice', label: 'Which request', from: 'request' },
      { field: 'mapped_to_canonical', kind: 'choice', label: 'Map it to', from: 'service' },
    ],
  }),
  preparedJob('promoteCategoryRequest', {
    verb: 'Promote it',
    summary: 'Turns a supplier’s request into a real service on a tile.',
    fields: [
      { field: 'request_id', kind: 'choice', label: 'Which request', from: 'request' },
      { field: 'tile_id', kind: 'choice', label: 'Put it on', from: 'tile' },
    ],
  }),
  preparedJob('resolveCategoryRequest', {
    verb: 'Resolve it',
    summary: 'Closes a supplier’s request without creating anything.',
    fields: [
      { field: 'request_id', kind: 'choice', label: 'Which request', from: 'request' },
      { field: 'outcome', kind: 'pick', label: 'Outcome', options: REQUEST_OUTCOME },
      { field: 'resolution_note', kind: 'text', label: 'Note', multiline: true },
    ],
  }),
]);

// ── Resolving the admin's words ──────────────────────────────────────────────

/**
 * Turn the WORDS the admin typed into a real value from `options`, or report a
 * miss.
 *
 * 🔑 ONE LADDER, IN ONE PLACE. Exact value → exact label → label contains the
 * words → the words contain the label. The two readers that shipped before this
 * file each grew their own ladder and the two already disagree (one matches ids,
 * the other does not); this is the single copy every new job uses. Those two are
 * deliberately left untouched here — changing how a shipped reader matches is a
 * behaviour change, not a refactor, and both are pinned by their own guards.
 *
 * 🔒 A MISS RETURNS AN EMPTY VALUE. Never the first option, never a best guess.
 * The card prints the words that matched nothing, so a wrong record can only be
 * chosen by a person, on purpose.
 */
export function resolveByWords(
  query: string,
  options: readonly PreparedOption[],
): { value: string; matched: boolean } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { value: '', matched: false };
  /**
   * ⚠ THE LOOSE RUNGS NEED A FLOOR. A closed pick can carry a label as short as
   * "On", and `"turn marketplace_hidden on".includes("on")` is true of a great
   * many sentences that were not about it. Substring matching on one or two
   * characters is not recognition, it is a coin toss dressed as a match — so
   * both loose rungs are held to three characters and anything shorter has to
   * match a value or a label outright.
   */
  const LOOSE_MIN = 3;
  const hit =
    options.find((o) => o.value.toLowerCase() === needle) ??
    options.find((o) => o.label.toLowerCase() === needle) ??
    (needle.length >= LOOSE_MIN
      ? options.find((o) => o.label.toLowerCase().includes(needle))
      : undefined) ??
    options.find(
      (o) => o.label.length >= LOOSE_MIN && needle.includes(o.label.toLowerCase()),
    );
  return hit ? { value: hit.value, matched: true } : { value: '', matched: false };
}

export type PreparedValues = {
  /** field → the value its input opens with. Empty means "unresolved / unasked". */
  values: Record<string, string>;
  /** field → the words that matched nothing, for the on-screen notice. */
  misses: Record<string, string>;
};

/**
 * Read one job's gathered answers off the URL and turn them into what the form
 * opens with.
 *
 * `getParam` is handed in rather than a `URLSearchParams` so this stays pure and
 * runnable in a node test — the studio passes the live search params. The
 * `aa_` prefix is applied HERE, through the shared `askParamKey`, so the param
 * contract has one owner and cannot drift from the box that writes it.
 */
export function buildPreparedValues(
  spec: PreparedJobSpec,
  getParam: (paramKey: string) => string | null,
  catalogs: PreparedCatalogs,
): PreparedValues {
  const values: Record<string, string> = {};
  const misses: Record<string, string> = {};
  for (const f of spec.fields) {
    const raw = (getParam(askParamKey(f.field)) ?? '').trim();
    if (f.kind === 'choice') {
      const resolved = resolveByWords(raw, catalogs[f.from]);
      values[f.field] = resolved.value;
      // Only a NON-EMPTY answer that matched nothing is a miss worth reporting.
      // An unasked field is simply empty, and saying "we could not find ''" is
      // noise that teaches the admin to skim past the times it matters.
      if (raw && !resolved.matched) misses[f.field] = raw;
      continue;
    }
    if (f.kind === 'pick') {
      const resolved = resolveByWords(raw, f.options);
      values[f.field] = resolved.value;
      if (raw && !resolved.matched) misses[f.field] = raw;
      continue;
    }
    values[f.field] = raw;
  }
  return { values, misses };
}
