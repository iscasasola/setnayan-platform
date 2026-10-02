#!/usr/bin/env tsx
/**
 * gen-ugat-screens.ts — write the committed SCREENS + DOORS layer of the Ugat map.
 *
 *   pnpm --filter @setnayan/web ugat:screens              # write lib/ugat/screens.generated.json
 *   pnpm --filter @setnayan/web ugat:screens --stdout     # print it (the CI check uses this)
 *   pnpm --filter @setnayan/web ugat:screens --baseline   # rewrite the no-door baseline
 *   pnpm --filter @setnayan/web ugat:screens --report <file.md>   # the owner's fix list
 *
 * 🔑 GENERATED, NEVER AUTHORED — the posture of gen-admin-map.ts. Nobody types a
 * screen or a door. `scripts/check-ugat-screens.mjs` regenerates in CI and
 * refuses a committed file that differs, so the map cannot drift from the code.
 *
 * WHEN TO RE-RUN: after adding, moving or deleting a page, or adding/removing a
 * link, redirect or menu entry that points at one. The diff is the point — a
 * screen losing its last door lands in the pull request as one readable line.
 *
 * No commit hash and no date in the output: a generated file that changes on
 * every commit is stale on every branch, and a guard that is always red is off.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { noDoorBaseline, scanScreens, serializeScreensMap } from '../lib/ugat/scan-screens';
import {
  SCREEN_AREA_LABEL,
  connectingDoors,
  screensByArea,
  summarizeScreens,
  type UgatScreen,
  type UgatScreensMap,
} from '../lib/ugat/screens';
import { UGAT_TYPE_BY_ID } from '../lib/ugat/graph';

const WEB = join(__dirname, '..');
const OUT = join(WEB, 'lib/ugat/screens.generated.json');
const BASELINE = join(WEB, 'lib/ugat/screens-no-door.baseline.txt');

const args = process.argv.slice(2);
const map = scanScreens({ webRoot: WEB });

if (args.includes('--stdout')) {
  process.stdout.write(serializeScreensMap(map));
} else if (args.includes('--baseline')) {
  writeFileSync(BASELINE, noDoorBaseline(map));
  console.log(`no-door baseline: ${summarizeScreens(map).noDoor} screens → ${BASELINE}`);
} else if (args.includes('--report')) {
  const target = args[args.indexOf('--report') + 1];
  if (!target) {
    console.error('--report needs a file path');
    process.exit(2);
  }
  writeFileSync(target, report(map));
  console.log(`report → ${target}`);
} else {
  writeFileSync(OUT, serializeScreensMap(map));
  const s = summarizeScreens(map);
  console.log(
    `ugat screens: ${s.screens} screens · ${s.connected} connected · ${s.noDoor} no door · ` +
      `${s.stubs} legacy stubs · ${s.unmapped} unmapped · ${s.brokenDoors} doors to nowhere → ${OUT}`,
  );
}

/* ═══════════════════════════ the owner's report ═══════════════════════════ */

/**
 * The first sentence a page says about itself: the docblock right above its
 * `export default` (where pages describe themselves), else the file's first
 * block. A leading restatement of its own address is dropped.
 */
