/**
 * THE A4 BOOKLET IS NOT A SECOND WAY AROUND THE WITHDRAWAL.
 *
 * `lib/a-withdrawal-reaches-every-copy.ts`'s `storySurfacesFor` lists the
 * ROUTE `/${slug}/print` once — not "the A3 sheet" — and
 * `a-withdrawal-reaches-every-copy.server.ts` busts it by PATH, never by
 * query string. `page.tsx` builds ONE `data` object (gated by
 * `storyAudienceAdmits` and redacted by `redactStoryLayers`, both reading the
 * live consent/taken-back state) and only THEN branches on `?format=` to
 * choose which sheet renders it. So the mechanism this file pins is: the A4
 * branch must consume the SAME already-gated `data`, positioned AFTER both
 * gates — never a second fetch, never a branch that jumps ahead of them.
 *
 * This is `the-keepsake-is-not-a-way-around.test.ts`'s pattern (source-pinned,
 * comments stripped) applied to the second format instead of a second
 * viewer-construction site — the failure mode here is a bypassed GATE, not a
 * hardcoded viewer.
 *
 * ── PROVEN BOTH WAYS ─────────────────────────────────────────────────────
 * The last test in this file sabotages page.tsx by moving the A4 branch
 * BEFORE the audience gate (simulating what an early "A4 skips the check to
 * keep it simple" shortcut would look like) and confirms the source pin goes
 * red — then confirms the shipped file is green.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { stripComments } from '@/lib/strip-comments';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)));

function pageSource(): string {
  return stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
}

/**
 * The check this whole file exists to run: given the route's full source,
 * is the A4/A3 branch positioned strictly after BOTH the audience gate
 * (`storyAudienceAdmits`) and the layer redaction (`redactStoryLayers`)?
 * Exported as a plain function so both the real file and a sabotaged copy
 * can be checked with the identical rule.
 */
function a4BranchComesAfterBothGates(src: string): boolean {
  const audienceGateIdx = src.indexOf('storyAudienceAdmits(data.audience, printViewer)');
  const redactionIdx = src.indexOf('redactStoryLayers(data, printViewer)');
  const formatBranchIdx = src.indexOf("format === 'a4'");
  if (audienceGateIdx === -1 || redactionIdx === -1 || formatBranchIdx === -1) return false;
  // Every occurrence of the a4 branch (there may be more than one, e.g. the
  // CSS-select line and the sheet-select line) must sit after both gates.
  let idx = src.indexOf("format === 'a4'");
  while (idx !== -1) {
    if (idx < audienceGateIdx || idx < redactionIdx) return false;
    idx = src.indexOf("format === 'a4'", idx + 1);
  }
  return true;
}

test('the real route: the A4 branch sits after the audience gate and the layer redaction', () => {
  const src = pageSource();
  assert.ok(src.includes('storyAudienceAdmits'), 'sweep is blind — the audience gate call site was not found');
  assert.ok(src.includes('redactStoryLayers'), 'sweep is blind — the redaction call site was not found');
  assert.ok(src.includes("format === 'a4'"), 'sweep is blind — no A4 branch found; has the format switch moved?');
  assert.equal(
    a4BranchComesAfterBothGates(src),
    true,
    'the A4 branch reads `data` before it has been audience-gated and layer-redacted — ' +
      'this is exactly the "print route bypasses the story gate" defect, on the second format',
  );
});

test('both formats are rendered from the SAME `data` binding — no second fetch for A4', () => {
  const src = pageSource();
  // A4Sheet and PrintSheet must both be given `data={data}` — the same
  // identifier, not a second `loadEditorialData` call scoped to the a4
  // branch. Two occurrences of `data={data}` (once per sheet) is the floor;
  // fewer means one of them stopped being wired to the gated object.
  const wiredSites = src.match(/data=\{data\}/g) ?? [];
  assert.ok(
    wiredSites.length >= 2,
    `only ${wiredSites.length} sheet(s) are wired to the gated \`data\` binding — expected at least 2 (A3 + A4). ` +
      'A sheet reading anything else would be exactly the way-around this test exists to catch.',
  );
  // And there is exactly one call to the loader in the whole route — a second
  // call scoped to the A4 branch would be the "second fetch" bypass.
  const loaderCalls = src.match(/loadEditorialData\(/g) ?? [];
  assert.equal(loaderCalls.length, 1, `expected exactly 1 loadEditorialData() call in the route, found ${loaderCalls.length}`);
});

test('sabotage: moving the A4 branch ahead of the gates makes the pin fail — then the real file passes', () => {
  const real = pageSource();

  // Simulate the shortcut: hoist a naive `if (format === 'a4') { return <A4Sheet data={rawData} .../> }`
  // to just after the loader call, i.e. before `storyAudienceAdmits` even
  // appears in the source. This is a source-level sabotage of the ORDER, not
  // a real render — it only needs to prove the string-position check fires.
  const loaderCallIdx = real.indexOf('data = await loadEditorialData(event.event_id);');
  assert.ok(loaderCallIdx !== -1, 'could not locate the loader call to sabotage after');
  const insertPoint = real.indexOf('\n', loaderCallIdx) + 1;
  const sabotaged =
    real.slice(0, insertPoint) +
    "  if (format === 'a4') { return renderA4Early(data); }\n" +
    real.slice(insertPoint);

  console.log(
    `SABOTAGE: format==='a4' occurrences before storyAudienceAdmits: ` +
      `${[...sabotaged.matchAll(/format === 'a4'/g)].filter((m) => (m.index ?? 0) < sabotaged.indexOf('storyAudienceAdmits')).length}`,
  );
  assert.equal(
    a4BranchComesAfterBothGates(sabotaged),
    false,
    'the sabotage should have put an A4 branch ahead of the gates — if this passes, the sabotage itself is broken',
  );

  assert.equal(
    a4BranchComesAfterBothGates(real),
    true,
    'the shipped route must still pass once the sabotage is not applied',
  );
});
