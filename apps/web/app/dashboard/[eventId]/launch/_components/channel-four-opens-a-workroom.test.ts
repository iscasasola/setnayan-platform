/**
 * channel-four-opens-a-workroom.test.ts — EH5, source-grepped wiring.
 *
 * `event-hub-control.test.ts` proves the resolvers are honest about the
 * workroom's own facts and next step. `hub-stage-renders.test.ts` proves an
 * honest `HubFact[]` reaches the pixel on S1/S2. Neither reads THIS page, and
 * this stream's whole disease is a measurement taken correctly one layer down
 * and then dropped — a hardcoded `true`, a fact nobody wired in. So, same
 * pattern as `the-controller-wires-what-it-measured.test.ts`: source, with
 * comments stripped first so prose about a construct is never mistaken for it.
 *
 * Design § 2.4 / prototype § 1 third frame: channels 1–3 are things the couple
 * SETS, so a "Preview" link that opens the public page in a new tab is enough.
 * The story is a thing they WORK ON for weeks with two other authors, so its
 * card carries its own same-tab door straight into the existing editor —
 * `/story`, full screen, no new route.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const page = () => stripComments(readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8'));

/*
  ── 2026-09-24 · THE CARDS FOLDED INTO THE STAGE ──────────────────────────
  Owner: *"this 2 can integrate to each other"*. The four stage cards are the
  stage's "When" switch now (`app/_components/site-stage/site-stage.tsx`), so
  the workroom door and the Preview door live THERE and follow the picked
  stage. The claims are unchanged — only where they are read from moved.
  `hub-stage-renders.test.ts` renders both doors; these hold the wiring.
*/
const stage = () =>
  stripComments(
    readFileSync(resolve(HERE, '..', '..', '..', '..', '_components', 'site-stage', 'site-stage.tsx'), 'utf8'),
  );

test('channel 4 alone gets the workroom door, and it is same-tab into the real route', () => {
  const src = page();
  assert.match(
    src,
    /workroomHref=\{`\$\{base\}\/story`\}/,
    'the workroom door must point at the SHIPPED editorial route — no new page',
  );
  const st = stage();
  assert.match(
    st,
    /phase === 'editorial' && workroomHref \?/,
    'the extra door must be scoped to the editorial stage only, not every stage',
  );
  const workroomBlock = st.slice(
    st.indexOf("phase === 'editorial' && workroomHref"),
    st.indexOf('Open the workroom') + 40,
  );
  assert.match(workroomBlock, /href=\{workroomHref\}/);
  assert.doesNotMatch(
    workroomBlock,
    /target=["']_blank["']/,
    'a workroom is opened, not previewed in a new tab — same page, same route',
  );
});

test('every stage keeps its Preview-in-a-new-tab door — ONE door, for the stage picked', () => {
  const st = stage();
  assert.match(st, /const previewHref = slug \? `\/\$\{slug\}\?phase=\$\{phase\}` : null;/);
  assert.match(st, /previewHref \? \(/, 'the Preview branch must still exist');
  assert.match(
    st,
    /href=\{previewHref\}\s*\n\s*target="_blank"/,
    'Preview still opens the public rendering of the stage, in a new tab',
  );
  // The four cards are gone from the page — and so is the second copy of the door.
  assert.doesNotMatch(page(), /PUBLIC_SITE_PAGES\.map\(\(page\) => \{/, 'the four-card loop was folded, not duplicated');
});

test('the four facts on the story channel are wired through resolveHubFacts — no second mechanism', () => {
  const src = page();
  assert.match(
    src,
    /resolveHubFacts\(eventRead, guestFacts, undefined, editorialRead\)/,
    'the workroom facts must flow through the ONE fact resolver, not a parallel render path',
  );
});

test('the next step is wired the same way, so "N wrote you a column" can outrank the generic copy', () => {
  const src = page();
  assert.match(
    src,
    /resolveHubNextStep\(standing, eventRead, guestFacts, editorialRead\)/,
  );
});

test('the workroom read is gated to the story channel — every other couple pays nothing extra', () => {
  const src = page();
  assert.match(src, /if \(standing\.stage === 'editorial'\) \{/, 'the extra read must not run for plan/dayof');
});

test('the pending-columns count is asked only when the feature is actually on', () => {
  const src = page();
  assert.match(
    src,
    /if \(guestColumnsOn && admin\) \{/,
    'never query guest_columns for a couple the feature is switched off for',
  );
});

test('the chapter count reuses the shipped parser — it does not re-derive draft_json by hand', () => {
  const src = page();
  assert.match(
    src,
    /import \{ readChapterOverrides \} from '@\/app\/\[slug\]\/_components\/editorial\/data';/,
  );
  assert.match(src, /readChapterOverrides\(editorialRow\?\.draft_json/);
});

test('EH5 does not touch the four files PR #5012 owns', () => {
  // A source guard cannot see another PR's diff, but it CAN hold the promise
  // that this file — the one place EH5 was told to route from — never grows
  // an import from any of the four fenced editorial-editor/privacy files'
  // internals in a way that would force editing them.
  const src = page();
  assert.doesNotMatch(
    src,
    /from '\.\.\/story\/_components\/editorial-editor'/,
    'the controller reuses the editorial ROUTE, never the editor component directly',
  );
});
