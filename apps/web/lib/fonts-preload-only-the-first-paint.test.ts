/**
 * fonts-preload-only-the-first-paint.test.ts — A GUEST'S PHONE DOWNLOADS THE
 * FACES ITS PAGE SETS, NOT EVERY FACE WE SHIP.
 *
 * 🔴 THE FAILURE THIS EXISTS FOR IS INVISIBLE ON A LAPTOP. `next/font` preloads
 * a face by DEFAULT: leave out `preload: false` and every file of that face
 * becomes a `Link: <…>; rel=preload; as="font"` on every page that sits under
 * the declaring module — downloaded whether or not one letter is set in it.
 * Nothing breaks, nothing logs, and on wifi nobody notices. Measured on
 * 2026-09-27 (production build, 390×844, 150 ms RTT, 1.6 Mbps): a plain guest
 * page preloaded 36 font files — 1,066 KB — to set text in 4 of them, and its
 * last font landed ~8 s after the request.
 *
 * 🪤 IT HAD ALREADY BEEN FIXED ONCE, AND THE FIX SURVIVED ONLY AS A COMMENT.
 * The 2026-07-02 perf sweep set `preload: false` on the seven monogram faces in
 * `app/layout.tsx`; the move to local files (3b1fade66) dropped the setting and
 * kept the comment, which went on saying `preload: false` for two months over
 * code that preloaded all seven. So this reads the CODE — every `localFont`
 * call in the app, comments stripped — never the prose around it.
 *
 * 🔑 THE RULE: every face says `preload: false` (and `display: 'swap'`, so text
 * paints at once in the metric-matched fallback), except the faces on
 * FIRST_PAINT below, each of which carries the measurement that put it there.
 * A face is not first-paint because it is pretty or because a page CAN use it —
 * only because the first screen of the page 99% of our viewers open sets text
 * in it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
// Comments out before reading — a COMMENT saying `preload: false` is not the setting.
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

/**
 * The faces that ARE preloaded — `<file>#<const>` → why. Measured 2026-09-27 on
 * a production build with a fixture event (a plain House page, a Velvet page
 * and a Great Gatsby page), reading which text in the first 844 px is set in
 * which face (`getComputedStyle`) and which faces the browser actually loaded
 * (`document.fonts`, status "loaded").
 *
 * ⚠ EVERY ONE IS DECLARED IN `app/layout.tsx`, so every one is also preloaded
 * on the marketing site and the dashboards. That is the price of a root-layout
 * preload, and it is why this list is short.
 */
const FIRST_PAINT: Record<string, string> = {
  'app/layout.tsx#hanken':
    'THE UI FACE — every button, label and sentence of chrome on every page: the guest page’s "Together with their families", "Get inside", the cookie notice; the whole marketing home (it sets text in nothing else); the Maker and dashboards.',
  'app/layout.tsx#fraunces':
    'THE GUEST PAGE’S DISPLAY FACE — the couple’s names and the date in the masthead, the largest words on the first screen of EVERY guest page: House, Velvet and Gatsby all set them in Fraunces.',
  'app/layout.tsx#cormorant':
    'THE HOUSE THEME’S HEADINGS — the monogram, the Save-the-Date lines and every `font-display` heading of an event that never chose a theme (the default), and the loading skeleton’s couple name that paints before the page streams in.',
};

