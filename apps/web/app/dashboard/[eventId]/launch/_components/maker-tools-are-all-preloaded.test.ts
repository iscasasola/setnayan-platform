/**
 * 🧰 EVERY MAKER TOOL IS PRELOADED — NONE CAN BE FORGOTTEN.
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE MAKER DOWNLOADS ALL ITS TOOLS RIGHT
 * AFTER IT OPENS — EVERY TAP IS INSTANT"): *"a guard fails if any tool is left
 * out of the preload"*, and the thin line under the top bar reaches 100% only
 * when every tool is loaded.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────
 *   1. Walk what the Maker can run the way Next builds it: the launch page's
 *      server graph to its client boundaries, everything those import
 *      statically, and — transitively — everything an `import()` there loads.
 *      EVERY `import()` target found is covered by the registry
 *      (`maker-tools.tsx`) or named in NOT_A_TOOL below with its reason. A new
 *      lazy panel anywhere in the Maker fails here until it is listed.
 *   2. Every module the registry imports is used by one of its jobs (an import
 *      with no job would look covered and load nothing).
 *   3. The Maker hands the WHOLE registry to the preload queue — `MAKER_TOOLS`
 *      itself, never a filtered copy — first in line, and only that hook drives
 *      the line under the top bar.
 *   4. The line reaches 100% only when every tool has loaded: with one tool
 *      failed it ends short (`short`), never `done`.
 *   5. NOT_A_TOOL names no stale entry (each is still found by the walk).
 * Floors prove the walk is not vacuous.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { createPreloader, preloadFraction, type PreloadJob, type PreloadProgress } from '@/lib/app-preload';

const WEB = resolve(__dirname, '../../../../..');
const L = 'app/dashboard/[eventId]/launch/_components';
const PAGE = join(WEB, 'app/dashboard/[eventId]/launch/page.tsx');
const REGISTRY = join(WEB, L, 'maker-tools.tsx');
/** The layouts above the Maker — their client boundaries load with it too. */
const LAYOUTS = ['app/layout.tsx', 'app/dashboard/layout.tsx', 'app/dashboard/[eventId]/layout.tsx'];

/**
 * `import()` targets the Maker can reach that are NOT tool panels — each with
 * the reason it is not preloaded. Add a line here only with a reason a person
 * would accept; a panel the couple taps belongs in MAKER_TOOLS instead.
 */
