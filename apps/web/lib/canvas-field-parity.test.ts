/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TEST THAT KEEPS THE SERVER UNTOUCHABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The zero-step canvas (`canvas-maker.tsx`) and the 6-step wizard
 * (`service-wizard.tsx`) are two RENDERINGS of one form. They post to the same
 * action, `commitVendorService`, which was not changed and must not need to be:
 * whichever component drew the screen, the FormData that lands on the server is
 * the same shape.
 *
 * That claim is only worth anything if something checks it, so this does — by
 * walking BOTH component trees and comparing the set of `name=` attributes they
 * contribute. Add a field to the canvas that the wizard does not have (or drop
 * one the wizard does) and this test goes red before the server ever sees it.
 *
 * ── WHY A STATIC SCAN AND NOT A RENDER ────────────────────────────────────
 * This repo's unit suite is `tsx --test` over plain `.ts` — there is no DOM, no
 * react-dom/test-utils, no jsdom, and adding one for a single assertion would
 * be a heavier dependency than the thing it guards. A lexical scan over the two
 * component trees answers exactly the question asked ("do these two post the
 * same field names?") with no runtime at all, and it also catches fields inside
 * branches a render would have to be coaxed into taking (the `claim_token`
 * passthrough, the conditional coverage picker, the flag-dark customization
 * step).
 *
 * ── THE ONE DELIBERATE EXCLUSION ──────────────────────────────────────────
 * The canvas's audience sheet is a SIBLING form posting to the shipped
 * `updateCoverageServes` (who finds this card lives on `vendor_coverages`, not
 * on the card). It is fenced in the source with `parity:ignore-start` /
 * `parity:ignore-end`. The fence is not an honour system: § 3 below asserts the
 * fenced block posts to `updateCoverageServes` and NOT to `commitVendorService`,
 * so it can never be used to smuggle a field onto the card form.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = resolve(HERE, '../app/vendor-dashboard/services/_components');
const NEW_SERVICE_PAGE = resolve(
  HERE,
  '../app/vendor-dashboard/services/new/[category]/page.tsx',
);

const WIZARD = join(COMPONENTS, 'service-wizard.tsx');
const CANVAS = join(COMPONENTS, 'canvas-maker.tsx');

/**
 * Identifiers used as `name={IDENT}` whose wire value is a module constant.
 * Resolved here so the assertion compares the REAL field name that reaches the
 * server, not the variable it was spelled with.
 */
const KNOWN_CONSTANTS: Record<string, string> = {
  // lib/service-customization-draft.ts
  CUSTOMIZATION_FIELD_NAME: 'customization_draft',
};

// ── The scanner ──────────────────────────────────────────────────────────────

/** Drop comments so a `name="…"` written in prose can't be counted as a field. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*');
    })
    .join('\n');
}

/** Remove everything between the parity fences (the sibling coverage form). */
function stripIgnoredBlocks(source: string): string {
  return source.replace(/parity:ignore-start[\s\S]*?parity:ignore-end/g, '');
}

/** The text INSIDE the parity fences — what § 3 interrogates. */
function ignoredBlocks(source: string): string[] {
  return [...source.matchAll(/parity:ignore-start([\s\S]*?)parity:ignore-end/g)].map(
    (m) => m[1] ?? '',
  );
}

function namesIn(source: string): string[] {
  const out: string[] = [];
  // name="literal"
  for (const m of source.matchAll(/(?<![\w$.])name\s*=\s*"([^"]*)"/g)) {
    out.push(m[1] ?? '');
  }
  // name={`template-${expr}`} → normalised, because the expression differs per
  // row but the FIELD SHAPE is what parity is about.
  for (const m of source.matchAll(/(?<![\w$.])name\s*=\s*\{`([^`]*)`\}/g)) {
    out.push((m[1] ?? '').replace(/\$\{[^}]*\}/g, '${}'));
  }
  // name={IDENTIFIER}
  for (const m of source.matchAll(/(?<![\w$.])name\s*=\s*\{([A-Za-z_$][\w$]*)\}/g)) {
    const ident = m[1] ?? '';
    out.push(KNOWN_CONSTANTS[ident] ?? `{${ident}}`);
  }
  return out;
}

/**
 * Relative component imports to follow. Only RELATIVE `.tsx` — an aliased
 * import (`@/app/_components/file-upload`) is a shared primitive whose field
 * name is supplied at the CALL SITE (`<FileUpload name="primary_photo_r2_key">`),
 * which the scan already sees; descending into it would only find `name={name}`.
 */
function relativeComponentImports(source: string, fromDir: string): string[] {
  const specs = [...source.matchAll(/from\s+'(\.[^']*)'/g)].map((m) => m[1] ?? '');
  const files: string[] = [];
  for (const spec of specs) {
    const candidate = resolve(fromDir, `${spec}.tsx`);
    if (existsSync(candidate)) files.push(candidate);
  }
  return files;
}

/** Every field name the component tree rooted at `entry` contributes. */
function collectNames(entry: string): Set<string> {
  const names = new Set<string>();
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const raw = readFileSync(file, 'utf8');
    const source = stripComments(stripIgnoredBlocks(raw));
    for (const n of namesIn(source)) names.add(n);
    for (const next of relativeComponentImports(source, dirname(file))) queue.push(next);
  }
  return names;
}

function sorted(set: Set<string>): string[] {
  return [...set].sort();
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · The scanner has to actually find things
// ════════════════════════════════════════════════════════════════════════════

test('the scan reaches the shipped child editors (canary — an empty scan must not pass)', () => {
  const wizard = collectNames(WIZARD);
  // One name from each tree the scan has to descend into. If any of these
  // disappears, the scan silently stopped walking and every parity assertion
  // below became vacuous.
  for (const canary of [
    'category', //              service-wizard.tsx itself
    'primary_photo_r2_key', //  <FileUpload> call site (aliased import)
    'pricing_basis', //         ./pricing-basis-editor
    'crew_meal_included', //    ./pricing-basis-editor · IncludedFlags
    'inclusion_label', //       ./service-list-editors · InclusionsEditor
    'discount_unit', //         ./service-list-editors · DiscountsEditor
    'bracket_price', //         ./service-list-editors · PriceBracketsEditor
    'showcase_video_r2_key', // ./showcase-media-fields
    'customization_draft', //   ./customization-step (via CUSTOMIZATION_FIELD_NAME)
    'publish', //               <SubmitButton name="publish">
  ]) {
    assert.ok(wizard.has(canary), `scan lost "${canary}" — it stopped walking`);
  }
  assert.ok(wizard.size >= 25, `expected a full field set, got ${wizard.size}`);
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · THE PARITY ASSERTION
// ════════════════════════════════════════════════════════════════════════════

test('the canvas posts EXACTLY the wizard’s field names — the server cannot tell them apart', () => {
  const wizard = collectNames(WIZARD);
  const canvas = collectNames(CANVAS);

  const onlyWizard = sorted(wizard).filter((n) => !canvas.has(n));
  const onlyCanvas = sorted(canvas).filter((n) => !wizard.has(n));

  assert.deepEqual(
    onlyCanvas,
    [],
    'The canvas posts field(s) the wizard does not: ' +
      `${onlyCanvas.join(', ')}. commitVendorService would have to change to ` +
      'read them — it must not. Either drop the field or route it through an ' +
      'existing name.',
  );
  assert.deepEqual(
    onlyWizard,
    [],
    'The canvas DROPS field(s) the wizard posts: ' +
      `${onlyWizard.join(', ')}. A vendor using the canvas would silently lose ` +
      'them. Mount the editor that owns them.',
  );
  assert.deepEqual(sorted(canvas), sorted(wizard));
});

// ════════════════════════════════════════════════════════════════════════════
// 3 · The fenced block cannot be used to smuggle a field onto the card form
// ════════════════════════════════════════════════════════════════════════════

test('the parity fence hides only the sibling coverage form', () => {
  const raw = readFileSync(CANVAS, 'utf8');
  const blocks = ignoredBlocks(raw);
  assert.ok(blocks.length > 0, 'expected at least one parity:ignore block');

  const fenced = blocks.join('\n');
  assert.equal(
    [...fenced.matchAll(/action=\{updateCoverageServes\}/g)].length,
    1,
    'exactly one fenced block must be the coverage form',
  );
  for (const block of blocks) {
    assert.doesNotMatch(
      block,
      /commitVendorService/,
      'a fence must never contain the card form — that would hide a field from parity',
    );
  }

  // THE TIGHT PART: whatever the fences hide, it can only ever be the coverage
  // write. Anything else appearing here is a field escaping the parity check.
  const ALLOWED = new Set(['event_types', 'faiths', 'coverage_id', '{coverageField}']);
  const escaped = [...new Set(namesIn(stripComments(fenced)))].filter(
    (n) => !ALLOWED.has(n),
  );
  assert.deepEqual(
    escaped,
    [],
    `field(s) hidden behind the parity fence that are not the coverage write: ${escaped.join(', ')}`,
  );

  // The audience really does write the shipped coverage columns, under the
  // shipped names, so "one storage array shown in N groups" stays true: EVERY
  // event-type group targets the same single column, because they are one
  // mapped render rather than N hand-written blocks.
  assert.match(
    fenced,
    /audienceGroups\(audienceOptions\)\.map\(/,
    'the event-type groups must come from the tested grouping helper',
  );
  assert.equal(
    [...fenced.matchAll(/coverageField="event_types"/g)].length,
    1,
    'one mapped render, so every group writes the ONE event_types array by construction',
  );
  // Which options each group carries — and the invariant that their union is
  // ALWAYS the whole vocab — is owned and tested by canvas-audience-groups.test.ts.
  assert.match(fenced, /coverageField="faiths"/);
  assert.match(fenced, /name=\{coverageField\}/);
  // …and the passthrough that carries them is exhaustive by type, so the fence
  // cannot grow a third field without changing this line.
  assert.match(fenced, /coverageField: 'event_types' \| 'faiths'/);
});

test('the canvas has exactly one card form, and it is a SIBLING of the coverage form (never nested)', () => {
  const raw = stripComments(readFileSync(CANVAS, 'utf8'));
  const cardForms = [...raw.matchAll(/action=\{commitVendorService\}/g)];
  assert.equal(cardForms.length, 1, 'exactly one <form action={commitVendorService}>');

  // The card form must be CLOSED before the coverage form opens. Nested forms
  // are invalid HTML and, worse, make a no-JS submit of the outer form dispatch
  // the inner action (see scripts/lint-nested-forms.mjs).
  const cardFormEnd = raw.indexOf('</form>');
  const coverageForm = raw.indexOf('action={updateCoverageServes}');
  assert.ok(cardFormEnd > -1 && coverageForm > -1);
  assert.ok(
    cardFormEnd < coverageForm,
    'the coverage form opens before the card form closes — that is a nested form',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 4 · Flag OFF ⇒ the page renders the wizard
// ════════════════════════════════════════════════════════════════════════════

test('the maker page picks its component from canvasMakerEnabled(), and OFF is the wizard', () => {
  const page = stripComments(readFileSync(NEW_SERVICE_PAGE, 'utf8'));

  assert.match(page, /const canvas = canvasMakerEnabled\(\)/, 'the flag is the gate');
  // The ternary's TRUE arm is the canvas and its FALSE arm is the wizard —
  // asserted on the branch structure, not on rendered bytes.
  assert.match(
    page,
    /\{canvas \? \(\s*<CanvasMaker[\s\S]*?\) : \(\s*<ServiceWizard[\s\S]*?\)\}/,
    'flag ON → <CanvasMaker>, flag OFF → <ServiceWizard>',
  );
  // Only one of each, so there is no second (ungated) mount of either.
  assert.equal([...page.matchAll(/<CanvasMaker/g)].length, 1);
  assert.equal([...page.matchAll(/<ServiceWizard/g)].length, 1);
});

test('flag OFF is byte-for-byte the shipped wizard call — same six props, nothing added', () => {
  const page = stripComments(readFileSync(NEW_SERVICE_PAGE, 'utf8'));
  const call = page.slice(page.indexOf('<ServiceWizard'));
  const props = [...call.slice(0, call.indexOf('/>')).matchAll(/^\s*(\w+)=/gm)].map(
    (m) => m[1],
  );
  assert.deepEqual(props.sort(), [
    'categoryLabel',
    'categoryValue',
    'claimToken',
    'coverages',
    'otherCategories',
    'vendorProfileId',
  ]);
});

test('the canvas takes the wizard’s props unchanged, and only ADDS optional ones', () => {
  const canvas = stripComments(readFileSync(CANVAS, 'utf8'));
  for (const prop of [
    'categoryValue',
    'categoryLabel',
    'otherCategories',
    'coverages',
    'vendorProfileId',
    'claimToken',
  ]) {
    assert.match(
      canvas,
      new RegExp(`\\n  ${prop}[?,:= ]`),
      `<CanvasMaker> must accept the wizard prop "${prop}"`,
    );
  }
  // The canvas-only props are all optional, so the mount is a drop-in.
  for (const added of ['eventTypeOptions', 'faithOptions', 'coverageAudience']) {
    assert.match(
      canvas,
      new RegExp(`${added}\\?:`),
      `canvas-only prop "${added}" must be optional`,
    );
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 5 · The canvas never re-implements a shipped editor
// ════════════════════════════════════════════════════════════════════════════

test('the card is wired to the LIVE form — no per-region save, nothing waits for submit', () => {
  const canvas = stripComments(readFileSync(CANVAS, 'utf8'));

  // The read is event-driven off the form itself…
  assert.match(canvas, /form\.addEventListener\('input', read\)/);
  assert.match(canvas, /form\.addEventListener\('change', read\)/);
  // …plus a deferred click read, because the basis picker and the unit toggles
  // are type="button" controls writing React-controlled hidden inputs.
  assert.match(canvas, /form\.addEventListener\('click', readAfterCommit\)/);
  // …and a poll for the editors that write controlled hidden inputs silently.
  assert.match(canvas, /setInterval\(read, \d+\)/);
  // The card renders what that read produced, not component-local price state.
  assert.match(canvas, /snap\.priceLine/);
  assert.match(canvas, /hasPrice: snap\.hasPrice/);

  // The ONLY submits on the card form are the single commit's two buttons.
  // A per-region "save" would mean the canvas had stopped being one form.
  const cardForm = canvas.slice(
    canvas.indexOf('action={commitVendorService}'),
    canvas.indexOf('</form>'),
  );
  const submits = [...cardForm.matchAll(/<SubmitButton/g)];
  assert.equal(submits.length, 2, 'exactly Publish + Save as draft');
  assert.match(cardForm, /name="publish"\s+value="true"/);
  assert.match(cardForm, /name="publish"\s+value="false"/);
});

/**
 * Every shared editor that contributes POSTED field names, and therefore must
 * actually be MOUNTED on both sides — not merely imported.
 *
 * This list is the fix for a proven blind spot (2026-07-28 review): deleting
 * `<DiscountsEditor />` from the canvas left all nine parity tests green,
 * because names are collected per FILE via the import graph — `DiscountsEditor`
 * is a named export of `./service-list-editors`, which stays imported for its
 * siblings, so its five discount_* names kept being counted while no vendor
 * could ever fill them in. A word-boundary `\bDiscountsEditor\b` matched the
 * import line and "passed" too.
 */
const MOUNTED_EDITORS = [
  'PricingBasisEditor', // pricing_basis + the per-basis money fields
  'IncludedFlags', //     crew_meal_included · transport_*
  'PriceBracketsEditor', // bracket_*
  'InclusionsEditor', //  inclusion_label · inclusion_worth
  'DiscountsEditor', //   discount_type · _rate · _unit · _expires_at · _conditions_md
  'ShowcaseMediaFields', // showcase_photo_r2_keys · showcase_video_r2_key
  'CustomizationStep', // customization_draft
  'FileUpload', //        primary_photo_r2_key (the cover picker)
];

test('every shared editor is MOUNTED on both sides, not merely imported', () => {
  const canvas = stripComments(readFileSync(CANVAS, 'utf8'));
  const wizard = stripComments(readFileSync(WIZARD, 'utf8'));

  for (const editor of MOUNTED_EDITORS) {
    // The JSX OPEN TAG, not the identifier — an import line must not satisfy
    // this. `<X` also matches `<X\n  prop=…` and the self-closing form.
    const openTag = new RegExp(`<${editor}[\\s/>]`);
    assert.match(
      canvas,
      openTag,
      `canvas-maker.tsx imports but never RENDERS <${editor}> — its fields would ` +
        'still pass the name-parity check while no vendor could fill them in',
    );
    assert.match(wizard, openTag, `service-wizard.tsx must still render <${editor}>`);
  }
});

test('the canvas MOUNTS the shipped editors rather than forking them', () => {
  const canvas = stripComments(readFileSync(CANVAS, 'utf8'));
  // Non-field reuse: primitives that carry no posted name of their own, so a
  // mount assertion would be meaningless — the identifier is the point.
  for (const reused of ['SubmitButton', 'useModalA11y', 'Field']) {
    assert.match(canvas, new RegExp(`\\b${reused}\\b`), `expected to reuse ${reused}`);
  }
  // Same flag as the wizard, so both carry identical payloads on both settings.
  assert.match(canvas, /packageAuthoringEnabled\(\)/);
  // The audience grouping comes from the tested module, never a local filter —
  // a local list is how five live event types became silently strippable. The
  // options it groups are the leaf's ALLOWED set (coverage-allowed-events.ts),
  // the same set the server keeps on save.
  assert.match(canvas, /audienceGroups\(audienceOptions\)\.map\(/);
});

/**
 * HONEST LIMIT OF THE ABOVE, written down so nobody mistakes it for total
 * coverage: the mount check is LEXICAL. It proves the open tag exists in the
 * file; it cannot prove the tag is reachable.
 *
 *   {someCondition ? <DiscountsEditor initial={[]} /> : null}
 *
 * satisfies it while rendering nothing at runtime — and `<CustomizationStep>`
 * is deliberately written that way on BOTH sides (it is flag-dark behind
 * `packageAuthoringEnabled()`, which is exactly why its conditional mount is
 * correct rather than suspicious). A guard that could tell those two apart
 * would need to evaluate the component, which this suite deliberately does not
 * do. Catch a dead conditional in review, or with a rendering test if one is
 * ever added.
 */
test('the conditional-mount limit is documented next to the check that has it', () => {
  const suite = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.match(suite, /HONEST LIMIT/);
  // The one conditional mount we ship is the flag-dark customization step, and
  // it is conditional on BOTH sides under the SAME flag — so the exemption
  // stays the narrow, matched one rather than a general licence.
  const canvas = stripComments(readFileSync(CANVAS, 'utf8'));
  const wizard = stripComments(readFileSync(WIZARD, 'utf8'));
  for (const [name, src] of [
    ['canvas-maker.tsx', canvas],
    ['service-wizard.tsx', wizard],
  ] as const) {
    assert.match(src, /customizationEnabled \? \(/, `${name}: expected the flag-dark branch`);
    assert.match(src, /<CustomizationStep/, `${name}: expected the mount`);
    assert.equal(
      [...src.matchAll(/<CustomizationStep/g)].length,
      1,
      `${name}: a SECOND, unconditional mount would defeat the flag`,
    );
  }
});
