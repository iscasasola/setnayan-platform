/**
 * ⏰ THE SLOTS ARE OPENED ON TIME, NOT BY LUCK (controller review of #8446, 2026-11-28). The flush otherwise runs
 * only on page traffic, so a quiet 8 AM meant a slot nobody opened. `.github/workflows/social-slots.yml` calls
 * `/api/cron/social-flush` inside every slot. This guard derives the UTC hours from SLOT_HOUR, so moving a slot
 * without moving the schedule (or the reverse) goes red.
 *
 * Sabotage (measured): changing the workflow's hours to `0,4,6` turns the hours test red; making the route skip
 * the secret check turns the auth test red; pointing the workflow at the bare domain turns the host test red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../strip-comments';
import { SLOT_HOUR } from './governor';

const repo = join(__dirname, '..', '..', '..', '..');
const workflow = readFileSync(join(repo, '.github', 'workflows', 'social-slots.yml'), 'utf8');
const route = readFileSync(join(repo, 'apps', 'web', 'app', 'api', 'cron', 'social-flush', 'route.ts'), 'utf8');

test('the schedule fires inside every slot hour, Manila → UTC, twice', () => {
  const crons = [...workflow.matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.equal(crons.length, 1, 'expected one cron line');
  const [minutes, hours] = (crons[0] ?? '').split(/\s+/);
  const utcHours = Object.values(SLOT_HOUR).map((h) => (h - 8 + 24) % 24).sort((a, b) => a - b);
  assert.deepEqual((hours ?? '').split(',').map(Number).sort((a, b) => a - b), utcHours);
  const mins = (minutes ?? '').split(',').map(Number);
  assert.ok(mins.length >= 2, 'one run plus a retry');
  assert.ok(mins.every((m) => m >= 1 && m < 60 - 15), 'every run lands well inside the slot hour, off :00');
});

test('the workflow calls the canonical host with the secret header, and never sits on deploy-prod', () => {
  assert.match(workflow, /-X POST "https:\/\/www\.setnayan\.com\/api\/cron\/social-flush"/);
  assert.match(workflow, /-H "x-cron-secret: \$\{CRON_SECRET\}"/);
  const deployProd = readFileSync(join(repo, '.github', 'workflows', 'deploy-prod.yml'), 'utf8');
  assert.doesNotMatch(deployProd, /social-flush/);
});

test('the route refuses without CRON_SECRET and runs the scheduled flush', () => {
  const code = stripComments(route);
  assert.match(code, /webhookSecretAuthorized\(req\.headers\.get\('x-cron-secret'\), secret\)/);
  assert.match(code, /if \(!ok\) return NextResponse\.json\(\{ error: 'forbidden' \}, \{ status: 403 \}\)/);
  assert.match(code, /runSocialFlush\(\{ scheduled: true \}\)/);
  assert.doesNotMatch(code, /export async function GET/, 'a GET door would let a link preview fire a flush');
});