const NOT_A_TOOL: Record<string, string> = {
  '@sentry/nextjs': 'error reporting — loaded at idle by its own path (deferred-observability), not a panel',
  'lib/telemetry/fault-observer.ts': 'the Problems observer — installed at idle by deferred-observability on every page, nothing a person taps opens it; not a panel',
  'posthog-js': 'analytics — only after cookie consent, never preloaded',
  'app/dashboard/[eventId]/website/hub-draft-actions.ts': 'the Event Hub draft\'s ONE server action (a reference, not a panel), reached by the Wedding March at its first drop (2026-10-06, the march waits for Apply) so opening the march reaches for no server door — and already in hand by then: `details-your-event.tsx`, warmed by the preloaded Details tool (`details-lazy`), imports it statically',
  'lib/celebration-engine.ts': 'the When yes celebration\'s canvas engine (owner 2026-10-06) — not a panel: it only draws the tiny previews inside the open Celebration ▾ list (the list itself is already loaded) and plays on the guest page frame, which fetches it as the frame opens',
  'lib/vendor-qr-guard-client.ts': 'runs on a file the couple picked (upload pipeline) — there is nothing to run before the pick',
  'app/_components/pill-thumb.tsx': 'the pill selector\'s travelling thumb (owner 2026-10-08, "selectors are pills that slide") — not a panel and nothing a tap waits for: until it has measured, the picked choice paints the pill itself, so the selector is complete and usable without it; it loads right after first paint, by the selector that draws it',
  'lib/watermark.ts': 'runs on a file the couple picked (upload pipeline)',
  'lib/upload-send.ts': 'the upload run itself (sign, then PUT — lifted out of the uploader 2026-10-08) — not a panel: it runs on a file the couple picked, and the uploader fetches it the moment its file picker is opened, so the first upload does not wait on it; warming it for every Maker open would download it for the many who never upload',
  'lib/audio-guard-client.ts': 'reads a song the couple picked, to refuse one that will not play on every phone (upload pipeline) — there is nothing to run before the pick',
  'lib/image-compress.ts': 'runs on a file the couple picked (upload pipeline)',
  'app/onboarding/wedding/_data/ph-places.ts': 'data, not a panel — the ~80 KB PSGC place list City or area searches once the couple TYPES (the curated cities are already in the panel); loaded on the first keystroke exactly as onboarding loads it, never ahead of a search (owner 2026-10-04, B4)',
  'lib/video-compress.ts': 'runs on a video the couple picked (upload pipeline)',
  '@ffmpeg/ffmpeg': 'video compression of a picked file — megabytes of WebAssembly, never on a hunch',
  '@ffmpeg/util': 'video compression of a picked file (with @ffmpeg/ffmpeg)',
  jsqr: 'reads a QR inside a picked image (upload pipeline)',
  qrcode: 'draws a payment QR on a checkout step — not a Maker tool',
  'app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx': 'the 3D seat view (three.js, ~150KB+) — opened by its own 3D button; three.js stays out of every preload',
  'app/_components/plan3d/plan3d-scene.tsx': 'the 3D plan view (three.js) — same reason',
  'app/_components/plan3d/kit/cinematic.tsx': 'the 3D plan view (three.js) — same reason',
  'app/papic/actions.ts': 'Papic camera/offline handlers (the service-worker drain), not the Maker',
  'lib/clip-poster.ts': 'Papic camera/offline handlers, not the Maker',
  'lib/offline/service-handlers/papic-vendor-drain.ts': 'Papic offline drain, not the Maker',
  'app/_components/home/HomeOverlays.tsx': 'the marketing site’s overlays — not the signed-in app',
  'app/dashboard/[eventId]/_components/more-services-sheet.tsx': 'the event bottom bar’s More sheet — under the Maker, not one of its tools',
  'lib/native-oauth.ts': 'the phone app’s Apple/Google sign-in (Capacitor bridge, Turnstile) — loaded on the sign-in tap inside the app only, never in the Maker; a web visitor must not download it (train 2026-10-04 e)',
  'lib/last-seen/client.ts': 'the last-seen store (a host’s kept Home/Guests/Suppliers/Schedule/Details pages) — warmed on idle by the event layout itself, not a Maker panel',
};

const rel = (p: string) => relative(WEB, p);
const read = (p: string) => readFileSync(p, 'utf8');
const lead = String.raw`^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*`;
const isClient = (src: string) => new RegExp(`${lead}['"]use client['"]`).test(src);
const isServerOnly = (f: string, src: string) => /\.server\.tsx?$/.test(f) || new RegExp(`${lead}['"]use server['"]`).test(src);

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (/\.(tsx?|jsx?|mjs)$/.test(c) && existsSync(c)) return c;
  }
  return null;
}
/** A target's name: the repo path of a file, or the bare package. */
const targetName = (from: string, spec: string) => {
  const r = resolveSpec(from, spec);
  return r ? rel(r) : spec.startsWith('.') || spec.startsWith('@/') ? `UNRESOLVED ${spec}` : spec;
};

export function staticImports(src: string): string[] {
  const s = stripComments(src);
  const out: string[] = [];
  const re = /(?:^|[;\n}])\s*(import|export)\s+(type\s+)?([^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[2]) continue;
    if (m[1] === 'export' && !m[3]) continue;
    out.push(m[4]!);
  }
  return out;
}
/** `import('…')` specifiers, with or without a webpack magic comment. */
export function dynamicImports(src: string): string[] {
  // Comments go first (a magic comment goes with them; the specifier stays).
  return [...stripComments(src).matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!);
}

/** Every `import()` the Maker can run: target name → the files that ask for it. */
function makerDynamicTargets() {
  const boundaries = new Set<string>();
  const server = new Set<string>();
  const stack = [PAGE, ...LAYOUTS.map((l) => join(WEB, l)).filter(existsSync)];
  while (stack.length) {
    const f = stack.pop()!;
    if (server.has(f) || boundaries.has(f)) continue;
    const src = read(f);
    if (isClient(src)) {
      boundaries.add(f);
      continue;
    }
    server.add(f);
    for (const spec of staticImports(src)) {
      const r = resolveSpec(f, spec);
      if (r) stack.push(r);
    }
  }
  const seen = new Set<string>();
  const targets = new Map<string, Set<string>>();
  const walk = [...boundaries];
  while (walk.length) {
    const f = walk.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = read(f);
    if (isServerOnly(f, src)) continue; // a server action / server module: not code the phone runs
    for (const spec of staticImports(src)) {
      const r = resolveSpec(f, spec);
      if (r) walk.push(r);
    }
    for (const spec of dynamicImports(src)) {
      const name = targetName(f, spec);
      if (!targets.has(name)) targets.set(name, new Set());
      targets.get(name)!.add(rel(f));
      const r = resolveSpec(f, spec);
      if (r) walk.push(r);
    }
  }
  return { boundaries, closure: seen, targets };
}

