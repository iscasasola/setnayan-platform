import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';

/*
  EVENT OVERVIEW · STATUS STAYS IN VIEW (owner-approved 2026-09-22).

  From 1280 the flow takes the width on the left and the day + the numbers pin
  on the right. The desktop page measured 3,165px, and everything telling a
  couple where they stand — date, countdown, locked share, budget, guest split
  — lived in the first screen and was gone for the other 2,200.

  ⚠ WHAT THIS GUARD CAN AND CANNOT DO. It pins the MECHANISM: which classes the
  component emits, and what the stylesheet does with them at which width. It
  cannot tell you the page looks right — no test in this repo can mount a
  3,000-line server component that reads the database, and the Overview needs a
  signed-in session, so it cannot be rendered locally either. The appearance was
  reviewed on the Vercel preview, not here. That limit is the reason this PR did
  not arm auto-merge.

  What WAS measured, in a browser, against these exact rules lifted out of
  globals.css: at 1280 the container computes `display: grid` with a 336px
  sticky status column; with `[data-open='true']` on the inspector shell it
  computes `display: block` and `position: static`; at 1024 it is block/static.
*/

const root = process.cwd();
const dash = stripComments(
  readFileSync(path.join(root, 'app/dashboard/[eventId]/_components/event-dashboard.tsx'), 'utf8'),
);
const css = readFileSync(path.join(root, 'app/globals.css'), 'utf8');

test('the component emits the three layout hooks and no inline grid', () => {
  for (const cls of ['sn-overview-cols', 'sn-overview-status', 'sn-overview-flow']) {
    assert.ok(dash.includes(cls), `missing hook: ${cls}`);
  }
  /*
    The grid lives in the stylesheet, not in Tailwind utilities on the element.
    That is not a style preference: the "yield to the inspector" rule needs an
    ANCESTOR selector (`.sn-inspector-shell[data-open='true'] …`), which cannot
    be expressed as a utility class on the child. Keeping half the layout in
    utilities and half in a rule is how the two end up disagreeing.
  */
  const inlineGrid = (dash.match(/lg:grid-cols-\[minmax/g) || []).length;
  console.log(`  inline grid utilities on the shell: ${inlineGrid}`);
  assert.equal(inlineGrid, 0, 'the column grid belongs to the stylesheet rule');
});

test('the split starts at 1280 — the same breakpoint the inspector uses', () => {
  const at1280 = css.slice(css.indexOf('.sn-overview-cols'));
  // Find the media query that encloses the overview rules.
  const block = css.slice(0, css.indexOf('.sn-overview-cols {'));
  const lastMedia = block.lastIndexOf('@media (min-width:');
  const declared = block.slice(lastMedia, lastMedia + 34);
  console.log(`  overview columns declared under: ${declared.trim()}`);
  assert.ok(
    declared.includes('1280'),
    'at 1024 the content box is ~780px; 780 − 364 leaves ~416px of flow, ' +
      'narrower than the two-up decision cards it must hold',
  );
  assert.ok(at1280.includes('grid-template-columns: minmax(0, 1fr) 21rem'));
  assert.ok(at1280.includes('position: sticky'));
});

test('one right column at a time — it yields to the inspector', () => {
  /*
    🛑 THE COLLISION THE PROTOTYPE DID NOT MODEL. `.sn-inspector-rail` already
    claims the right side at this exact breakpoint, up to clamp(340px,30vw,420px)
    plus a 24px margin, while the master reflows to what is left. Two permanent
    right columns leave roughly 310px of flow at 1280.
  */
  /*
    ⚠ ASSERT THE DECLARATION, NOT THE SELECTOR PREFIX. The first version used
    `css.includes("[data-open='true'] .sn-overview-cols")`. A sabotage that
    renamed that rule's selector outright left it GREEN, because a NEIGHBOURING
    rule — the `> * + *` margin one — carries the same prefix. A substring that
    a sibling also satisfies is not evidence about this rule.
  */
  assert.match(
    css,
    /\.sn-inspector-shell\[data-open='true'\]\s+\.sn-overview-cols\s*\{\s*display:\s*block/,
    'the grid must collapse to one column when the inspector opens',
  );
  assert.match(
    css,
    /\.sn-inspector-shell\[data-open='true'\]\s+\.sn-overview-status\s*\{\s*position:\s*static/,
    'and the status block must stop sticking',
  );
  // The inspector's own breakpoint must still be the one we matched.
  const inspAt = css.lastIndexOf('@media (min-width: 1280px)', css.indexOf('.sn-inspector-shell'));
  assert.ok(inspAt >= 0, 'the inspector rail is still a 1280 mechanism — re-check if this fails');
});

test('the phone stack is untouched', () => {
  // Measured in a browser at 1024: display block, position static. Here we pin
  // the reason that is true — every rule sits inside the min-width block.
  const before = css.slice(0, css.indexOf('.sn-overview-cols {'));
  const openBraces = (before.match(/@media \(min-width: 1280px\) \{/g) || []).length;
  assert.ok(openBraces >= 1, 'the overview rules must be inside a min-width block');
  assert.ok(
    !/\.sn-overview-cols\s*\{[^}]*display:\s*grid/.test(
      css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, ''),
    ),
    'no unconditional grid outside a media query',
  );
});
