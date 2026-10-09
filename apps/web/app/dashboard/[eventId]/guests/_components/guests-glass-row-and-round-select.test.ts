/**
 * guests-glass-row-and-round-select.test.ts — THE GUEST LIST'S FLOATING ROW IS REAL GLASS, AND ITS BUTTONS ARE NOT SECOND PANES.
 *
 * 🔴 SEEN ON THE LIVE GUEST LIST (owner 2026-10-09): "the glass row has a transparent background, the buttons is not the
 * frosted glass style" — the guest rows ("Atty. Fidel Castro", "Ms. Juanita Sacdalan") read straight through the pinned
 * ⇅ ☑ Search or add ≡ band, through the search field, and the round buttons were flat white. TWO causes, both measured in a
 * real browser (Chromium on the dev lab `/dev/guests-lab?part=screen`, 375 and 750 wide — the page's real markup and the
 * shared stylesheets, the module CSS swapped for the old and the new):
 *
 *  1. THE BLUR NEVER PAINTED. The row (`sn-glass-row`: 62 % paper over `backdrop-filter: blur(16px) saturate(1.3)`) sits inside
 *     `<main class="sn-vt-page">`, and while that element carries a `view-transition-name` a `backdrop-filter` on anything
 *     inside it blurs NOTHING (a 62 % wash over crisp text). Of nine properties tried on the row and its ancestors the name
 *     was the only one that mattered; the row reparented outside `<main>` blurred fine. The name is only needed while the
 *     bottom-nav slide runs, so at rest — on the page that draws this row — it is off (`globals.css`), with `isolation: isolate`
 *     keeping the stacking context the name implied. This exposure is the page's, not the batch's: it predates it.
 *  2. EVERY BUTTON ON THE ROW WAS A SECOND PANE. `guests-screen.module.css` gave the neutral buttons, the Sort / Set… pick and
 *     the toned buttons a 62 % cream fill AND a backdrop blur of their own; a backdrop-filter inside a backdrop-filtered row
 *     sees only the row's own paint (a nested backdrop root), so each blurred nothing — a flat white disc over a white band —
 *     and the toned ones lost their colour. Now the row paints the glass once; a neutral button is the shared transparent one
 *     with its faint edge (`.ab-neutral`), a toned one keeps its tone; the search field is SOLID.
 *
 * What this holds (parsed, not string-matched):  (A) the at-rest rule and the page's name · (B) no pane of its own on the row
 * · (C) the field is solid · (D) the row still wears the one shared class · (E) the shared neutral button is the transparent
 * one the row relies on.  The select circles' own half is in `a-44px-tap-target-is-not-a-44px-ring.test.ts`.
 *
 * SABOTAGE (each seen RED, then restored): the at-rest rule removed · its name not `none` · its isolation removed · a
 * `backdrop-filter` back on `.thumb [data-pick] button` · a translucent fill back on `.field` · a blur back on the field ·
 * the row without `sn-glass-row` · the shared neutral button given a fill.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = postcss.parse(readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8'));
const GLOBALS = postcss.parse(readFileSync(join(HERE, '..', '..', '..', '..', 'globals.css'), 'utf8'));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));

const norm = (x: string) => x.replace(/\s+/g, ' ').trim();
/** Every top-level (not inside an @layer / @media) rule whose selector list contains this selector. */
function topRules(root: postcss.Root, selector: string): postcss.Rule[] {
  return root.nodes.filter((n): n is postcss.Rule => n.type === 'rule' && n.selectors.some((s) => norm(s) === norm(selector)));
}
const decls = (r: postcss.Rule) => Object.fromEntries(r.nodes.filter((n): n is postcss.Declaration => n.type === 'decl').map((d) => [d.prop, norm(d.value)]));