/**
 * What the registry covers: each stand-in module it loads (by `import()`, then
 * warmed whole — `warmDynamicExports`) covers every `import()` inside that
 * module; a package it loads directly covers itself.
 */
export function registryCoverage(registryFile: string, registrySrc: string) {
  const covered = new Set<string>();
  const imports: Array<{ module: string; warmed: boolean }> = [];
  const s = stripComments(registrySrc);
  for (const m of s.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)(\.then\(\s*warmDynamicExports\s*\))?/g)) {
    const name = targetName(registryFile, m[1]!);
    covered.add(name);
    const file = resolveSpec(registryFile, m[1]!);
    imports.push({ module: name, warmed: Boolean(m[2]) });
    if (file) for (const spec of dynamicImports(read(file))) covered.add(targetName(file, spec));
  }
  // The Love Story's live pieces are declared by the Maker's shell (their chunk keeps one
  // parent) and handed to the registry with registerLiveLoveStory(...).
  const shellFile = join(WEB, L, 'maker-shell.tsx');
  const shell = read(shellFile);
  const handed = /registerLiveLoveStory\(([^)]*)\)/.exec(stripComments(shell));
  for (const name of handed ? handed[1]!.split(',').map((n) => n.trim()).filter(Boolean) : []) {
    const decl = new RegExp(String.raw`const\s+${name}\s*=\s*dynamic\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]`).exec(shell);
    if (decl) covered.add(targetName(shellFile, decl[1]!));
  }
  return { covered, imports };
}

const walk = makerDynamicTargets();
const registrySrc = read(REGISTRY);
const coverage = registryCoverage(REGISTRY, registrySrc);
const toolsArray = (() => { // the MAKER_TOOLS array's own source
  const s = stripComments(registrySrc);
  const i = s.indexOf('export const MAKER_TOOLS');
  assert.ok(i >= 0, 'maker-tools.tsx no longer exports MAKER_TOOLS');
  return s.slice(i);
})();

test('floors — the walk reaches the Maker, its stand-ins and their pieces', () => {
  assert.ok(walk.boundaries.size >= 30, `only ${walk.boundaries.size} client boundaries — the resolver stopped resolving`);
  assert.ok(walk.closure.size >= 300, `only ${walk.closure.size} modules reached`);
  for (const t of [`${L}/details-your-event.tsx`, 'app/dashboard/[eventId]/studio/mood-board/_components/theme-studio.tsx', 'app/dashboard/[eventId]/website/our-story/_components/love-story-live.tsx', 'opentype.js']) {
    assert.ok(walk.targets.has(t), `the walk no longer finds import('${t}') — it is not seeing the Maker's lazy panels`);
  }
  assert.ok(coverage.covered.size >= 50, `the registry covers only ${coverage.covered.size} pieces`);
});

test('the detectors can fire — a magic-comment import(), a commented-out one, a stand-in loaded by the registry', () => {
  assert.deepEqual(dynamicImports(`const A = dynamic(() => import(/* webpackChunkName: "maker-x" */ './a'));`), ['./a']);
  assert.deepEqual(dynamicImports(`// const B = dynamic(() => import('./b'));\n/* import('./c') */`), []);
  const fake = registryCoverage(REGISTRY, `load: () => import(/* webpackChunkName: "maker-mood-board" */ '../../studio/mood-board/_components/mood-board-lazy').then(warmDynamicExports),`);
  assert.ok(fake.covered.has('app/dashboard/[eventId]/studio/mood-board/_components/theme-studio.tsx'));
});

