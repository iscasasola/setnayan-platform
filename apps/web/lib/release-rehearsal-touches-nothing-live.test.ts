import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { assertLocalUrl, isLocalUrl } from '../tests/rehearsal/local-only';

/**
 * THE RELEASE REHEARSAL MUST NOT BE ABLE TO REACH PRODUCTION.
 *
 * `.github/workflows/release-rehearsal.yml` replays every migration, seeds
 * rows and walks the app as a host — against a throw-away stack on a GitHub
 * runner. Pointed at the live database by one wrong variable, the same run
 * would write a fixture wedding into production and replay 1,500 migrations at
 * a database that went down on 2026-10-08 under one person in the Maker.
 *
 * "It only ever gets a local address" is a habit, and a habit is not a control.
 * These are the controls:
 *   1. the one function every rehearsal script passes its address through
 *      refuses anything that is not loopback — tested by BEHAVIOUR, with the
 *      look-alike hosts that a `startsWith`/`includes` check lets through;
 *   2. every script that is handed an address calls it;
 *   3. the workflow names no secret and no repository variable, never links a
 *      Supabase project, never calls Vercel, and its two fixed addresses are
 *      loopback;
 *   4. it is a button: no push, pull_request or schedule trigger.
 */

const WEB = process.cwd();
const REHEARSAL = join(WEB, 'tests', 'rehearsal');
const WORKFLOW = join(WEB, '..', '..', '.github', 'workflows', 'release-rehearsal.yml');

/** The workflow with its `#` comment lines dropped — prose about a banned
 *  construct ("never `supabase link`") is not the construct. */
function workflowCode(): string {
  return readFileSync(WORKFLOW, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

test('loopback addresses are accepted', () => {
  for (const ok of [
    'http://127.0.0.1:54321',
    'http://localhost:3000/login',
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    'http://[::1]:3000',
  ]) {
    assert.equal(isLocalUrl(ok), true, ok);
    assert.doesNotThrow(() => assertLocalUrl(ok, 'test'));
  }
});

test('anything that is not this machine is refused — including the look-alikes', () => {
  for (const bad of [
    'https://njrupjnvkjkitfctetvi.supabase.co',
    'postgresql://postgres:secret@db.njrupjnvkjkitfctetvi.supabase.co:5432/postgres',
    'https://www.setnayan.com',
    'https://setnayan-platform-web.vercel.app',
    // The shapes a prefix / substring check lets through:
    'http://localhost.evil.example/',
    'http://127.0.0.1.nip.io/',
    'http://localhost@evil.example/',
    'http://evil.example/?host=127.0.0.1',
    'http://10.0.0.5:54321',
    'not a url',
    '',
  ]) {
    assert.equal(isLocalUrl(bad), false, bad);
    assert.throws(() => assertLocalUrl(bad, 'test'), /REFUSED/, bad);
  }
});

test('a refusal never repeats the password it was handed', () => {
  assert.throws(
    () => assertLocalUrl('postgresql://postgres:hunter2-secret@db.example.supabase.co:5432/postgres', 'the database'),
    (e: unknown) => e instanceof Error && !e.message.includes('hunter2-secret') && e.message.includes('db.example.supabase.co'),
  );
});

test('every rehearsal script that is handed an address passes it through the guard', () => {
  for (const file of ['apply-migrations.mts', 'count-proxy.mts', 'seed.mts', 'journey.spec.ts']) {
    const code = stripComments(readFileSync(join(REHEARSAL, file), 'utf8'));
    assert.match(code, /assertLocalUrl\(/, `${file} no longer guards its address with assertLocalUrl`);
  }
  // The driver must guard BEFORE it can spawn psql: the guard lives in
  // connect(), and main() calls connect() first.
  const driver = stripComments(readFileSync(join(REHEARSAL, 'apply-migrations.mts'), 'utf8'));
  assert.match(driver, /async function main\(\): Promise<void> \{\s*connect\(\);/);
});

test('the workflow names no secret and no repository variable', () => {
  const code = workflowCode();
  assert.doesNotMatch(code, /\$\{\{[^}]*\b(secrets|vars)\./);
});

test('the workflow never links a project, never calls Vercel, never fires a hook', () => {
  const code = workflowCode();
  assert.doesNotMatch(code, /supabase\s+link/);
  assert.doesNotMatch(code, /\bvercel\s+(build|deploy|pull|env)\b/);
  assert.doesNotMatch(code, /DEPLOY_HOOK/);
  assert.doesNotMatch(code, /--project-ref/);
});

test('the only database the workflow pushes to is the loopback one', () => {
  const code = workflowCode();
  const dbUrl = /REHEARSAL_DB_URL:\s*(\S+)/.exec(code)?.[1] ?? '';
  assert.equal(isLocalUrl(dbUrl), true, `REHEARSAL_DB_URL is ${dbUrl || '(missing)'}`);
  const appDb = /NEXT_PUBLIC_SUPABASE_URL:\s*(\S+)/.exec(code)?.[1] ?? '';
  assert.equal(isLocalUrl(appDb), true, `NEXT_PUBLIC_SUPABASE_URL is ${appDb || '(missing)'}`);
  const pushes = code
    .split('\n')
    .filter((l) => /supabase\s+db\s+push/.test(l) && !/^\s*-\s*name:/.test(l));
  assert.ok(pushes.length > 0, 'the rehearsal no longer runs the production push command');
  for (const line of pushes) {
    assert.match(line, /--db-url "\$REHEARSAL_DB_URL"/, `a db push without the loopback url: ${line.trim()}`);
    assert.match(line, /--include-all/, 'the rehearsal must push the way deploy-prod.yml does');
  }
});

test('the workflow can read the repository and nothing more', () => {
  const code = workflowCode();
  const block = /^permissions:\n((?:[ \t]+.*\n)+)/m.exec(code)?.[1] ?? '';
  assert.equal(block.trim(), 'contents: read');
});

test('the public flags file holds public flags only', () => {
  const lines = readFileSync(join(REHEARSAL, 'flags.env'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
  for (const line of lines) assert.match(line, /^NEXT_PUBLIC_[A-Z0-9_]+=/, line);
});

test('the required e2e check does not pick the rehearsal walk up', () => {
  // The walk needs a seeded database only the rehearsal workflow has. If the
  // e2e config ever globbed tests/rehearsal, every pull request would go red.
  const e2e = stripComments(readFileSync(join(WEB, 'playwright.config.ts'), 'utf8'));
  assert.match(e2e, /testDir:\s*'\.\/tests\/e2e'/);
});