test('(A) the page’s name is off AT REST on the guest list — so the glass row can blur — and still on while the slide runs', () => {
  const named = topRules(GLOBALS, '.sn-vt-page');
  assert.equal(named.length, 1, 'the page <main> no longer names a view transition (the bottom-nav slide needs it)');
  assert.equal(decls(named[0]!)['view-transition-name'], 'sn-page');

  const sel = 'html:not([data-sn-nav-dir]) .sn-vt-page:has([data-guests-thumb])';
  const rest = topRules(GLOBALS, sel);
  assert.equal(rest.length, 1, 'no rule turns the page name off at rest on the guest list: its glass row paints a wash, not a blur');
  const d = decls(rest[0]!);
  assert.equal(d['view-transition-name'], 'none');
  assert.equal(d['isolation'], 'isolate', 'without isolation the page loses the stacking context its name implied (the bottom bar and top bar would reorder)');
  // It must come AFTER the name (same specificity class of rule, the later wins) and sit at the top level, not in a layer.
  const all = GLOBALS.nodes;
  assert.ok(all.indexOf(rest[0]!) > all.indexOf(named[0]!), 'the at-rest rule is above the name it overrides');
  // …and it is only ever OFF when no slide is running: `NavSlideController` sets `data-sn-nav-dir` before the slide.
  assert.match(rest[0]!.selector, /:not\(\[data-sn-nav-dir\]\)/);
  const controller = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', '_components', 'nav', 'nav-slide-controller.tsx'), 'utf8'));
  assert.match(controller, /dataset\.snNavDir = dir;/, 'the slide no longer sets data-sn-nav-dir — the rule would switch the name off during it');
  assert.match(controller, /delete document\.documentElement\.dataset\.snNavDir/);
});

test('(B) nothing on the row paints a pane of its own — the row is the only glass', () => {
  const offenders: string[] = [];
  MODULE.walkRules((r) => {
    const onRow = r.selectors.some((s) => /(^|\s)\.(thumb|field)\b/.test(norm(s)) || /\[data-guests-thumb\]/.test(s));
    if (!onRow) return;
    r.walkDecls((d) => {
      if (/^(-webkit-)?backdrop-filter$/.test(d.prop)) offenders.push(`${r.selector} { ${d.prop} }`);
      if (/^(-webkit-)?mask-image$/.test(d.prop)) offenders.push(`${r.selector} { ${d.prop} }`);
      // A translucent fill on a control of the row: a second 62 % wash over the row's own.
      if (/^background(-color)?$/.test(d.prop) && /color-mix\(.*transparent\)|rgba\(|\/\s*0?\.\d/i.test(d.value)) {
        offenders.push(`${r.selector} { ${d.prop}: ${d.value} }`);
      }
    });
  });
  assert.deepEqual(offenders, [], `a control on the glass row paints a pane of its own (a nested backdrop root): ${offenders.join(' · ')}`);
  // The Sort / Set… pick sits transparent on the row, like the shared neutral buttons.
  const pick = MODULE.nodes
    .filter((n): n is postcss.Rule => n.type === 'rule' && n.selectors.some((s) => norm(s) === '.thumb [data-pick] button'))
    .map(decls)
    .find((d) => d['background']);
  assert.equal(pick?.['background'], 'transparent', 'the Sort / Set… pick is not transparent on the row');
});

test('(C) the search field is SOLID', () => {
  const field = topRules(MODULE, '.field').map(decls).find((d) => d['background']);
  assert.ok(field, 'the field has no background of its own');
  assert.equal(field!['background'], 'rgb(var(--color-cream))', 'the search field is translucent: the guest rows read through it');
  for (const r of topRules(MODULE, '.field')) {
    for (const p of Object.keys(decls(r))) assert.ok(!/backdrop|mask/.test(p), `the field carries ${p} again`);
  }
});

test('(D) the row wears the ONE shared glass class and no fill of its own', () => {
  assert.match(SCREEN, /className=\{`\$\{styles\.lower\} sn-glass-row`\}\s*\n?\s*data-on=/, 'the thumb row no longer wears sn-glass-row');
  assert.match(SCREEN, /data-guests-thumb=""/, 'the thumb row lost the marker the at-rest rule hangs on');
  for (const r of topRules(MODULE, '.lower')) {
    for (const p of Object.keys(decls(r))) assert.ok(!/^(background|backdrop|-webkit-backdrop|box-shadow|overflow)/.test(p), `.lower paints ${p} itself — it would beat or double the shared glass`);
  }
});

test('(E) the shared neutral button is transparent on the glass — what the row’s buttons rely on', () => {
  let neutral: Record<string, string> | null = null;
  GLOBALS.walkRules((r) => {
    if (r.selectors.some((s) => norm(s) === ':is(button, a).ab.ab-neutral') && decls(r)['background']) neutral = decls(r);
  });
  assert.ok(neutral, 'the shared neutral button rule is gone');
  assert.equal(neutral!['background'], 'transparent', 'the neutral button has a fill: on the glass row it would be a flat white pane again');
});
