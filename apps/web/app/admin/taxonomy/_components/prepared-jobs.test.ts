/**
 * prepared-jobs.test.ts — the generic reader must agree with the actions it
 * posts, and must keep out the jobs it is not safe for.
 *
 * `prepared-jobs.ts` is deliberately pure — no JSX, no server-action imports —
 * so unlike the two hand-written readers beside it, this one can be EXECUTED
 * here rather than matched as source. The field lists, the exclusion rules and
 * the resolver are all checked against the code they describe.
 *
 * 🔑 EVERY RULE HERE IS DERIVED, NOT LISTED. The set of destructive jobs comes
 * from the generated `destructive` flag; the set of jobs that post a list comes
 * from reading `actions.ts` for `getAll(`. A hand-typed exclusion list is a list
 * of the things somebody thought of on the day — and this feature has already
 * shipped one flagship wired to the wrong job for exactly that reason.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADMIN_JOBS } from '@/lib/admin-map/admin-jobs.generated';
import { PREFILL_CONSUMER_JOBS } from '@/lib/admin-map/prefill-consumers';
import { askParamKey } from '@/lib/admin-map/humanize-field';
import {
  PREPARED_TAXONOMY_JOBS,
  buildPreparedValues,
  resolveByWords,
  type PreparedCatalogs,
} from './prepared-jobs';

const HERE = dirname(fileURLToPath(import.meta.url));
const actionsSrc = readFileSync(join(HERE, '..', 'actions.ts'), 'utf8');

const byName = new Map(ADMIN_JOBS.map((j) => [j.name, j]));
const prepared = [...PREPARED_TAXONOMY_JOBS.keys()];

/** The body of one exported action, up to the next top-level function. */
function actionBody(name: string): string | null {
  const start = actionsSrc.search(new RegExp(`export async function ${name}\\b`));
  if (start === -1) return null;
  const after = actionsSrc.slice(start + 10);
  const next = after.search(/\nexport (async )?function /);
  return next === -1 ? after : after.slice(0, next);
}

/**
 * Does this action read a MULTI-VALUE field?
 *
 * Whitespace-tolerant on purpose: the real call is written
 * `formData\n  .getAll('event_types')`, and a regex without `\s*` around the dot
 * misses it — which is exactly how the danger below stayed invisible while the
 * job generator recorded the field list as complete.
 */