/** Every source file that can declare a face. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

type Face = { at: string; file: string; name: string; body: string; preload: 'true' | 'false' | 'absent'; srcs: string[] };

function faces(): Face[] {
  const out: Face[] = [];
  for (const abs of [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))]) {
    const raw = readFileSync(abs, 'utf8');
    if (!raw.includes('next/font/local')) continue;
    const src = stripComments(raw);
    const file = relative(WEB, abs);
    for (const m of src.matchAll(/const (\w+) = localFont\(/g)) {
      // Balanced parens from the call's opening one — the body, whatever its layout.
      let depth = 0;
      let end = (m.index ?? 0) + m[0].length - 1;
      for (; end < src.length; end++) {
        if (src[end] === '(') depth++;
        else if (src[end] === ')' && --depth === 0) break;
      }
      const body = src.slice((m.index ?? 0) + m[0].length, end);
      const p = /\bpreload:\s*(true|false)\b/.exec(body)?.[1] as 'true' | 'false' | undefined;
      const srcs = [...body.matchAll(/path:\s*'([^']+)'/g)].map((x) => resolve(dirname(abs), x[1] as string));
      out.push({ at: `${file}#${m[1]}`, file, name: m[1] as string, body, preload: p ?? 'absent', srcs });
    }
  }
  return out;
}

const ALL = faces();

test('precondition: the scan reaches every file that declares a face', () => {
  const files = new Set(ALL.map((f) => f.file));
  for (const f of [
    'app/layout.tsx',
    'app/_fonts/choice-faces.ts',
    'app/[slug]/_components/skins/site-skin.tsx',
    'app/[slug]/invite/_components/themes/velvet.tsx',
  ]) {
    assert.ok(files.has(f), `${f} declares faces and was not scanned — the guard would be blind to it`);
  }
  assert.ok(ALL.length >= 40, `precondition: faces found (${ALL.length})`);
  for (const f of ALL) assert.ok(f.srcs.length > 0, `${f.at}: no src path read — the parser missed its shape`);
});

test('📱 no face is preloaded unless the first paint sets text in it', () => {
  // `absent` IS a preload — next/font's default — and is exactly how the seven
  // monogram faces came back: the line went, the default took over.
  const offenders = ALL.filter((f) => f.preload !== 'false' && !(f.at in FIRST_PAINT)).map(
    (f) => `${f.at} (preload ${f.preload === 'absent' ? 'not stated → next/font preloads it' : f.preload})`,
  );
  assert.deepEqual(
    offenders,
    [],
    `these faces would be downloaded on every page under them, used or not — say \`preload: false\`, or measure the first paint and add them to FIRST_PAINT with the reason:\n  ${offenders.join('\n  ')}`,
  );
});

test('⚡ every first-paint face exists, and says `preload: true` in so many words', () => {
  const byAt = new Map(ALL.map((f) => [f.at, f]));
  for (const [at, why] of Object.entries(FIRST_PAINT)) {
    assert.ok(why.length > 40, `${at} needs its measured reason, not a label`);
    const f = byAt.get(at);
    // A stale entry reads as a decision and hides nothing — it must go.
    assert.ok(f, `FIRST_PAINT names ${at}, which no longer declares a face`);
    assert.equal(f.preload, 'true', `${at} is a first-paint face — state \`preload: true\`, do not lean on the default`);
  }
});

test('🌗 every face paints its text at once in the fallback (`display: swap`)', () => {
  const blocking = ALL.filter((f) => !/\bdisplay:\s*'swap'/.test(f.body)).map((f) => f.at);
  assert.deepEqual(blocking, [], `invisible text until the face arrives: ${blocking.join(', ')}`);
});

test('🔗 one file, one URL — a face declared twice says the same `preload` both times', () => {
  /*
    next/font names the emitted file `<hash>[-s][.p].woff2`: `.p` only when
    preloaded. Two declarations of ONE file that disagree about `preload` are
    TWO URLs for the same bytes, and a guest who walks from the door (which
    declares Bodoni and Jost) onto the page (which declares them again) pays for
    the file twice. The `-s` half is `adjustFontFallback`, stated on every face.
  */
  const byFile = new Map<string, Map<string, string[]>>();
  for (const f of ALL) {
    for (const s of f.srcs) {
      const m = byFile.get(s) ?? new Map<string, string[]>();
      m.set(f.preload, [...(m.get(f.preload) ?? []), f.at]);
      byFile.set(s, m);
    }
  }
  const split = [...byFile].filter(([, m]) => m.size > 1).map(([s, m]) => `${relative(WEB, s)}: ${[...m].map(([p, ats]) => `${p} ← ${ats.join(', ')}`).join(' | ')}`);
  assert.deepEqual(split, [], `one file, two URLs:\n  ${split.join('\n  ')}`);
  // Non-vacuity: files ARE shared across declarations, so the check has teeth.
  assert.ok([...byFile.values()].some((m) => [...m.values()].flat().length > 1), 'precondition: some file is declared twice');
});
