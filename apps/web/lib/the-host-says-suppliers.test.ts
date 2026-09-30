import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * THE HOST'S "YOUR TEAM" IS CALLED SUPPLIERS.
 *
 * Owner, 2026-10-01 (DECISION_LOG "THE BOTTOM BAR IS HOME · GUESTS · SUPPLIERS
 * · HUB · MORE"): the host's "Your Team" — the list of suppliers they search,
 * book and pay — is renamed **Suppliers**. This guard reads every shipped
 * module under `app/` and `lib/` with comments stripped, and fails on any
 * remaining "your team" a host could read.
 *
 * 🔑 WHAT IS NOT A HOST'S SUPPLIER LIST, and is allow-listed below by path:
 *   · a SUPPLIER's own staff — vendor-dashboard/ and the for-suppliers pitch
 *     ("Add your team" there means their crew, with their own logins);
 *   · the admin console's own people (`what-you-change.tsx`);
 *   · the co-hosts who can see a private schedule moment
 *     ("only your team sees it");
 *   · a marketing line where "your team" is the couple's whole crew;
 *   · "your Team Pink vs Team Blue" — a gender-reveal game, not a team.
 *
 * ⏳ PR #6205 renames the nav (bar, sidebar, ☰ drawer, tours, the menu tree).
 * Its files are allow-listed as PENDING until it lands; when it does, delete
 * each PENDING entry — the guard then covers them too.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const NOT_THE_HOSTS_SUPPLIERS = [
  /^app\/vendor-dashboard\//,
  /^app\/for-suppliers\//,
  /^app\/admin\/_components\/what-you-change\.tsx$/,
  /^app\/dashboard\/\[eventId\]\/schedule\/_components\/moment-inspector\.tsx$/,
  /^app\/\(shell\)\/realstories\/page\.tsx$/,
  /^lib\/onboarding\/specialty-recommendations\.ts$/,
  /^lib\/blog-batches\//,
];

/** PENDING — owned by PR #6205, which renames them itself. */
const PENDING_6205 = [
  /^app\/dashboard\/\[eventId\]\/_components\/after\/finished-event-summary\.tsx$/,
  /^lib\/customer-menu\.ts$/,
  /^lib\/nav-registry-defaults\.ts$/,
  /^lib\/our-services\.ts$/,
  /^lib\/tours\.ts$/,
];

const YOUR_TEAM = /your\s+team/gi;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

export function yourTeamOffenders(files: { path: string; source: string }[]): string[] {
  const offenders: string[] = [];
  for (const { path, source } of files) {
    if ([...NOT_THE_HOSTS_SUPPLIERS, ...PENDING_6205].some((re) => re.test(path))) continue;
    const code = stripComments(source);
    for (const hit of code.matchAll(YOUR_TEAM)) {
      const line = code.slice(0, hit.index).split('\n').length;
      offenders.push(`${path}:${line} — "${hit[0]}"`);
    }
  }
  return offenders;
}

test('no host-facing string still says "Your Team" — it is Suppliers (owner 2026-10-01)', () => {
  const files = [...walk(join(WEB, 'lib')), ...walk(join(WEB, 'app'))].map((f) => ({
    path: relative(WEB, f).split('\\').join('/'),
    source: readFileSync(f, 'utf8'),
  }));
  assert.ok(files.length > 500, `the walk found only ${files.length} files — it is reading the wrong tree`);
  const offenders = yourTeamOffenders(files);
  assert.deepEqual(
    offenders,
    [],
    'the host\'s "Your Team" is renamed Suppliers (DECISION_LOG 2026-10-01). Say "Suppliers" / ' +
      '"your suppliers" — or, if this "team" is a supplier\'s own staff, allow-list the path above.',
  );
});

test('the guard fires on a host string and stays quiet in a comment and on supplier staff', () => {
  assert.equal(yourTeamOffenders([{ path: 'app/x/page.tsx', source: '<h2>Your Team</h2>' }]).length, 1);
  assert.equal(yourTeamOffenders([{ path: 'app/x/page.tsx', source: '// Your Team\nconst a = 1;' }]).length, 0);
  assert.equal(
    yourTeamOffenders([{ path: 'app/vendor-dashboard/team/page.tsx', source: "'Add your team'" }]).length,
    0,
  );
});