function postsAList(name: string): boolean {
  const body = actionBody(name);
  return body != null && /formData\s*\.\s*getAll\(/.test(body);
}

// ── The table agrees with the generated jobs ─────────────────────────────────

test('the table is not empty and covers a real share of the page', () => {
  // A floor, so an emptied table cannot quietly pass every test below it.
  assert.ok(
    prepared.length >= 20,
    `only ${prepared.length} prepared jobs — the table shrank; re-measure before lowering this`,
  );
});

test('every prepared job is a real, form-driven job on this page', () => {
  for (const name of prepared) {
    const job = byName.get(name);
    assert.ok(job, `${name} is prepared but is not a known admin job`);
    assert.equal(
      job!.resolvedPath,
      '/admin/taxonomy',
      `${name} is prepared by the taxonomy studio but lives at ${job!.resolvedPath}`,
    );
    assert.ok(job!.fields.length > 0, `${name} has no fields — there is nothing to prepare`);
  }
});

/**
 * 🔑 DERIVED, NEVER LISTED — and in BOTH directions.
 *
 * A field the action reads but the card never renders is an answer gathered and
 * thrown away (the original defect). A field the card renders that the action
 * never reads is a box that does nothing. Either way the admin cannot tell.
 */
test('each descriptor names exactly the fields its action reads', () => {
  for (const name of prepared) {
    const job = byName.get(name)!;
    const declared = PREPARED_TAXONOMY_JOBS.get(name)!.fields.map((f) => f.field).sort();
    assert.deepEqual(
      declared,
      [...job.fields].sort(),
      `${name}: the prepared card and the generated job disagree about the form's fields`,
    );
  }
});

test('a descriptor never names the same field twice', () => {
  for (const name of prepared) {
    const fields = PREPARED_TAXONOMY_JOBS.get(name)!.fields.map((f) => f.field);
    assert.equal(new Set(fields).size, fields.length, `${name} declares a field twice`);
  }
});

test('every prepared job is registered, so the box stops saying the page will not fill it in', () => {
  const registered = new Set(PREFILL_CONSUMER_JOBS);
  for (const name of prepared) {
    assert.ok(registered.has(name), `${name} is prepared but not registered as a prefill consumer`);
  }
});

/**
 * 🪤 THE BOX ONLY ASKS SO MANY QUESTIONS, AND THE CLIFF IS SILENT.
 *
 * The palette asks about the first `MAX_ASK_FIELDS` fields of a job and no
 * more. A prepared job with more fields than that would be offered as
 * "fill in a form", ask about some of them, and open a card whose remaining
 * boxes are blank — with nothing on screen saying why. The cap is read out of
 * the palette's own source rather than copied, so LOWERING it fails here
 * instead of quietly truncating a card.
 */
test('no prepared job asks for more fields than the box will ever gather', () => {
  const paletteSrc = readFileSync(
    join(HERE, '..', '..', '_components', 'admin-command-palette.tsx'),
    'utf8',
  );
  const cap = /const MAX_ASK_FIELDS = (\d+)/.exec(paletteSrc);
  assert.ok(cap, 'MAX_ASK_FIELDS moved in the palette — re-pin this guard rather than guessing a cap');
  const max = Number(cap![1]);
  assert.ok(max > 0, 'the question cap parsed as zero — this guard is proving nothing');
  for (const name of prepared) {
    const count = PREPARED_TAXONOMY_JOBS.get(name)!.fields.length;
    assert.ok(
      count <= max,
      `${name} has ${count} fields but the box only ever asks about ${max} — its card would open part-filled and say nothing`,
    );
  }
});

// ── The exclusions, derived from the code rather than from prose ─────────────

/**
 * 🔒 A PREPARED CARD PUTS ITS BUTTON ONE PRESS AWAY. For a destructive job that
 * button acts on a record resolved out of typed words, with no confirmation and
 * no destination picker — strictly worse than the flow the studio already ships.
 * Derived from the generated flag, so a job that BECOMES destructive fails here
 * instead of quietly keeping its card.
 */
test('no destructive job is ever prepared', () => {
  const destructive = ADMIN_JOBS.filter((j) => j.destructive).map((j) => j.name);
  assert.ok(destructive.length > 0, 'no destructive jobs found at all — the flag or the scan moved');
  for (const name of prepared) {
    assert.ok(
      !destructive.includes(name),
      `${name} is destructive and must not be one press away from a record matched on words`,
    );
  }
});

/**
 * 🚨 A PREPARED FORM POSTING ONLY THE GENERATED FIELDS WOULD WIPE THE LIST.
 *
 * Three actions on this page read `formData.getAll(…)` for their real payload —
 * a tile's event scoping, a folder's scoping, a service's cross-listing — and
 * that read is INVISIBLE to the job generator, which records single-value fields
 * only. A card built from the generated list alone would submit an EMPTY list
 * and report success: an event-scoped tile silently made universal.
 */
test('no job that posts a list is ever prepared', () => {
  const listPosters = ADMIN_JOBS.filter(
    (j) => j.resolvedPath === '/admin/taxonomy' && postsAList(j.name),
  ).map((j) => j.name);
  // A FLOOR. Without it a broken body-extractor finds nothing, the loop below
  // passes vacuously, and the guard reports safety it never checked.
  assert.ok(
    listPosters.length >= 3,
    `only ${listPosters.length} list-posting jobs found — the scan stopped matching, so this guard is proving nothing`,
  );
  for (const name of prepared) {
    assert.ok(
      !listPosters.includes(name),
      `${name} reads a multi-value field the generator cannot see — a prepared card would post an empty list and wipe it`,
    );
  }
});

// ── The resolver ─────────────────────────────────────────────────────────────

const OPTIONS = [
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'birthday', label: 'Birthday party' },
];

test('the ladder matches a value, a label, a partial and a phrase around it', () => {
  assert.equal(resolveByWords('anniversary', OPTIONS).value, 'anniversary');
  assert.equal(resolveByWords('Birthday party', OPTIONS).value, 'birthday');
  assert.equal(resolveByWords('birthday', OPTIONS).value, 'birthday');
  assert.equal(resolveByWords('the Birthday party type', OPTIONS).value, 'birthday');
});

/**
 * 🔒 THE ONE THAT MATTERS. A miss must be EMPTY — never the first option, never
 * a nearest guess. Filing a record against the wrong parent quietly is the harm
 * this whole posture exists to prevent.
 */
test('words that match nothing resolve to nothing', () => {
  const miss = resolveByWords('funeral', OPTIONS);
  assert.equal(miss.value, '', 'an unmatched word was guessed into a real value');
  assert.equal(miss.matched, false);
  assert.equal(resolveByWords('   ', OPTIONS).value, '');
});

/**
 * ⚠ A ONE- OR TWO-LETTER SUBSTRING IS NOT RECOGNITION. Closed picks carry
 * labels as short as "On", and a great many sentences contain those letters
 * without being about that option.
 */
test('a very short label cannot be matched by merely appearing inside a phrase', () => {
  const shortLabels = [
    { value: '1', label: 'On' },
    { value: '0', label: 'Off' },
  ];
  // "on" is a substring of "the second one", and must not win because of it.
  assert.equal(resolveByWords('the second one', shortLabels).value, '');
  // Said outright, it still resolves — the floor only governs the loose rungs.
  assert.equal(resolveByWords('On', shortLabels).value, '1');
  assert.equal(resolveByWords('turn it Off', shortLabels).value, '0');
});

