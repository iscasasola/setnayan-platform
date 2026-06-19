#!/usr/bin/env node
/**
 * lint-papic-keep-permanent.mjs
 *
 * Failproof guard on the free-Papic-sampler "connect Google Drive OR upgrade to
 * paid Papic = photos kept forever" promise (migration 20270103000000 lines 6-8).
 *
 * The promise is enforced across several best-effort sites. If a refactor
 * silently drops one, couples who CONVERT lose their sampler photos at day 30 —
 * the worst possible regression (it punishes the exact couples we want to keep)
 * and an invisible one (no error; the bytes just vanish 30 days later). This
 * guard fails CI the moment any link in the chain disappears.
 *
 * The chain (each must stay wired):
 *   1. paid upgrade         → sku-activation PAPIC_SEATS hook calls makeSamplerPermanent
 *   2. Drive connect        → oauth/drive/callback calls makeSamplerPermanent
 *   3. storage→Drive switch → studio/papic/actions calls makeSamplerPermanent
 *   4. retention sweep      → papic-retention self-heals a kept event (the last line of defense)
 *   5. capture-time         → papic/actions stamps expiry ONLY for is_free_sampler + born-permanent if already kept
 *   6. the keep-check itself recognizes BOTH paths (active Drive grant + paid ownership)
 *
 * Presence checks only (the regression vector is un-wiring) — pure node, no deps,
 * matches lint-entitlement-gates / lint-retired-strings.
 * Run: `node apps/web/scripts/lint-papic-keep-permanent.mjs`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');

const RED = '\x1b[31m';
const GRN = '\x1b[32m';
const RST = '\x1b[0m';

const CHECKS = [
  {
    file: 'lib/sku-activation.ts',
    must: ['PAPIC_SEATS', 'makeSamplerPermanent'],
    why: 'paid Papic upgrade (PAPIC_SEATS activation) must make existing sampler photos permanent',
  },
  {
    file: 'app/api/oauth/drive/callback/route.ts',
    must: ['makeSamplerPermanent'],
    why: 'connecting Google Drive must make existing sampler photos permanent',
  },
  {
    file: 'app/dashboard/[eventId]/studio/papic/actions.ts',
    must: ['makeSamplerPermanent'],
    why: 'switching Papic storage to Google Drive must make existing sampler photos permanent',
  },
  {
    file: 'lib/papic-retention.ts',
    must: ['eventSamplerIsKept', 'makeSamplerPermanent'],
    why: 'the retention sweep must self-heal a converted event (never delete its photos) — the last line of defense',
  },
  {
    file: 'app/papic/actions.ts',
    must: ['is_free_sampler', 'eventSamplerIsKept'],
    why: 'captures stamp a 30-day expiry ONLY for sampler seats, and a capture on an already-converted event is born permanent',
  },
  {
    file: 'lib/papic-sampler.ts',
    must: ['oauth_grants', 'eventOwnsPapicSeats'],
    why: 'the keep-check (eventSamplerIsKept) must recognize BOTH convert paths — an active Drive grant AND paid Papic ownership',
  },
];

const violations = [];
for (const check of CHECKS) {
  const abs = join(WEB_ROOT, check.file);
  if (!existsSync(abs)) {
    violations.push(
      `${check.file} — FILE MISSING (the keep-permanent wiring moved or was deleted)\n      ${check.why}`,
    );
    continue;
  }
  const src = readFileSync(abs, 'utf8');
  const missing = check.must.filter((tok) => !src.includes(tok));
  if (missing.length) {
    violations.push(`${check.file} — missing: ${missing.join(', ')}\n      ${check.why}`);
  }
}

if (violations.length) {
  console.error(`${RED}✗ Papic sampler "keep = permanent" wiring is broken:${RST}\n`);
  for (const v of violations) console.error(`  ${RED}•${RST} ${v}\n`);
  console.error(
    `${RED}A converted couple (connected Drive OR upgraded) would silently lose their\n` +
      `sampler photos at day 30. Re-wire the missing call — or, if you deliberately\n` +
      `moved the logic, update apps/web/scripts/lint-papic-keep-permanent.mjs to match.${RST}`,
  );
  process.exit(1);
}

console.log(
  `${GRN}✓ Papic sampler keep-permanent wiring intact (${CHECKS.length} sites).${RST}`,
);