test('1 · every import() the Maker can run is a preloaded tool, or not a tool for a stated reason', () => {
  const missing = [...walk.targets]
    .filter(([t]) => !coverage.covered.has(t) && !(t in NOT_A_TOOL))
    .map(([t, from]) => `${t}  (loaded by ${[...from].join(', ')})`);
  assert.deepEqual(
    missing,
    [],
    `A lazy panel the Maker can open is not in the preload — its first tap would wait for a download:\n  ${missing.join('\n  ')}\n` +
      `Add it to MAKER_TOOLS in ${L}/maker-tools.tsx (an import() of its stand-in module, .then(warmDynamicExports)), ` +
      `or — only if it is not a tool — give it a reasoned line in NOT_A_TOOL here.`,
  );
});

test('1b · a tool loaded by import() but left out of the registry fails (sabotage check of the rule itself)', () => {
  const withoutMoodBoard = registryCoverage(REGISTRY, registrySrc.replace(/[^\n]*mood-board-lazy[^\n]*\n/, ''));
  const leaked = [...walk.targets.keys()].filter((t) => !withoutMoodBoard.covered.has(t) && !(t in NOT_A_TOOL));
  assert.ok(leaked.some((t) => t.includes('studio/mood-board/_components/theme-studio')), 'dropping the Mood Board from the registry went unnoticed');
});

test('2 · every stand-in the registry loads is warmed whole, and nothing of the Maker is imported statically', () => {
  for (const { module, warmed } of coverage.imports) {
    if (!module.startsWith('app/')) continue; // a library (opentype.js) is loaded, not warmed
    assert.ok(warmed, `maker-tools loads ${module} without warming it (.then(warmDynamicExports)) — its first tap would still show a placeholder`);
  }
  const statics = staticImports(registrySrc).filter((p) => !p.startsWith('@/lib/'));
  assert.deepEqual(statics, [], 'maker-tools imports Maker code statically — loaded from a host’s other pages, that pulls the Maker page’s chunks into the webpack runtime every page loads');
  assert.ok(coverage.imports.length >= 7, `the registry loads only ${coverage.imports.length} things`);
});

test('3 · the Maker hands the WHOLE registry to the queue, first in line, and draws its progress', () => {
  const hook = stripComments(read(join(WEB, L, 'maker-preload-line.tsx')));
  assert.match(hook, /appPreloader\(\)\.preload\(MAKER_TOOLS,\s*\{\s*first:\s*true,\s*onProgress:\s*setProgress\s*\}\)/, 'useMakerPreload no longer queues MAKER_TOOLS itself (first, with progress)');
  const shell = stripComments(read(join(WEB, L, 'maker-shell.tsx')));
  assert.match(shell, /const preload = useMakerPreload\(hasWork\)/);
  assert.match(shell, /^registerLiveLoveStory\(LiveLoveStoryBook, LiveStoryPanel\);$/m, 'the shell no longer hands its Love Story pieces to the registry');
  assert.match(shell, /<MakerPreloadLine progress=\{preload\} \/>/);
  // ONE mechanism: nothing else in the Maker schedules its own idle fetch.
  for (const f of ['maker-shell.tsx', 'details-lazy.tsx', 'details-workspace.tsx']) {
    assert.doesNotMatch(stripComments(read(join(WEB, L, f))), /requestIdleCallback|prefetchDetails|prefetchMoodBoard|prefetchSchedule|prefetchSeating/, `${f} schedules a second preload`);
  }
});

test('4 · the line reaches 100% only when every tool has loaded', async () => {
  const tools: PreloadJob[] = ['a', 'b', 'c'].map((k) => ({ key: `maker:${k}`, load: () => (k === 'b' ? Promise.reject(new Error('dropped')) : Promise.resolve()) }));
  const idle: Array<() => void> = [];
  const q = createPreloader({ saveData: false, afterLoad: (cb) => cb(), whenIdle: (cb) => idle.push(cb) });
  const seen: PreloadProgress[] = [];
  q.preload(tools, { first: true, onProgress: (p) => seen.push(p) });
  while (idle.length) {
    idle.shift()!();
    await new Promise((r) => setTimeout(r, 0));
  }
  const last = seen.at(-1)!;
  assert.equal(last.finished, true);
  assert.equal(last.loaded, 2);
  assert.ok(seen.every((p) => p.loaded < p.total), 'the line filled although a tool failed');
  assert.ok(preloadFraction(last) < 1);
});

test('5 · NOT_A_TOOL holds no stale line', () => {
  const stale = Object.keys(NOT_A_TOOL).filter((t) => !walk.targets.has(t));
  assert.deepEqual(stale, [], `NOT_A_TOOL names targets the Maker no longer loads — delete them:\n  ${stale.join('\n  ')}`);
});
