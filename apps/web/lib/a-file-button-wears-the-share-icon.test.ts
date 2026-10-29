import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * 📤 A FILE BUTTON WEARS THE SHARE ICON — owner, 27–28 Oct 2026: *"the button should be like the share icon where
 * they can download it view it, open the file"* · *"yes share"* (DECISION_LOG 2026-10-28 "CHAT — EIGHT OWNER
 * ANSWERS" (7)).
 *
 * Every control that hands the person a FILE (the Guests Excel, prints, exports, budget CSV, calendar files, QR /
 * pass / ticket saves, PDFs, zips, reels saved to the phone) opens the phone's share sheet — so it wears lucide
 * `Share` (the box with the up arrow), the mark the Guests "Save as Excel" ≡ choice already wore. Never the
 * download arrow, and never `Share2` (the app's "share a link" node). The WORDS stay ("Save PDF", "Budget (.csv)");
 * only the mark changed. An icon that names WHAT the file is (CalendarPlus on "Add to calendar", Table2 on the tag
 * list, Printer on a printable) is not a download arrow and stays.
 *
 * The property, two ways:
 *   1 · no file under app/ (admin and dev aside) that mounts a save mechanism imports a generic download arrow;
 *   2 · lucide `Download` is imported nowhere under app/ (admin and dev aside) but the named allowlist below —
 *       which catches a file button built on a bare `<a download>` that mounts no mechanism at all.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const APP = join(WEB, 'app');

/** The ways this repo hands the person a file. */
const SAVE_MECHANISM =
  /<SaveFileLink\b|<PrintSaveButton\b|\busePrintSave\s*\(|\bsaveFileToDevice\s*\(|\bsaveMediaToDevice\s*\(|\bshareBlobToDevice\s*\(|<OpenFileLink\b|<QrActions\b|<QrCard\b|<SavePassCardButton\b/;

/** The generic download arrows lucide ships — the marks a file button no longer wears. */
const DOWNLOAD_ARROWS = new Set(['Download', 'ImageDown', 'ArrowDownToLine', 'HardDriveDownload', 'FileDown', 'DownloadCloud', 'CloudDownload']);

/**
 * Lucide `Download` that is genuinely NOT a file button — each with its reason. A new entry needs a reason a reader
 * can check; "it was easier" is not one.
 */
const ALLOWED_DOWNLOAD: Record<string, string> = {
  // The desktop-app download page's "Download for Mac / Windows" — installing the app, not keeping a file of yours.
  'app/download/_download-motion.tsx': 'installs the Setnayan desktop app (a marketing "download the app" CTA)',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(WEB, p).split(sep).join('/');
const SOURCES = walk(APP)
  .map((p) => ({ rel: rel(p), src: stripComments(readFileSync(p, 'utf8')) }))
  .filter(({ rel: r }) => !r.startsWith('app/admin/') && !r.startsWith('app/dev/'));

/** The names a file imports from lucide-react (an `X as Y` alias counts as X). */
function lucideImports(src: string): string[] {
  const names: string[] = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const spec of (m[1] ?? '').split(',')) {
      const name = spec.trim().split(/\s+as\s+/)[0]?.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

test('the sweep reads app/ and finds the save mechanisms (else it proves nothing)', () => {
  assert.ok(SOURCES.length > 500, `only ${SOURCES.length} files read`);
  const mounting = SOURCES.filter(({ src }) => SAVE_MECHANISM.test(src));
  assert.ok(mounting.length >= 20, `only ${mounting.length} files mount a save mechanism — the pattern has rotted`);
});

test('1 · a file that hands the person a file imports no download arrow', () => {
  const bad = SOURCES.filter(({ rel: r, src }) => SAVE_MECHANISM.test(src) && !(r in ALLOWED_DOWNLOAD))
    .flatMap(({ rel: r, src }) => lucideImports(src).filter((n) => DOWNLOAD_ARROWS.has(n)).map((n) => `${r} → ${n}`));
  assert.deepEqual(bad, [], `a file button wears a download arrow — use lucide Share (the box with the up arrow):\n${bad.join('\n')}`);
});

test('2 · lucide Download is imported nowhere in app/ but the named allowlist', () => {
  const bad = SOURCES.filter(({ rel: r, src }) => !(r in ALLOWED_DOWNLOAD) && lucideImports(src).includes('Download')).map(({ rel: r }) => r);
  assert.deepEqual(bad, [], `lucide Download imported — a file button wears Share; anything else joins ALLOWED_DOWNLOAD with its reason:\n${bad.join('\n')}`);
  for (const [r, why] of Object.entries(ALLOWED_DOWNLOAD)) {
    const f = SOURCES.find((s) => s.rel === r);
    assert.ok(f, `${r}: allowlisted but gone — drop the line`);
    assert.ok(lucideImports(f.src).includes('Download'), `${r}: allowlisted but no longer imports Download — drop the line`);
    assert.ok(why.length > 10, `${r}: an allowlist entry needs its reason`);
  }
});

test('the shipped default: PrintSaveButton draws Share when the caller names no icon, and the Guests Excel keeps it', () => {
  const psb = SOURCES.find((s) => s.rel === 'app/dashboard/[eventId]/launch/_components/print-save-button.tsx')!.src;
  assert.match(psb, /\(icon \?\? Share\)/, 'the action variant’s default icon is not Share');
  assert.match(psb, /<Share aria-hidden className="h-4 w-4"/, 'the primary/secondary variant does not draw Share');
  const guests = SOURCES.find((s) => s.rel === 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx')!.src;
  assert.match(guests, /icon: <Share /, 'the Guests "Save as Excel" choice lost its Share mark');
});

test('Share, never Share2, on a file button: the save strip and the QR card’s file button', () => {
  const strip = SOURCES.find((s) => s.rel === 'app/_components/qr-actions.tsx')!.src;
  assert.ok(lucideImports(strip).includes('Share') && !lucideImports(strip).includes('Share2'), 'qr-actions.tsx: the file button is not lucide Share');
  const card = SOURCES.find((s) => s.rel === 'app/_components/qr-card.tsx')!.src;
  assert.ok(lucideImports(card).includes('Share'), 'qr-card.tsx: the Download (file) button is not lucide Share');
});
