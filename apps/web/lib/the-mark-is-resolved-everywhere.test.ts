/**
 * lib/the-mark-is-resolved-everywhere.test.ts
 *
 * ONE RULE: a surface that draws the couple's monogram asks
 * `resolveEventMonogramSvg(event)` — never `safeMonogramSvg(x.monogram_custom_svg)`.
 *
 * WHY THIS EXISTS. The Monogram Maker has promised, in a green banner, that an
 * uploaded mark "outranks the studio mark everywhere" since 2026-07-17. It did
 * not. FOUR surfaces read `monogram_custom_svg` directly and never asked the
 * resolver, so a couple who uploaded their designer's logo kept seeing the mark
 * they had replaced:
 *   · app/_components/event-monogram.tsx      (account switcher · album shelf ·
 *                                              photos tab · public /u/ profile)
 *   · app/_components/account-switcher/get-switcher-data.ts
 *   · app/api/social/card/[postId]/route.ts   (the shareable card)
 *   · app/admin/studio/_surfaces/social-queue-surface.tsx
 * Two of them did not even SELECT `monogram_uploaded_svg`, so no amount of
 * care at the render site could have saved them.
 *
 * 🔑 THE BYPASS IS INVISIBLE. It renders a real, correct-looking mark — just
 * the wrong one — so no screenshot, type error or runtime check catches it.
 * Only a source rule does. Since 2026-09-20 the resolver also applies the
 * mark's ink policy, so a bypass now loses "follow our mood board" as well.
 *
 * This guard is a SOURCE scan and says so: it proves what the code asks for,
 * not what any screen paints.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

/** This file states the rule and quotes the bypass, so it must be exempt —
 *  as must the resolver's own module, which legitimately composes the two. */
const EXEMPT = new Set([
  'lib/monogram-svg-safe.ts',
  'lib/the-mark-is-resolved-everywhere.test.ts',
  /* The Monogram Maker ITSELF is the one legitimate direct reader: it must tell
   * the two marks APART — "do you have a studio design to re-edit?" is a
   * different question from "what mark do we draw?" — so it reads each column
   * on purpose and resolves separately for the preview. */
  'app/dashboard/[eventId]/monogram/page.tsx',
  /* Column-privilege allowlists. These NAME the column for GRANT/RLS surface
   * checks; they select nothing and render nothing. */
  'lib/security/events-column-privileges.ts',
  'lib/security/events-column-select-privileges.ts',
  'lib/security/events-private-details.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => walk(r));

/* `safeMonogramSvg( <anything>.monogram_custom_svg )` — the bypass, in the
 * shapes it actually appeared in (`ev.`, `event.`, `ev?.`, `row.`). Matching
 * the ARGUMENT rather than the call is deliberate: safeMonogramSvg has other,
 * legitimate callers (the studio editor validating its own draft), and banning
 * the function outright would convict them. */
const BYPASS = /safeMonogramSvg\s*\(\s*[A-Za-z_$][\w$]*\s*\??\.\s*monogram_custom_svg/;

test('no surface reads monogram_custom_svg past the resolver', () => {
  const offenders: string[] = [];
  for (const f of FILES) {
    if (EXEMPT.has(f)) continue;
    const src = readFileSync(f, 'utf8');
    if (BYPASS.test(src)) offenders.push(f);
  }
  // Print what was searched: a guard that reports "0 offenders" without saying
  // how many files it opened is indistinguishable from a guard whose walk
  // returned nothing (green-shaped nothing — this repo has shipped that twice).
  assert.ok(FILES.length > 300, `scanned only ${FILES.length} files — the walk is broken, not the code`);
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} of ${FILES.length} files bypass resolveEventMonogramSvg:\n  ` +
      offenders.join('\n  ') +
      '\n→ use resolveEventMonogramSvg(event) and add monogram_uploaded_svg to the select.',
  );
});

test('every file that SELECTs monogram_custom_svg also selects the uploaded one', () => {
  /* The other half of the same defect: a render site can call the resolver
   * correctly and still draw the wrong mark, because its query never fetched
   * the column the resolver prefers. `undefined` is not `null` here — it reads
   * as "no upload" and falls through silently. */
  const offenders: string[] = [];
  for (const f of FILES) {
    if (EXEMPT.has(f)) continue;
    const src = readFileSync(f, 'utf8');
    for (const line of src.split('\n')) {
      // A select LIST — a quoted string naming several columns. Type
      // declarations (`monogram_custom_svg: string | null;`) are not selects.
      if (!line.includes('monogram_custom_svg')) continue;
      /* Prose is not a query. A `*`-led docblock line or a `//` comment that
       * merely NAMES the column was convicting this guard's own explanation —
       * a rule that fires on the sentence describing it is noise, and noise is
       * how a guard gets deleted. */
      const code = line.trim();
      if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) continue;
      /* A query, by either tell: the line CALLS `.select(`, or its quoted
       * string names several columns. The comma test alone would have missed a
       * single-column `.select('monogram_custom_svg')` — a real query that
       * fetches exactly the wrong one of the two marks. */
      const quoted = line.match(/['"`]([^'"`]*monogram_custom_svg[^'"`]*)['"`]/);
      if (!quoted) continue;
      const isQuery = line.includes('.select(') || (quoted[1]?.includes(',') ?? false);
      if (!isQuery) continue;
      if (line.includes('monogram_uploaded_svg')) continue;
      offenders.push(`${f} :: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `${offenders.length} select list(s) fetch the studio mark but not the uploaded one:\n  ` +
      offenders.join('\n  '),
  );
});

test('the resolver still has real callers — this guard cannot pass by emptiness', () => {
  /* The floor. Both tests above pass trivially if every caller is deleted, so
   * count the callers too: a refactor that removes the resolver from the app
   * must fail loudly rather than go green. */
  let callers = 0;
  for (const f of FILES) {
    if (f === 'lib/monogram-svg-safe.ts' || f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
    if (readFileSync(f, 'utf8').includes('resolveEventMonogramSvg(')) callers += 1;
  }
  assert.ok(
    callers >= 12,
    `only ${callers} files call resolveEventMonogramSvg — expected at least 12. ` +
      'If a surface was legitimately removed, lower this floor in the same commit and say why.',
  );
});
