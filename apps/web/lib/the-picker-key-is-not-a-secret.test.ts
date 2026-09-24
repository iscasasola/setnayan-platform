/**
 * the-picker-key-is-not-a-secret.test.ts — TWO VALUES, TWO DRAWERS.
 *
 * The Google Drive card now carries two Google credentials that travel to
 * OPPOSITE places:
 *
 *   · the OAuth CLIENT SECRET — must never reach a browser, encrypted, on the
 *     deny-by-default `platform_integration_secrets`;
 *   · the PICKER API KEY — must reach a browser, because Google's Picker
 *     script reads it off the page. On the public `platform_settings`.
 *     ⚠ The COUPLE'S browser, in the website editor — the Picker is a dashboard
 *     control, and the exposure baseline agrees: anon=- , authenticated=S.
 *
 * 🔴 ONE OF THOSE TWO MISTAKES IS UNRECOVERABLE. Publishing a client secret
 * means rotating it and re-authorising every couple. Encrypting a key we then
 * publish is only theatre — but it is the kind of theatre that makes the next
 * person file the secret the same way. So the filing is guarded, not trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { projectNumberFromClientId } from './integrations/project-number';
import { stripComments } from './strip-comments';

const MIGRATIONS = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const REGISTRY = readFileSync(join(__dirname, 'integrations', 'registry.ts'), 'utf8');
const PICKER_SQL = readFileSync(
  join(MIGRATIONS, '20271243181043_the_picker_key_is_public_by_design.sql'),
  'utf8',
);

test('🔒 the picker key is on platform_settings, and NOWHERE near the secrets', () => {
  assert.match(
    PICKER_SQL,
    /ALTER TABLE public\.platform_settings\s+ADD COLUMN IF NOT EXISTS google_picker_api_key TEXT;/,
    'it belongs with the other public config',
  );
  // No migration anywhere may put a picker column on the secrets table.
  const offenders: string[] = [];
  for (const f of readdirSync(MIGRATIONS)) {
    if (!f.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    if (!/picker/i.test(sql)) continue;
    // The proof block in our own migration NAMES the secrets table in order to
    // refuse it; that is the opposite of adding a column there.
    const adds = [...sql.matchAll(/ADD COLUMN IF NOT EXISTS\s+([a-z_]+)/g)].map((m) => m[1] as string);
    const onSecrets = /ALTER TABLE public\.platform_integration_secrets/.test(sql);
    if (onSecrets && adds.some((c) => /picker/i.test(c))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `a key we publish is stored as a secret in: ${offenders.join(', ')}`);
});

test('🔒 it is a config field, not a secretColumn', () => {
  const at = REGISTRY.indexOf("id: 'google_drive'");
  assert.ok(at > 0, 'the Drive integration exists');
  const def = REGISTRY.slice(at, REGISTRY.indexOf('guidance:', at));
  assert.match(def, /column: 'google_picker_api_key'/, 'the picker key is a config field');
  // `secretColumn` on this integration must still be the OAuth secret alone.
  const secret = /secretColumn: '([a-z_]+)'/.exec(def)?.[1];
  assert.equal(secret, 'google_drive_oauth_client_secret_enc', 'the secret slot is untouched');
  assert.doesNotMatch(def, /secretColumn: '[a-z_]*picker/, 'the picker key is never the secret');
});

test('⭐ the card says out loud that the key leaves the server', () => {
  const at = REGISTRY.indexOf("column: 'google_picker_api_key'");
  const field = REGISTRY.slice(at, at + 400);
  assert.match(field, /label: '[^']*public[^']*'/i, 'the label warns on the field itself');
  // 🔑 A note in a docblock is not a label. The person pasting a key reads the
  // form, not the source — the same reason a log line never changed a pixel.
  assert.match(field, /browser/i, 'and says where it goes');
});

test('⛔ the project number is DERIVED, never a second column', () => {
  assert.equal(
    projectNumberFromClientId('330619827695-4spudpm9uud7fa95g8itfclt5sdpom98.apps.googleusercontent.com'),
    '330619827695',
  );
  for (const junk of [null, undefined, '', 'nope', 'abc-def.apps.googleusercontent.com', 42, '123-x.example.com']) {
    assert.equal(
      projectNumberFromClientId(junk as string),
      null,
      `${JSON.stringify(junk)} must not become a project number`,
    );
  }
  // No column may hold it. Two homes for one fact drift the moment the client
  // is rotated, and the drift looks like two plausible values in a console.
  const offenders: string[] = [];
  for (const f of readdirSync(MIGRATIONS)) {
    if (!f.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    for (const m of sql.matchAll(/ADD COLUMN IF NOT EXISTS\s+([a-z_]+)/g)) {
      if (/project_number|cloud_project/i.test(m[1] as string)) offenders.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, [], `the project number is stored as well as derived: ${offenders.join(', ')}`);
});

test('🪤 the pure rule does not sit behind a server-only import', () => {
  // `registry.ts` imports `server-only`, which throws before a single assertion
  // can run — a decision filed there is a decision nothing can hold down.
  // 🪤 COMMENTS STRIPPED FIRST. This file's own docblock EXPLAINS the
  // server-only split, so a raw search found the words and called the pure
  // module contaminated — a matcher firing on the documentation of the fix,
  // for the third time in this session. It is the `import` that matters.
  const pure = stripComments(
    readFileSync(join(__dirname, 'integrations', 'project-number.ts'), 'utf8'),
  );
  assert.doesNotMatch(pure, /server-only/, 'the testable half must stay importable');
  assert.match(REGISTRY, /export \{ projectNumberFromClientId \} from '\.\/project-number';/,
    'and the registry re-exports it, so callers need not know about the split');
});
