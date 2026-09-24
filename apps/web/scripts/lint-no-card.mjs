#!/usr/bin/env node
/**
 * lint-no-card.mjs — NO NEW CARDS.
 *
 * The design brief (owner, 2026-09-24 · DESIGN_BRIEF_2026-09-24.md §3) bans
 * cards: "do not segment content using white or light-gray bordered boxes,
 * standard rounded rectangles, grid containers, or card-based modules." Group
 * by whitespace, type scale and layered depth instead. The owner ruled the same
 * day that radius (and a hairline) STAY on things you can press — buttons,
 * inputs, chips — so this bans the COMBINATION on CONTAINERS only.
 *
 * ── WHAT IT COUNTS ──────────────────────────────────────────────────────────
 * Per file, the source lines that carry BOTH class tokens:
 *   · a bare `border` (the 1px all-sides box — not `border-t`, not a colour),
 *   · `rounded-lg|xl|2xl|3xl|card|tile` (the container radii; `rounded-md` and
 *     `rounded-full` are control/chip radii and do not count).
 * Variant prefixes are read through (`sm:rounded-2xl` counts). Comments are
 * stripped first with the repo's ONE stripper (`port-controls.mjs`), so prose
 * that names the pattern is not the pattern.
 *
 * Not counted:
 *   · a line whose element is a control — `<button>`, `<input>`, `<select>`,
 *     `<textarea>`, `<summary>`, or a component named `…Button`. Found by the
 *     nearest opening tag at most four lines above (see `elementOf`);
 *   · a line carrying a `no-card-ok` comment — for a chip or a pressable that
 *     is not one of those tags. Say why in the same comment.
 *
 * ── A RATCHET, NOT A BAN ────────────────────────────────────────────────────
 * The tree already holds hundreds of cards; redesigning them is the work of
 * the redesign, one screen at a time, looked at. So the committed baseline
 * (`no-card.baseline.txt`) freezes today's per-file count, and the guard fails
 * only when a file's count RISES or a file not in the baseline has any. When a
 * redesign removes cards, run `--update-baseline` in the same PR so the lower
 * count is locked in and cannot grow back. (Modelled on
 * `lint-guest-legibility.mjs`.)
 *
 * Usage (from apps/web):
 *   pnpm lint:no-card
 *   node scripts/lint-no-card.mjs --update-baseline
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './port-controls.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = resolve(HERE, '..');
export const BASELINE_PATH = join(HERE, 'no-card.baseline.txt');

const SCAN_DIRS = ['app', 'components'];
const EXTENSIONS = ['.tsx', '.ts'];
const INLINE_OK = 'no-card-ok';
/** Below this the walk has gone blind and every file would "pass". */
export const MIN_FILES = 1500;

const CONTAINER_RADIUS = /^rounded-(?:lg|xl|2xl|3xl|card|tile)$/;
const CONTROL_TAGS = new Set(['button', 'input', 'select', 'textarea', 'summary']);
const isControlTag = (tag) => CONTROL_TAGS.has(tag) || /Button$/.test(tag);

/** A class token with its variant prefixes and `!` removed: `sm:!border` → `border`. */
function baseOf(token) {
  return token.split(':').pop().replace(/^!/, '');
}

/** Does this (comment-stripped) line hold a bare `border` and a container radius? */
export function holdsCard(line) {
  let border = false;
  let radius = false;
  for (const raw of line.split(/[\s"'`{}(),;]+/)) {
    if (!raw) continue;
    const base = baseOf(raw);
    if (base === 'border') border = true;
    else if (CONTAINER_RADIUS.test(base)) radius = true;
    if (border && radius) return true;
  }
  return false;
}

/**
 * The element a class line belongs to: the nearest `<Tag` on this line or up
 * to four lines above, stopping if that tag has already CLOSED (a `>` that is
 * not an arrow's). Returns null when unknown — an unknown element COUNTS, so a
 * mis-read can only over-report, never hide a card.
 */
export function elementOf(lines, i) {
  for (let j = i; j >= Math.max(0, i - 4); j--) {
    // On the class line itself, only a tag BEFORE the radius token can own it:
    // in `<div className="rounded-xl border"><button>` the element is the div.
    const cut = j === i ? lines[j].search(/rounded-(?:lg|xl|2xl|3xl|card|tile)/) : -1;
    const line = cut >= 0 ? lines[j].slice(0, cut) : lines[j];
    const tags = [...line.matchAll(/<([A-Za-z][\w.]*)/g)];
    if (tags.length) {
      const last = tags[tags.length - 1];
      if (j < i) {
        const after = line.slice(last.index + last[0].length).replace(/=>/g, '');
        if (after.includes('>')) return null;
      }
      return last[1];
    }
    if (j < i && line.replace(/=>/g, '').includes('>')) return null;
  }
  return null;
}

/** Every card line in one file's source: `{ lineNumber, text }`. */
export function cardLines(source) {
  const raw = source.split('\n');
  const lines = stripComments(source).split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (!holdsCard(lines[i])) continue;
    if (raw[i] && raw[i].includes(INLINE_OK)) continue;
    const tag = elementOf(lines, i);
    if (tag && isControlTag(tag)) continue;
    hits.push({ lineNumber: i + 1, text: raw[i].trim() });
  }
  return hits;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((e) => name.endsWith(e)) && !/\.test\.tsx?$/.test(name)) yield full;
  }
}

