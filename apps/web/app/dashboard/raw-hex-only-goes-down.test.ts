/**
 * raw-hex-only-goes-down.test.ts — 🌙 THE COUPLE'S DASHBOARD PAINTS FROM TOKENS; A RAW HEX CAN ONLY BE REMOVED.
 *
 * WHY. The couple's `/dashboard` area opened to dark on 18 Nov 2026 (owner: "dark mode. YES :D" · pick 5, "the couple's
 * /dashboard goes dark first"). A colour written as a hex in a screen file does not follow the theme: it stays the
 * light value on a dark screen — a white card, an espresso word, a pale chip. Before the area was put on the
 * ready-list (`DARK_READY`, lib/appearance.ts) its screen colours were moved onto tokens; this file is what stops the
 * next one from being typed back in.
 *
 * WHAT IT COUNTS. Every hex colour literal (`#rgb`, `#rrggbb`, `#rrggbbaa`) in the non-test `.ts` / `.tsx` / `.css`
 * files under `app/dashboard`, comments removed with the repo's one stripper, summed PER AREA (the folder under
 * `[eventId]`, or under `(account)`). Each area's count may only go DOWN from `raw-hex.baseline.json`.
 *
 * WHAT IS LEFT IN THE BASELINE, AND WHY IT IS NOT ZERO. A hex that is a colour the PERSON or the ART owns is not
 * chrome and must not follow the theme: the couple's own palette and monogram colours (data), a drawing of a phone, a
 * camera or a wax seal, the seat-plan lab's own stage, print and PDF routes (always light — owner call 9, 13 Oct), the
 * schedule's phase swatches, a status tone that already carries its `html.dark` pair in the same stylesheet. Those are
 * what the remaining numbers are. A NEW one needs the same honest reason — and the usual answer is a token.
 *
 * TO LOWER A COUNT after removing hexes: `WRITE_HEX_BASELINE=1 pnpm exec tsx --test app/dashboard/raw-hex-only-goes-down.test.ts`
 * (it refuses to raise any number). Never edit the JSON by hand to go green.
 *
 * SABOTAGE (each run once, each went red): `style={{ color: '#123456' }}` added to budget/page.tsx → the budget area ·
 * a new folder with one hex and no baseline row → "an area with no baseline".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'raw-hex.baseline.json');
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/** `[eventId]/budget/page.tsx` → `[eventId]/budget` · `(account)/billing/x.tsx` → `(account)/billing` · `page.tsx` → `(root)`. */
export function areaOf(rel: string): string {
  const parts = rel.split('/');
  if (parts.length === 1) return '(root)';
  if ((parts[0] === '[eventId]' || parts[0] === '(account)') && parts.length > 2) return `${parts[0]}/${parts[1]}`;
  return parts[0]!;
}

/** A hex colour, not an id: `#7098` inside a word such as `PR #7098` is prose, and prose lives in comments (stripped). */
export function countHex(source: string, isCss: boolean): number {
  const code = isCss ? source.replace(/\/\*[\s\S]*?\*\//g, '') : stripComments(source);
  return (code.match(HEX) ?? []).length;
}

function scan(): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$/.test(name) || /\.harness\.tsx?$/.test(name)) continue;
      const n = countHex(readFileSync(abs, 'utf8'), name.endsWith('.css'));
      if (n === 0) continue;
      const area = areaOf(relative(HERE, abs));
      out[area] = (out[area] ?? 0) + n;
    }
  };
  walk(HERE);
  return out;
}

type Baseline = { _about: string; total: number; areas: Record<string, number> };

test('the couple’s dashboard: raw hex colours per area only go down', () => {
  const now = scan();
  const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;

  if (process.env.WRITE_HEX_BASELINE === '1') {
    const raised = Object.entries(now).filter(([a, n]) => a in base.areas && n > base.areas[a]!);
    assert.deepEqual(raised, [], 'refusing to RAISE a count — remove the hex, do not record it');
    const areas = Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b)));
    const next: Baseline = { _about: base._about, total: Object.values(areas).reduce((s, n) => s + n, 0), areas };
    writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
    return;
  }

  assert.ok(Object.keys(now).length >= 10, 'anti-vacuity: the scan read too few areas — it has gone blind');
  const over: string[] = [];
  for (const [area, n] of Object.entries(now)) {
    const allowed = base.areas[area];
    if (allowed === undefined) over.push(`${area}: ${n} raw hex in an area with no baseline — paint from a token (bg-raised, text-ink, var(--m-…), rgb(var(--color-…)))`);
    else if (n > allowed) over.push(`${area}: ${n} raw hex, the baseline is ${allowed} — a colour was typed as a hex; read a token instead`);
  }
  assert.deepEqual(over, [], 'a raw hex colour does not follow dark mode — /dashboard paints dark since 18 Nov 2026');
  assert.equal(
    base.total,
    Object.values(base.areas).reduce((s, n) => s + n, 0),
    'the baseline total does not match its rows — it was edited by hand',
  );
});

test('the counter can see a hex — and is not fooled by a comment or an id', () => {
  assert.equal(countHex(`const a = { color: '#C24E25', bg: "#fff" };`, false), 2);
  assert.equal(countHex(`// was #C24E25 (PR #7098)\nconst a = 1; /* #fff */`, false), 0);
  assert.equal(countHex(`.x { color: #2c2a29; } /* #ffffff */ .y { background: #1c1a16cc; }`, true), 2);
  assert.equal(countHex(`className="bg-[#17160F] text-raised"`, false), 1);
  assert.equal(areaOf('[eventId]/budget/_components/x.tsx'), '[eventId]/budget');
  assert.equal(areaOf('(account)/billing/page.tsx'), '(account)/billing');
  assert.equal(areaOf('[eventId]/layout.tsx'), '[eventId]');
  assert.equal(areaOf('page.tsx'), '(root)');
});
