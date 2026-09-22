/**
 * the-public-media-host-is-one-fact.test.ts
 *
 * ── The drift ───────────────────────────────────────────────────────────────
 * Two docblocks stated, as current fact, things that were not true:
 *
 *   · `r2-client-ref.ts` — "(`R2_PUBLIC_URL` → `media.setnayan.com`)"
 *   · `next.config.ts`   — "`R2_PUBLIC_URL` is unset in production today"
 *
 * Measured 2026-09-22: `media.setnayan.com` does not resolve, `setnayan-media`
 * has **no** custom domain in the Cloudflare dashboard, its Public Development
 * URL is the only public path, and `R2_PUBLIC_URL` **is** set in Vercel
 * production (Secret, 2026-09-07). Both claims were stale in opposite
 * directions on the same subject.
 *
 * 🔑 THE COST IS NOT THE WRONG HOSTNAME, IT IS THE LOST TRUST. `r2-client-ref`'s
 * docblock is the security argument for why presigning a media key is safe —
 * an argument that turns on the bucket being public, not on which hostname
 * serves it, so it stayed correct. But a reader checking the one verifiable
 * claim in it would have found a host that resolves to nothing, and had no way
 * to tell which of the surrounding claims were also stale.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * ⚠ NOT a phrasing ban. `media.setnayan.com` may be named freely — it is in the
 * CSP allowlist, in retirement notes, and in "does not resolve" warnings that
 * are the correct thing to say. A ban would convict those and still miss a
 * reword. The property is narrower and real: **no file may state that string as
 * the VALUE of `R2_PUBLIC_URL`**, because that is the one claim production
 * contradicts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '../..');

/** The host production actually serves media from. Pinned by S14, re-measured 2026-09-22. */
const LIVE_PUBLIC_MEDIA_HOST = 'pub-37d64fe618584c2981a88610a55dd439.r2.dev';

/** The host that does NOT resolve and is not being set up (owner ruling 2026-09-05). */
const DEAD_HOST = 'media.setnayan.com';

test('no file names the dead host as the VALUE of R2_PUBLIC_URL', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const offenders: string[] = [];
  let scanned = 0;

  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (SKIP.has(e)) continue;
      const abs = join(dir, e);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      // 🪤 SKIP TESTS — this file QUOTES the bad pattern to document it, so the
      // first run convicted itself. A test that names the binding is recording
      // history, not claiming it. Same exclusion every tree-scanner here uses.
      if (!/\.(ts|tsx|mjs)$/.test(abs) || abs.includes('.test.')) continue;
      scanned += 1;
      const text = readFileSync(abs, 'utf8');
      if (!text.includes(DEAD_HOST)) continue;

      // An ASSERTION of the binding, not a mention. Matches the shapes a
      // docblock actually uses: `R2_PUBLIC_URL` → host, R2_PUBLIC_URL = host,
      // R2_PUBLIC_URL is host. Deliberately does NOT match "e.g." examples,
      // which are legitimate — publicUrlFor's own warning suggests it as a
      // custom domain someone MIGHT set, which is true and useful advice.
      const asserts = new RegExp(
        String.raw`R2_PUBLIC_URL\`?\s*(?:→|->|=|\bis\b|\bpoints at\b)\s*\`?(?:https://)?` +
          DEAD_HOST.replace(/\./g, '\\.'),
      );
      if (asserts.test(text)) offenders.push(abs.slice(REPO.length + 1));
    }
  };
  walk(join(WEB, 'lib'));
  walk(join(WEB, 'app'));
  walk(join(WEB, 'scripts'));

  console.log(`[media-host] scanned ${scanned} files · ${offenders.length} assert the dead host`);
  assert.ok(scanned > 500, `only ${scanned} files scanned — the walk is not reaching the tree`);
  assert.deepEqual(
    offenders,
    [],
    `A file states ${DEAD_HOST} as the value of R2_PUBLIC_URL. It does not resolve, ` +
      `setnayan-media has no custom domain, and the owner ruled 2026-09-05 that it is not being ` +
      `set up. Production serves from ${LIVE_PUBLIC_MEDIA_HOST}.\n  ` + offenders.join('\n  '),
  );
});

test('next.config does not claim R2_PUBLIC_URL is unset in production', () => {
  const cfg = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
  assert.doesNotMatch(
    cfg,
    /R2_PUBLIC_URL`? is unset in production/,
    'next.config.ts claims R2_PUBLIC_URL is unset in production. It is set (vercel env ls ' +
      'production — Secret, 2026-09-07) and holds the r2.dev host. Re-measure before restoring ' +
      'this line; `vercel env ls` answers set/not-set decisively even though the value is hidden.',
  );
});

test('the docs and the code agree on how many R2 buckets exist', () => {
  const r2 = readFileSync(join(WEB, 'lib/r2.ts'), 'utf8');
  const block = r2.slice(r2.indexOf('export const R2_BUCKETS'), r2.indexOf('} as const', r2.indexOf('export const R2_BUCKETS')));
  const count = (block.match(/'setnayan-[a-z-]+'/g) ?? []).length;

  const claude = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8');
  const m = /(\d+)\s+Cloudflare R2 buckets/.exec(claude);

  console.log(`[media-host] R2_BUCKETS has ${count}; CLAUDE.md claims ${m?.[1] ?? 'nothing'}`);
  assert.ok(m, 'CLAUDE.md no longer states an R2 bucket count — restore it or drop this check');
  assert.equal(
    Number(m[1]),
    count,
    'CLAUDE.md and lib/r2.ts disagree on how many R2 buckets exist. CLAUDE.md is the file every ' +
      'session reads first, and it said "4" for months while the code and the dashboard both had 5.',
  );
});
