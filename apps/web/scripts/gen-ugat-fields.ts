#!/usr/bin/env tsx
/**
 * gen-ugat-fields.ts — write the committed FIELDS layer of the Root map (slice 2).
 *
 *   pnpm --filter @setnayan/web ugat:fields             # write lib/ugat/fields.generated.json
 *   pnpm --filter @setnayan/web ugat:fields --stdout    # print it (the CI check uses this)
 *
 * Reads the committed Screens map (`ugat:screens` first) and attaches, to each
 * screen id, the `table.column` facts it reads and writes, the actions it can
 * call and the calculations it shows. GENERATED, NEVER AUTHORED — the posture
 * of gen-ugat-screens.ts; `scripts/check-ugat-screens.mjs` refuses a stale file.
 *
 * WHEN TO RE-RUN: after changing a form, a server action's writes or a select.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { scanFields } from '../lib/ugat/scan-fields';
import { serializeFieldsMap } from '../lib/ugat/fields';

const WEB = join(__dirname, '..');
const OUT = join(WEB, 'lib/ugat/fields.generated.json');
const screens = JSON.parse(readFileSync(join(WEB, 'lib/ugat/screens.generated.json'), 'utf8'));
const map = scanFields({ webRoot: WEB, screens });

if (process.argv.includes('--stdout')) {
  process.stdout.write(serializeFieldsMap(map));
} else {
  writeFileSync(OUT, serializeFieldsMap(map));
  const dropped = map.actions.reduce((n, a) => n + a.dropped.length, 0);
  const notRead = map.forms.reduce((n, f) => n + f.notRead.length, 0);
  console.log(
    `ugat fields: ${map.screens.length} screens · ${map.actions.length} actions · ${map.forms.length} forms · ` +
      `${map.writers.length} files that write · ${dropped + notRead} dropped fields → ${OUT}`,
  );
}
