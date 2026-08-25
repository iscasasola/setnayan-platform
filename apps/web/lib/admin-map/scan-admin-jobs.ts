/**
 * scan-admin-jobs.ts — read what each admin job ASKS FOR, out of the code that
 * asks for it.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * The owner's second half of the map (2026-08-26): *"on taxonomy, it is like
 * having a pick category, and other details"*. The steps of a job are the part
 * nobody remembers — which folder, which tile, then the six details — and they
 * are already written down, in the action that performs the job. 218 of the
 * admin's 278 actions read a form; between them they name 482 fields.
 *
 * 🔑 SCANNED, NEVER TYPED — the same rule as the route map beside it. A
 * hand-written checklist is wrong the first time somebody adds a field, and
 * "you forgot a field" is exactly the kind of wrong nobody notices until a save
 * silently drops something.
 *
 * ⛔ WHAT THIS IS NOT. It records what a job asks for. It does not perform one,
 * and nothing here decides whether a job may run: money, prices, approvals and
 * anything public stay a person's press (one-person admin plan, 2026-07-11 —
 * the machine may hold back, it may never be the thing that lets through).
 *
 * Filesystem access: generator and guard only, never application code.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

export type AdminJob = {
  /** The function that does it, e.g. `createCanonicalLeaf`. */
  name: string;
  /** What a person would call it, e.g. `create canonical leaf`. */
  phrase: string;
  /** The folder the action lives in — e.g. `/admin/taxonomy`. */
  ownerPath: string;
  /**
   * The page you would actually open to do it.
   *
   * 🪤 THESE ARE NOT ALWAYS THE SAME, and the guard found it: five jobs claimed
   * a folder with no page. Three sit under `[editorialId]`, a template you reach
   * by picking a row, so the page to open is its parent. Two live in
   * `/admin/storytellers`, a folder holding actions and NOTHING else — its screen
   * moved into a Studio tab and the actions stayed behind. Sending somebody to
   * either folder sends them nowhere.
   */
  resolvedPath: string;
  /** Form fields it reads, in the order it reads them. */
  fields: string[];
  /**
   * Fields the body PROVABLY refuses when empty.
   *
   * ⚠ NOT the same as "the required fields", and named for what it measures on
   * purpose. Validation in this admin is written at least four ways — `if (!x)`,
   * a length range, an enum compare, a database lookup — and a scan that catches
   * two of them would, under the name `required`, quietly assert that everything
   * else is optional. `createCanonicalLeaf` is the worked example: it refuses an
   * empty `tile_id` with `if (!tileId)` and an empty name with
   * `label.length < 2`, and a first cut reported only the first.
   */
  refusedWhenEmpty: string[];
  /** Does it take something away? Named so a caller can treat it carefully. */
  destructive: boolean;
};

/** `createCanonicalLeaf` → `create canonical leaf`; a trailing `Action` drops. */
export function phraseFor(name: string): string {
  return name
    .replace(/Action$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

const DESTRUCTIVE = /^(delete|remove|retire|revoke|reject|archive|disable|clear|force|unpublish)/;

/**
 * The body of one exported action.
 *
 * Formatting-dependent by design: every actions file in this repo is Prettier
 * output, so a top-level function ends at a lone `}` in column 0. A parser would
 * be the honest general answer and is not worth it for one repo's own source —
 * but the guard counts how many bodies came back non-empty, so if the shape ever
 * changes this fails loudly instead of quietly returning nothing.
 */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) return '';
  const end = source.indexOf('\n}', start);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

function actionFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) actionFiles(full, out);
    else if (name.includes('actions') && name.endsWith('.ts') && !name.includes('test')) {
      out.push(full);
    }
  }
  return out.sort();
}

