/**
 * THE PRINT KEEPSAKE IS NOT A WAY AROUND THE STORY GATE.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
 * `storyAudienceAdmits` answers a story the couple kept to *the people of this
 * celebration* with `return viewer.belongsToEvent` — that single boolean IS the
 * gate. `app/[slug]/print/page.tsx` passed it the LITERAL `true`. So on a PUBLIC
 * or UNLISTED event an anonymous stranger opening `/{slug}/print` was handed, in
 * full, the story the page beside it correctly refused them.
 *
 * 🔑 AND THE DOCBLOCK ARGUED FOR IT. It said the route's earlier gates had
 * already established membership — "canViewSlugEvent admits the event's own
 * people". That gate OPENS with `if (openToStrangers(visibility)) return true`,
 * and `openToStrangers` is public||unlisted: it admits strangers OUTRIGHT and
 * establishes nothing whatever about belonging. `robots: noindex` is not access
 * control either. *A sentence is not a mechanism* — and a confident one is worse
 * than none, because it stops the next reader looking.
 *
 * ── WHAT THIS PINS ──────────────────────────────────────────────────────────
 * 1 · THE RULE ITSELF, as a truth table. It must have no arm that answers `true`
 *   without a fact, and its no-argument default must be a stranger.
 * 2 · NO SURFACE HARDCODES THE ANSWER. Derived: every `belongsToEvent:` built
 *   anywhere in the app + lib trees, and none of them may be the literal `true`.
 *   A literal `false` is fine — that is failing closed.
 * 3 · EVERY SURFACE USES THE ONE SHARED RULE. Derived the same way: a file that
 *   builds a viewer must route through `belongsToThisEvent`, so the print sheet
 *   and the screen cannot drift into two opinions about who belongs to somebody's
 *   wedding. That drift is exactly what produced the defect: the screen derived
 *   it, the sheet did not.
 *
 * Rules 2 and 3 are DERIVED, not hand-listed — a hand-typed list of surfaces is
 * the mistake that let a third host-check clone ship green. Both are FLOORED, so
 * a sweep that stops seeing anything fails rather than reading as a pass.
 *
 * ── MUTATIONS, EACH MEASURED BY OCCURRENCE COUNT ────────────────────────────
 * · put `belongsToEvent: true` back in the print route → hardcoded sites
 *   0 → 1 · RED (rule 2), and shared-rule callers 2 → 1 · RED (rule 3).
 * · inline the `||` back into site-body instead of calling the rule →
 *   shared-rule callers 2 → 1 · RED (rule 3).
 * · make `belongsToThisEvent` return true unconditionally → RED (rule 1).
 * An unmeasured mutation proves nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { belongsToThisEvent, NOBODY } from '@/app/[slug]/_lib/belongs-to-this-event';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Strip comments first — both surfaces now EXPLAIN this defect at length, and
 *  prose about a hardcoded `true` must never read as one. */
const strip = (s: string) =>
  s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
    }
  };
  for (const root of ['app', 'lib']) walk(join(WEB, root));
  return out;
}

/**
 * Every place a viewer's belonging is CONSTRUCTED — i.e. `belongsToEvent:` given
 * a value. The module that declares the type is excluded structurally (it is the
 * one exporting `StoryViewer`), never by name, so moving it does not blind this.
 */
function belongingSites(): { file: string; value: string }[] {
  const sites: { file: string; value: string }[] = [];
  for (const file of sourceFiles()) {
    const raw = readFileSync(file, 'utf8');
    if (/export\s+type\s+StoryViewer/.test(raw)) continue;
    const src = strip(raw);
    for (const m of src.matchAll(/belongsToEvent:\s*([^,\n}]+)/g)) {
      sites.push({ file: relative(WEB, file), value: (m[1] ?? '').trim() });
    }
  }
  return sites;
}

test('the rule has no arm that says yes without a fact', () => {
  assert.equal(belongsToThisEvent(NOBODY), false);
  assert.equal(belongsToThisEvent(), false, 'a caller that establishes nothing is a stranger');
  assert.equal(
    belongsToThisEvent({ holdsGuestPass: false, isBookedSupplier: false }),
    false,
    'this is the anonymous visitor the print keepsake was handing a restricted story to',
  );
  assert.equal(belongsToThisEvent({ holdsGuestPass: true, isBookedSupplier: false }), true);
  assert.equal(belongsToThisEvent({ holdsGuestPass: false, isBookedSupplier: true }), true);
});

test('no surface hardcodes belonging — the defect was the literal `true`', () => {
  const sites = belongingSites();

  // FLOOR FIRST. Two surfaces build a viewer today (the print sheet and the
  // on-screen story). If this scan finds fewer, it has gone blind and "no
  // hardcoded sites" would be true for the wrong reason.
  assert.ok(
    sites.length >= 2,
    `only ${sites.length} belongsToEvent site(s) found — this sweep has gone blind, ` +
      'not clean. An empty sweep is never a pass.',
  );

  const hardcoded = sites.filter((s) => /^true\b/.test(s.value));
  assert.deepEqual(
    hardcoded.map((s) => `${s.file} → ${s.value}`),
    [],
    'A viewer whose belonging is the literal `true` makes storyAudienceAdmits ' +
      "answer yes to everybody, because its whole answer for an 'event'-audience " +
      'story is `return viewer.belongsToEvent`. That is how /{slug}/print handed a ' +
      'stranger a story the couple had restricted. Derive it, and fail closed.',
  );
});

test('every surface asks the ONE shared rule, so the sheet and the screen agree', () => {
  const files = Array.from(new Set(belongingSites().map((s) => s.file)));
  assert.ok(files.length >= 2, `only ${files.length} surface(s) found — the sweep is blind`);

  const missing = files.filter(
    (f) => !strip(readFileSync(join(WEB, f), 'utf8')).includes('belongsToThisEvent('),
  );
  assert.deepEqual(
    missing,
    [],
    'These surfaces answer "does this viewer belong to the celebration?" without ' +
      'the shared rule in app/[slug]/_lib/belongs-to-this-event.ts. Two copies of ' +
      'that rule is precisely how the print keepsake came to disagree with the page ' +
      'it prints — one derived the answer, the other hardcoded it.',
  );
});
