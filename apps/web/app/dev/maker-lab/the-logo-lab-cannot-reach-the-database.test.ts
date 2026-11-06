/**
 * the-logo-lab-cannot-reach-the-database.test.ts — A LAB PRESS ON STUDIO › LOGO NEVER REACHES THE DATABASE (2026-10-09; the pattern is
 * `guests-lab/the-lab-cannot-reach-the-database.test.ts`). The page's one write (`hubDraftAction`) comes from a context under its own
 * name; the lab fills it with a stand-in that only counts; the app never provides it. `&refuse=1` refuses in the database's words, which
 * the page must never print (`studio-logo-posts-the-same.test.ts`).
 *
 * THE CLAIM: (1) every name the context carries has a stand-in; (2) the page imports no action module of its own; (3) nothing but the lab
 * provides the context, and the lab wraps the Logo in it. NOT stubbed (listed): the Image layer's file read (the browser only — no write).
 *
 * SABOTAGE (each seen RED, then restored): the stand-in deleted · the page importing the real action · a provider in the app · the lab not wrapping the Logo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LAB_LOGO_ACTIONS, LAB_LOGO_REFUSALS } from './lab-logo-stand-ins';
import { isPlainSentence } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const L = join(APP, 'dashboard', '[eventId]', 'launch', '_components');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('(1) the context’s write has a lab stand-in, and the stand-ins answer locally — and refuse in database words on request', async () => {
  const ctx = read(join(L, 'logo-actions-context.tsx'));
  const real = [...ctx.slice(ctx.indexOf('export const REAL_LOGO_ACTIONS')).matchAll(/\{ (\w+) \}/g)].map((m) => m[1]);
  assert.deepEqual(real, ['hubDraftAction']);
  assert.deepEqual(Object.keys(LAB_LOGO_ACTIONS).sort(), ['hubDraftAction']);
  assert.doesNotMatch(read(join(HERE, 'lab-logo-stand-ins.ts')) + read(join(HERE, 'lab-logo-actions.tsx')), /from '[^']*(?:-actions|\/actions)'/, 'the lab imports a real action module');
  const ok = await LAB_LOGO_ACTIONS.hubDraftAction!('e', new FormData());
  assert.ok(ok.ok);
  const refused = await LAB_LOGO_REFUSALS.hubDraftAction!('e', new FormData());
  assert.ok(!refused.ok && !isPlainSentence(refused.error ?? ''), 'the refusal is not in the database’s words');
});

test('(2) the page takes its action from the context and imports no action module of its own', () => {
  const src = read(join(L, 'maker-logo.tsx'));
  assert.match(src, /useLogoActions\(\)/);
  assert.doesNotMatch(src, /from '[^']*(?:hub-draft-actions|\/actions)'/);
});

test('(3) nothing but the lab provides the context, and the lab wraps the Logo in it', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (name === 'node_modules' || name === '.next') continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name) && /LogoActionsProvider|LogoActionsContext\.Provider/.test(readFileSync(p, 'utf8'))) hits.push(p.slice(APP.length + 1));
    }
  };
  walk(APP);
  assert.deepEqual(hits.sort(), ['dashboard/[eventId]/launch/_components/logo-actions-context.tsx', 'dev/maker-lab/lab-logo-actions.tsx']);
  assert.match(read(join(HERE, 'maker-lab-shell.tsx')), /<LabLogoActions refuse=\{[^}]*\}>\s*<MakerLogoDoor/, 'the lab’s Logo is not wrapped in the stand-in');
});