function whatItIs(s: UgatScreen): string {
  let src = '';
  try {
    src = readFileSync(join(WEB, s.file), 'utf8');
  } catch {
    return '';
  }
  const blocks = [...src.matchAll(/\/\*\*?([\s\S]*?)\*\//g)];
  const exp = src.search(/export\s+default/);
  const before = blocks.filter((b) => exp < 0 || b.index! < exp);
  const near = before.length ? before[before.length - 1] : undefined;
  const pick = (b: RegExpMatchArray | undefined) =>
    (b?.[1] ?? '')
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l && !/^[─═━-]+$/.test(l) && !/^@/.test(l))
      .join(' ')
      .replace(/\s+/g, ' ');
  const clean = (t: string) =>
    t
      .replace(/^`?\/[^\s`]*`?\s*(?:—|-|–|·)\s*/, '')
      .replace(/^[^A-Za-z0-9"'`(]+/, '')
      .trim();
  // A block that names the page's own address is the page describing itself.
  const leaf = s.route.split('/').filter(Boolean).pop() ?? '/';
  const self = blocks.find((b) => b[1]!.includes(s.route) || b[1]!.includes(`/${leaf}`));
  let text = clean(pick(self ?? near));
  if (text.length < 25) text = clean(pick(near));
  if (text.length < 25) text = clean(pick(blocks[0]));
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const said = sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
  // The page's own title is what a person would call it; lead with it.
  const title = src.match(/metadata[^=]*=\s*\{[\s\S]{0,200}?title:\s*['"`]([^'"`$]+)['"`]/)?.[1];
  return title ? `"${title}" · ${said}` : said;
}

function nodeNames(s: UgatScreen): string {
  return s.nodes.map((n) => UGAT_TYPE_BY_ID[n]?.name ?? n).join(', ');
}

function report(m: UgatScreensMap): string {
  const s = summarizeScreens(m);
  const notConnected = m.screens.filter((x) => x.status === 'no-door');
  const stubs = m.screens.filter((x) => x.status === 'stub');
  const unmapped = m.screens.filter((x) => x.status !== 'stub' && x.nodes.length === 0);
  const out: string[] = [];
  out.push('# Ugat map — first run of Screens · Doors (2026-10-02)');
  out.push('');
  out.push(
    'Generated from code by `pnpm --filter @setnayan/web ugat:screens --report` (setnayan-platform, ' +
      '`apps/web/scripts/gen-ugat-screens.ts`). Owner rulings: DECISION_LOG 2026-10-02 "ONE MAP OF THE APP", ' +
      'its amendment "THE APP MAP STARTS FRIDAY" and "THE UGAT MAP IS ALSO THE APP\'S OWN DEFINITION OF WHAT IT DOES". ' +
      'Live view: Admin › Set up › Screens. This is the FIX LIST the first run was asked to produce.',
  );
  out.push('');
  out.push('## The numbers');
  out.push('');
  out.push('| | count |');
  out.push('|---|---|');
  out.push(`| Screens (host, guest, supplier, onboarding, public — admin is mapped separately) | ${s.screens} |`);
  out.push(`| Connected — at least one way in from inside the app | ${s.connected} |`);
  out.push(`| **Not connected — no way in** | **${s.noDoor}** |`);
  out.push(`| Legacy stubs — old addresses that only forward somewhere else | ${s.stubs} |`);
  out.push(`| **Doors to nowhere — a link to an address nothing answers** | **${s.brokenDoors}** |`);
  out.push(`| Unmapped — no Ugat node (the page reads no mapped table) | ${s.unmapped} |`);
  out.push('');
  out.push('## 1 · Not connected (no door)');
  out.push('');
  out.push(
    'A page nobody can reach except by typing its address. Each needs one of: a door added where the person ' +
      'would look for it, a decision that it is entered from outside on purpose (an emailed or QR link we could ' +
      'not see statically), or deletion. "Only from" lists doors that exist but do not count (admin, sitemap, dev).',
  );
  out.push('');
  for (const g of screensByArea({ ...m, screens: notConnected })) {
    out.push(`### ${SCREEN_AREA_LABEL[g.area]} (${g.screens.length})`);
    out.push('');
    for (const x of g.screens) {
      const only = x.doors.length ? ` — only from ${[...new Set(x.doors.map((d) => d.kind))].join(', ')}` : '';
      const what = whatItIs(x);
      out.push(`- \`${x.route}\`${only}${what ? ` — ${what}` : ''}`);
    }
    out.push('');
  }
  out.push('## 2 · Doors to nowhere');
  out.push('');
  if (m.brokenDoors.length === 0) out.push('None found.');
  for (const b of m.brokenDoors) out.push(`- \`${b.to}\` — written in \`apps/web/${b.from}\` (${b.kind})`);
  out.push('');
  out.push(
    'Only an address whose start is known is ever reported here, and only after it failed every page, route ' +
      'handler, next.config redirect, middleware legacy rule and public file. A one-segment address such as ' +
      '`/something` always resolves to the guest event page `/[slug]`, so a broken one-segment link cannot be ' +
      'detected statically.',
  );
  out.push('');
  out.push('## 3 · Legacy stubs');
  out.push('');
  out.push(
    'Pages that draw nothing and forward. Harmless on their own; a stub that still has doors pointing at it is a ' +
      'link that should be retargeted at the real address.',
  );
  out.push('');
  out.push('| old address | forwards to | doors still pointing here |');
  out.push('|---|---|---|');
  for (const x of stubs) {
    out.push(`| \`${x.route}\` | \`${x.redirectsTo ?? '?'}\` | ${connectingDoors(x).length} |`);
  }
  out.push('');
  if (m.legacyRedirects.length) {
    out.push('Plus these next.config.ts redirects (old public addresses kept alive for bookmarks and search):');
    out.push('');
    for (const r of m.legacyRedirects) out.push(`- \`${r.source}\` → \`${r.destination}\``);
    out.push('');
  }
  out.push('## 4 · Screens with no Ugat node (unmapped)');
  out.push('');
  out.push(
    'Most are content pages (legal, about, help) that read no data and need no node. The ones that DO hold ' +
      'product data are the gaps: the map cannot say what they are about.',
  );
  out.push('');
  for (const g of screensByArea({ ...m, screens: unmapped })) {
    out.push(`- **${SCREEN_AREA_LABEL[g.area]}:** ${g.screens.map((x) => `\`${x.route}\``).join(' · ')}`);
  }
  out.push('');
  out.push('## 5 · Every screen, by area');
  out.push('');
  out.push('| screen | status | doors | Ugat node(s) |');
  out.push('|---|---|---|---|');
  for (const g of screensByArea(m)) {
    out.push(`| **${SCREEN_AREA_LABEL[g.area]}** | | | |`);
    for (const x of g.screens) {
      const status = x.status === 'stub' ? 'legacy stub' : x.status === 'no-door' ? '**no door**' : 'connected';
      out.push(`| \`${x.route}\` | ${status} | ${connectingDoors(x).length} | ${nodeNames(x) || '_unmapped_'} |`);
    }
  }
  out.push('');
  out.push('## How it was found, and what it cannot see');
  out.push('');
  out.push(
    '- **A screen** is a `page.tsx` outside `app/admin` (the admin map already covers the console). Intercepting ' +
      'modal routes are a second view of an existing screen and are not counted.',
  );
  out.push(
    '- **A door** is an address written where it will be followed: an `href`, a `router.push`, a `redirect()`, a ' +
      '`routes.…()` builder, a menu-registry slot (`lib/nav-registry-defaults.ts`, which also says phone vs ' +
      'desktop), an email or notification link, a URL helper\'s return value or a named address constant. A link ' +
      'from a page to itself does not count, and neither do doors from the admin console, sitemaps, ' +
      'next.config redirects or dev pages — they do not bring the person the screen is for.',
  );
  out.push(
    '- **It cannot see** an address assembled entirely at run time (`${base}/${key}` from a list of keys), or a ' +
      'link that arrives from outside the code (a QR printed on paper, an address typed from a poster). So "no ' +
      'door" means "no door in the code" — check before deleting.',
  );
  out.push(
    '- **A Ugat node** comes from the tables the page reads (in the page and two imports deep), through the same ' +
      'table → node binding the concept-coverage check uses. No table, no node; nothing is guessed.',
  );
  out.push(
    '- **Next (Saturday, slice 2):** the FIELDS layer (every input → the one table.column it saves to), the "this ' +
      'fact already lives in X" check, and switching the CI check from report mode to failing on a NEW no-door ' +
      'screen (today\'s list is the baseline it ratchets from).',
  );
  out.push('');
  return out.join('\n');
}
