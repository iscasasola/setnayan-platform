import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

/**
 * 🐞 A FILE NEVER TRAPS THE APP — owner, 2026-10-27, screenshot from the iPhone app: *"download excel on the app when
 * pressed opened the file with no close button and it did not download"* · *"shouldn't it try to open to if they have
 * an app to open it. or save it?"* · then: fold every other download with the same trap into the same fix.
 *
 * The app's web view (Capacitor iOS) ignores `download` and RENDERS a file in its only view — no back, no close,
 * nothing saved. Three shapes did it, and each is swept here over every screen a couple, guest or supplier can reach
 * (admin and the dev labs are desktop-only and skipped):
 *
 *   1. a JSX `<a … download>` whose tap is not taken over (`onClick` with `preventDefault`) — a calendar file, a CSV,
 *      a zip, a QR image, a presigned R2 file. Same-origin routes and `data:` URIs go through `SaveFileLink` (fetch
 *      with the session → share sheet / download); presigned R2 files that are viewed go through `OpenFileLink` (the
 *      in-app browser sheet).
 *   2. a link straight at a FILE ROUTE (a calendar `.ics`, an `/export`, a `gallery-zip`, a `…/download` route)
 *      without `download` at all — the same render-in-place, one attribute quieter.
 *   3. a file made in the page and handed over by a programmatic `a.download = …` click with NO share-sheet path in
 *      the same file — the web view has no Downloads folder, so it saves nothing (`saveFileToDevice` exists for this).
 *
 * Swept, not listed: a new screen with a bare download link is caught without anyone updating this file.
 *
 * 🛡 SABOTAGE (2026-10-27, seen RED then restored): the Guest list's Excel button with its `e.preventDefault()`
 * removed; `event-card-menu.tsx`'s calendar back to a bare `<a href={icsHref} download>`.
 */

const WEB = join(__dirname, '..');
const APP = join(WEB, 'app');
const SKIP_DIRS = new Set(['node_modules', '.next', 'admin', 'dev']);

function sources(): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push({ rel: relative(WEB, full), src: stripComments(readFileSync(full, 'utf8')) });
      }
    }
  };
  walk(APP);
  return out;
}

/** Every JSX `<a …>` opening tag, attributes included — scanned with brace depth so an `=>` inside `{…}` does not end it. */
function anchorTags(src: string): string[] {
  const tags: string[] = [];
  const re = /<a(?=[\s>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + 2;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(src.slice(m.index, i + 1));
  }
  return tags;
}

const hasDownloadAttr = (tag: string) => /\sdownload(?=[\s=>/]|$)/.test(tag);
/**
 * The tap is taken over: an inline handler that calls `preventDefault()`, or a NAMED handler whose own body calls it.
 * Not "the file calls it somewhere" — `onClick={close}` on a calendar link passed that way while still rendering the
 * .ics in place.
 */
const takesOverTheTap = (tag: string, src: string) => {
  if (/onClick=\{[\s\S]*preventDefault\(\)/.test(tag)) return true;
  const named = /onClick=\{(\w+)\}/.exec(tag)?.[1];
  if (!named) return false;
  return new RegExp(`\\b(?:const|function)\\s+${named}\\b[^{]*\\{[\\s\\S]{0,300}?preventDefault\\(\\)`).test(src);
};
/** An href that names a file route: a calendar file, a spreadsheet export, a photo zip, a token's download route. */
const FILE_ROUTE = /href=\{?[`'"][^`'"]*(?:\.ics\b|\/export\b|gallery-zip|\}\/download\b|\/calendar\.ics)/;

test('1 · no `<a download>` on an app screen leaves the tap to the web view', () => {
  const offenders: string[] = [];
  for (const { rel, src } of sources()) {
    for (const tag of anchorTags(src)) {
      if (hasDownloadAttr(tag) && !takesOverTheTap(tag, src)) offenders.push(`${rel}: ${tag.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  }
  assert.deepEqual(offenders, [], `bare download links — use SaveFileLink (same-origin / data:) or OpenFileLink (presigned R2):\n${offenders.join('\n')}`);
});

/**
 * Links that match the file-route shape but open a PAGE, each with its reason. Keyed by the exact href source, so an
 * entry can never excuse a different link in the same file — and an entry whose link is gone fails below.
 */
const PAGES_NOT_FILES: Record<string, string> = {
  // (2026-10-28: "Print budget" left this list — the owner ruled "signed in": in the app it opens in the app's own view
  // through `PrintBudgetLink`, which takes over the tap, so the sweep above passes it on its own.)
};

test('2 · no plain link points straight at a file route', () => {
  const offenders: string[] = [];
  const seen = new Set<string>();
  for (const { rel, src } of sources()) {
    for (const tag of anchorTags(src)) {
      const page = Object.keys(PAGES_NOT_FILES).find((h) => tag.includes(h) && PAGES_NOT_FILES[h] === rel);
      if (page) {
        seen.add(page);
        continue;
      }
      if (FILE_ROUTE.test(tag) && !takesOverTheTap(tag, src)) offenders.push(`${rel}: ${tag.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  }
  assert.deepEqual(offenders, [], `links that render a file in place — use SaveFileLink:\n${offenders.join('\n')}`);
  const stale = Object.keys(PAGES_NOT_FILES).filter((h) => !seen.has(h));
  assert.deepEqual(stale, [], `PAGES_NOT_FILES excuses a link that no longer exists — remove the entry:\n${stale.join('\n')}`);
});

test('3 · a file made in the page is never handed over by a download click alone', () => {
  const offenders = sources()
    .filter(({ src }) => /\.download\s*=/.test(src) && !/navigator\.share\(/.test(src))
    .map(({ rel }) => rel);
  assert.deepEqual(offenders, [], `programmatic downloads with no share-sheet path — use saveFileToDevice (lib/save-to-device.ts):\n${offenders.join('\n')}`);
});

test('4 · the sweep can see: the mechanisms themselves are found and pass', () => {
  const all = sources();
  const save = all.find((s) => s.rel.endsWith('app/_components/save-file-link.tsx'));
  assert.ok(save, 'the sweep no longer reaches SaveFileLink — it is walking the wrong tree');
  const tags = anchorTags(save.src);
  assert.ok(tags.some((t) => hasDownloadAttr(t) && takesOverTheTap(t, save.src)), 'the scanner no longer recognises a taken-over download anchor');
  assert.ok(all.length > 500, `only ${all.length} files swept — the walk is broken`);
});