/** Scan the tree: `{ files, counts: { 'apps/web/…': n }, hits }`. */
export function scan(webRoot = WEB_ROOT) {
  const repoRoot = resolve(webRoot, '..', '..');
  let files = 0;
  const counts = {};
  const hits = {};
  for (const d of SCAN_DIRS) {
    const abs = join(webRoot, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      files++;
      const found = cardLines(readFileSync(file, 'utf8'));
      if (found.length) {
        const rel = relative(repoRoot, file).split(sep).join('/');
        counts[rel] = found.length;
        hits[rel] = found;
      }
    }
  }
  return { files, counts, hits };
}

/** Baseline file → `{ path: count }`. Lines are `<count> <path>`; `#` is a comment. */
export function parseBaseline(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^(\d+)\s+(\S.*)$/);
    if (m) out[m[2]] = Number(m[1]);
  }
  return out;
}

export function formatBaseline(counts) {
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return [
    '# lint:no-card baseline — lines per file holding a bare `border` AND a container',
    '# radius (rounded-lg|xl|2xl|3xl|card|tile). GENERATED — never hand-edit:',
    '#   node apps/web/scripts/lint-no-card.mjs --update-baseline',
    '# A RATCHET: a count may fall, never rise; a file not listed may hold none.',
    `# ${rows.length} files · ${total} lines`,
    ...rows.map(([p, n]) => `${n} ${p}`),
    '',
  ].join('\n');
}

/** Files whose count rose above the baseline (or are new with any). */
export function compare(counts, baseline) {
  const violations = [];
  for (const [rel, count] of Object.entries(counts)) {
    const allowed = baseline[rel] ?? 0;
    if (count > allowed) violations.push({ rel, count, allowed });
  }
  return violations;
}

function main() {
  const update = process.argv.includes('--update-baseline');
  const { files, counts, hits } = scan();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (files < MIN_FILES) {
    console.error(`FAIL · lint:no-card scanned only ${files} files (expected ≥ ${MIN_FILES}) — the walk has gone blind.`);
    process.exit(1);
  }

  if (update) {
    writeFileSync(BASELINE_PATH, formatBaseline(counts));
    console.log(`baseline updated · ${Object.keys(counts).length} files · ${total} card lines`);
    process.exit(0);
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('FAIL · scripts/no-card.baseline.txt is missing. Run: node scripts/lint-no-card.mjs --update-baseline');
    process.exit(1);
  }
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  if (baseTotal > 0 && total === 0) {
    console.error('FAIL · lint:no-card found ZERO card lines against a non-empty baseline — the matcher has gone blind.');
    process.exit(1);
  }

  const violations = compare(counts, baseline);
  if (violations.length === 0) {
    const lower = Object.entries(baseline).filter(([rel, n]) => (counts[rel] ?? 0) < n).length;
    console.log(`OK · lint:no-card · ${files} files · ${total} card lines, none above baseline (${baseTotal}).`);
    if (lower) console.log(`   ${lower} file(s) are BELOW baseline — run --update-baseline to lock the gain in.`);
    process.exit(0);
  }

  const inCI = process.env.GITHUB_ACTIONS === 'true';
  console.error(`\nFAIL · lint:no-card: ${violations.length} file(s) added a card (bordered + rounded container):\n`);
  for (const v of violations) {
    console.error(`  ${v.rel} — ${v.count} card line(s), baseline allows ${v.allowed}`);
    for (const h of hits[v.rel]) {
      console.error(`    :${h.lineNumber}  ${h.text.slice(0, 110)}`);
      if (inCI) {
        console.log(
          `::error file=${v.rel},line=${h.lineNumber}::A bordered, rounded container — the 2026-09-24 design brief bans cards. Group by space and type, not a box.`,
        );
      }
    }
    console.error('');
  }
  console.error('How to fix:');
  console.error('  1. Drop the box: separate by space and type (padding, type scale), not a border.');
  console.error('     Depth, where it is needed, is shadow + glass (`.sn-glass-bare`), not a border.');
  console.error('  2. A control (chip, pressable pill) that is not a <button>/<input>: add a');
  console.error('     `// no-card-ok: <why>` comment on that line.');
  console.error('  3. Never raise the baseline to go green. It is regenerated only to LOWER counts.');
  console.error('  See build-sessions/DESIGN-FOUNDATION.md.');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