/** Every .tsx under the admin, so a page-less actions folder can be traced. */
function tsxFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) tsxFiles(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** `app/admin/taxonomy/actions.ts` → `/admin/taxonomy`. */
function ownerPathFor(file: string, adminRoot: string): string {
  const rel = relative(adminRoot, file).split(sep).slice(0, -1);
  const segments = rel.filter((s) => !s.startsWith('_') && !(s.startsWith('(') && s.endsWith(')')));
  return '/admin' + (segments.length ? '/' + segments.join('/') : '');
}

/** The URL folder of a source file, route groups and private folders removed. */
function routeFolderOf(file: string, adminRoot: string): string {
  const rel = relative(adminRoot, file).split(sep).slice(0, -1);
  const segments = rel.filter((s) => !s.startsWith('_') && !(s.startsWith('(') && s.endsWith(')')));
  return '/admin' + (segments.length ? '/' + segments.join('/') : '');
}

/**
 * Where to send somebody for this job. Three steps, most-certain first:
 *   1. the folder itself, if a page lives there;
 *   2. the page that IMPORTS the actions (a screen that moved into a tab);
 *   3. the nearest ancestor that is a real page (a `[param]` template).
 */
function resolvePath(
  file: string,
  ownerPath: string,
  adminRoot: string,
  pagePaths: Set<string>,
  importers: Map<string, string>,
): string {
  if (pagePaths.has(ownerPath)) return ownerPath;

  const viaImport = importers.get(relative(adminRoot, file).split(sep).join('/'));
  if (viaImport && pagePaths.has(viaImport)) return viaImport;

  const parts = ownerPath.split('/').filter(Boolean);
  while (parts.length > 1) {
    parts.pop();
    const candidate = '/' + parts.join('/');
    if (pagePaths.has(candidate)) return candidate;
  }
  return '/admin';
}

export function scanAdminJobs(adminRoot: string): AdminJob[] {
  // Which folders hold a page, and who imports each actions module. Both are
  // facts read off disk — the alternative is a hand-kept list of exceptions,
  // and a list of exceptions is a bill somebody has to keep paying.
  const pagePaths = new Set<string>();
  const importers = new Map<string, string>();
  const allTsx = tsxFiles(adminRoot);
  for (const f of allTsx) {
    if (!f.endsWith(`${sep}page.tsx`)) continue;
    const folder = routeFolderOf(f, adminRoot);
    // A `[param]` folder holds a real page and is still not somewhere you can
    // be SENT — the route map excludes it for the same reason, and the two must
    // agree or a job resolves to an address the map says does not exist.
    if (folder.includes('[')) continue;
    pagePaths.add(folder);
  }
  for (const f of allTsx) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/from '([^']*\/)?([A-Za-z0-9-]+)\/actions'/g)) {
      const folder = m[2];
      if (!folder) continue;
      const key = `${folder}/actions.ts`;
      if (!importers.has(key)) importers.set(key, routeFolderOf(f, adminRoot));
    }
  }

  const jobs: AdminJob[] = [];
  for (const file of actionFiles(adminRoot)) {
    const source = stripComments(readFileSync(file, 'utf8'));
    const ownerPath = ownerPathFor(file, adminRoot);
    const resolvedPath = resolvePath(file, ownerPath, adminRoot, pagePaths, importers);
    for (const m of source.matchAll(/^export async function ([A-Za-z0-9_]+)/gm)) {
      const name = m[1];
      if (!name) continue;
      const body = bodyOf(source, name);

      const fields: string[] = [];
      for (const f of body.matchAll(/formData\.get\(\s*'([^']+)'/g)) {
        const key = f[1];
        if (key && !fields.includes(key)) fields.push(key);
      }

      // Read from the SOURCE, never guessed from a name: half these fields are
      // optional toggles, and calling those required would build a checklist
      // that demands things nobody has to give.
      const refusedWhenEmpty: string[] = [];
      for (const f of body.matchAll(
        /const\s+([A-Za-z0-9_]+)\s*=\s*String\(formData\.get\(\s*'([^']+)'/g,
      )) {
        const [, local, key] = f;
        if (!local || !key) continue;
        // The two shapes this admin actually uses, measured across every
        // actions file: a falsy check (135 sites) and a length floor.
        const falsy = new RegExp(`if\\s*\\(\\s*!${local}\\b`).test(body);
        const tooShort = new RegExp(`${local}\\.length\\s*<`).test(body);
        const emptyString = new RegExp(`${local}\\s*===\\s*''`).test(body);
        if ((falsy || tooShort || emptyString) && !refusedWhenEmpty.includes(key)) {
          refusedWhenEmpty.push(key);
        }
      }

      jobs.push({
        name,
        phrase: phraseFor(name),
        ownerPath,
        resolvedPath,
        fields,
        refusedWhenEmpty,
        destructive: DESTRUCTIVE.test(name),
      });
    }
  }
  return jobs.sort((a, b) => a.name.localeCompare(b.name));
}