test('a one- or two-letter query cannot pick a record by substring', () => {
  assert.equal(resolveByWords('an', OPTIONS).value, '', 'a two-letter query guessed a whole record');
});

test('the stored value keeps its own casing — only the matching is case-blind', () => {
  const titleCase = [{ value: 'Roman_Catholic', label: 'Roman Catholic' }];
  // faith_key is TITLE-CASE in the database; handing back what the admin typed
  // instead of the stored value would post a key the action refuses.
  assert.equal(resolveByWords('roman catholic', titleCase).value, 'Roman_Catholic');
});

// ── Reading the answers off the URL ──────────────────────────────────────────

const CATALOGS: PreparedCatalogs = {
  eventType: OPTIONS,
  faith: [{ value: 'Roman_Catholic', label: 'Roman Catholic' }],
  tile: [{ value: 'tile-photo', label: 'Photo booths' }],
  node: [
    { value: 'folder-food', label: 'Food' },
    { value: 'tile-photo', label: 'Photo booths' },
  ],
  service: [{ value: 'svc_photo', label: 'Photography' }],
  request: [{ value: 'req-1', label: 'Balloons — Acme' }],
  icon: [{ value: 'Camera', label: 'Camera' }],
};

/**
 * 🔑 RENAMING REACHES FOLDERS TOO. `renameTaxonomyNode` renames any taxonomy
 * node; offering only tiles would leave "rename the Food folder" resolving to
 * nothing, with no way to finish the job from the card — a dead end wearing the
 * honest-miss notice.
 */
test('a folder can be renamed from the card, not just a tile', () => {
  const spec = PREPARED_TAXONOMY_JOBS.get('renameTaxonomyNode')!;
  const out = buildPreparedValues(
    spec,
    paramsFrom({ id: 'Food', label_en: 'Food & drink' }),
    CATALOGS,
  );
  assert.equal(out.values.id, 'folder-food', 'a folder cannot be reached by the rename card');
  assert.equal(out.values.label_en, 'Food & drink');
});

function paramsFrom(raw: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [field, value] of Object.entries(raw)) sp.set(askParamKey(field), value);
  return (key: string) => sp.get(key);
}

test('a resolved answer opens the form on the real value', () => {
  const spec = PREPARED_TAXONOMY_JOBS.get('relabelEventTypeVocab')!;
  const out = buildPreparedValues(
    spec,
    paramsFrom({ event_type: 'Birthday party', label_en: 'Birthdays' }),
    CATALOGS,
  );
  assert.equal(out.values.event_type, 'birthday');
  assert.equal(out.values.label_en, 'Birthdays');
  assert.deepEqual(out.misses, {});
});

test('an answer that matched nothing is left empty AND reported', () => {
  const spec = PREPARED_TAXONOMY_JOBS.get('relabelEventTypeVocab')!;
  const out = buildPreparedValues(spec, paramsFrom({ event_type: 'wake' }), CATALOGS);
  assert.equal(out.values.event_type, '', 'an unmatched event type was guessed into place');
  assert.equal(out.misses.event_type, 'wake', 'the miss is silent — the admin cannot tell it happened');
});

/**
 * ⚠ AN UNASKED FIELD IS NOT A MISS. Reporting "nothing here is called ''" for
 * every question the box never got round to is noise, and noise is what teaches
 * somebody to skim past the one notice that matters.
 */
test('a field the box never asked about is empty and silent', () => {
  const spec = PREPARED_TAXONOMY_JOBS.get('relabelEventTypeVocab')!;
  const out = buildPreparedValues(spec, paramsFrom({}), CATALOGS);
  assert.equal(out.values.event_type, '');
  assert.deepEqual(out.misses, {}, 'an unasked field was reported as a failed match');
});

test('a closed pick is resolved from the words too, and a bad one is refused', () => {
  const spec = PREPARED_TAXONOMY_JOBS.get('setCategoryHidden')!;
  const ok = buildPreparedValues(
    spec,
    paramsFrom({ category_id: 'Photo booths', hidden: 'Hide it' }),
    CATALOGS,
  );
  assert.equal(ok.values.category_id, 'tile-photo');
  assert.equal(ok.values.hidden, '1');

  const bad = buildPreparedValues(spec, paramsFrom({ hidden: 'maybe' }), CATALOGS);
  assert.equal(bad.values.hidden, '', 'an unrecognised choice was guessed rather than left for the admin');
  assert.equal(bad.misses.hidden, 'maybe');
});

/**
 * 🔑 NO GATHERED ANSWER IS BINNED, INCLUDING THE PLUMBING ONES. `_view` is not a
 * question worth showing, but the box still asks it, and dropping the answer
 * would re-create the original defect in miniature.
 */
test('a carried plumbing field keeps its value', () => {
  const spec = PREPARED_TAXONOMY_JOBS.get('remapCanonical')!;
  const out = buildPreparedValues(spec, paramsFrom({ _view: 'unfiled' }), CATALOGS);
  assert.equal(out.values._view, 'unfiled');
});
