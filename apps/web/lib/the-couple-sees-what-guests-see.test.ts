/**
 * lib/the-couple-sees-what-guests-see.test.ts
 *
 * ONE RULE: every mount of <SaveTheDateFilm> passes the animation inputs.
 *
 * WHY. Two places mount that component — the guest page
 * (app/[slug]/_components/save-the-date.tsx) and the couple's builder
 * (app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx).
 * The guest mount passed `animatedMonogram` + `studioAnim`; the builder mount
 * did not. The film has a static <img> fallback for exactly the case where they
 * are absent, so the builder rendered a still mark with NO error, NO warning and
 * NO visual defect — it simply showed something different from what guests saw.
 *
 * 🔑 THE BUYER COULD NOT SEE THE THING THEY BOUGHT. Animated Monogram is paid,
 * and the one screen built to preview the Save-the-Date was the one screen that
 * would not play it.
 *
 * A prop that is OPTIONAL and has a graceful fallback cannot be enforced by the
 * type checker — `markSvg` alone type-checks perfectly. Only a rule about the
 * mounts catches a mount that forgets.
 *
 * SOURCE SCAN. This proves what the JSX passes, not what any pixel does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);
const REQUIRED = ['animatedMonogram=', 'studioAnim='];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Every `<SaveTheDateFilm …>` opening tag, sliced to the END OF THAT TAG.
 *  Slicing to "the next component" or a fixed number of lines would read props
 *  belonging to a sibling and pass on a mount that omits them. */
function mountsIn(src: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf('<SaveTheDateFilm', from);
    if (at === -1) break;
    /* PROSE IS NOT A MOUNT. A docblock that NAMES the component — including the
     * one above this function and the one in the builder explaining this very
     * fix — is not JSX. Without this the guard counted 4 mounts where the app
     * has 2, i.e. it convicted the sentences describing it. Same failure the
     * resolver guard hit; a rule that fires on its own explanation gets
     * deleted by the next person, which is worse than no rule. */
    const lineStart = src.lastIndexOf('\n', at) + 1;
    const lead = src.slice(lineStart, at).trimStart();
    if (lead.startsWith('*') || lead.startsWith('//') || lead.startsWith('/*')) {
      from = at + 1;
      continue;
    }
    // The opening tag ends at the first '>' that is not inside a {…} expression
    // or a "…" string — a prop like `title={a > b}` must not end the tag early.
    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = at; i < src.length; i++) {
      const c = src[i] as string;
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) break;
    out.push(src.slice(at, end + 1));
    from = end + 1;
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => walk(r)).filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

test('every <SaveTheDateFilm> mount receives the animation inputs', () => {
  const failures: string[] = [];
  let mounts = 0;

  for (const f of FILES) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('<SaveTheDateFilm')) continue;
    for (const tag of mountsIn(src)) {
      mounts += 1;
      const missing = REQUIRED.filter((p) => !tag.includes(p));
      if (missing.length > 0) failures.push(`${f} — missing ${missing.join(' + ')}`);
    }
  }

  /* The FLOOR. Both halves of this rule pass trivially when no mount is found —
   * a renamed component, a broken walk, or a mount split across a variable all
   * produce a confident, meaningless green. Count them and say the number. */
  assert.equal(
    mounts,
    2,
    `expected exactly 2 <SaveTheDateFilm> mounts (the guest page and the couple's builder), found ${mounts}. ` +
      'If a third surface legitimately mounts the film, raise this number in the same commit — and pass it the animation inputs.',
  );
  assert.deepEqual(failures, [], `${failures.length} of ${mounts} mounts render a STATIC mark:\n  ` + failures.join('\n  '));
});

test('the tag slicer stops at the opening tag, not at some later ">"', () => {
  /* The guard is only as good as its window. A slicer that ran past the tag
   * would find `studioAnim=` on a LATER component and pass a mount that omits
   * it — the failure mode this repo has shipped before. Prove the window with
   * a fixture whose props are absent from the tag but present just after it. */
  const fixture =
    '<SaveTheDateFilm markSvg={a > b} title="x > y" />\n' +
    '<Other animatedMonogram={m} studioAnim={s} />';
  const tags = mountsIn(fixture);
  assert.equal(tags.length, 1);
  assert.ok(tags[0]?.endsWith('/>'), `sliced tag ended unexpectedly: ${tags[0]}`);
  assert.ok(!tags[0]?.includes('animatedMonogram='), 'the window leaked into the NEXT component');
  // …and a tag that really does carry them is seen.
  const good = mountsIn('<SaveTheDateFilm animatedMonogram={m} studioAnim={s} />');
  assert.ok(good[0]?.includes('animatedMonogram=') && good[0]?.includes('studioAnim='));
});
