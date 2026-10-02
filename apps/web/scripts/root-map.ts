#!/usr/bin/env tsx
/**
 * root-map.ts — run every Root map check (part 2) and ratchet it.
 *
 *   pnpm --filter @setnayan/web root-map --check            # CI: fail on a NEW enforced finding
 *   pnpm --filter @setnayan/web root-map --baseline         # rewrite lib/ugat/baselines/* from today
 *   pnpm --filter @setnayan/web root-map --report <file.md> # the owner's fix list, in plain English
 *
 * Reads the committed Screens map (part 1; `scripts/check-ugat-screens.mjs`
 * refuses a stale one) and scans the code fresh for everything else — the
 * Fields layer is regenerated on every run (`pnpm … ugat:fields` writes it to
 * a git-ignored file for reading), so no generated fact list can go stale.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '../lib/strip-comments';
import { CHECKS, CHECK_ORDER, type CheckId, type Finding } from '../lib/ugat/root-map-checks';
import { baselinePath, ratchet, runRootMap, writeBaselineText, BASELINE_DIR } from '../lib/ugat/root-map-findings';
import { CALCULATIONS, EVENT_FACT_HOME_SCREENS } from '../lib/ugat/fields';
import { createForms } from '../lib/ugat/round-trip';
import { summarizeScreens, type UgatScreensMap } from '../lib/ugat/screens';

const WEB = join(__dirname, '..');
const args = process.argv.slice(2);
const screens = JSON.parse(readFileSync(join(WEB, 'lib/ugat/screens.generated.json'), 'utf8')) as UgatScreensMap;
const run = runRootMap(WEB, screens);

if (args.includes('--baseline')) {
  mkdirSync(join(WEB, BASELINE_DIR), { recursive: true });
  for (const check of CHECK_ORDER) writeFileSync(baselinePath(WEB, check), writeBaselineText(check, run.findings));
  console.log(`Root map baselines rewritten → ${BASELINE_DIR}/ (${run.findings.length} findings)`);
} else if (args.includes('--report')) {
  const target = args[args.indexOf('--report') + 1];
  if (!target) {
    console.error('--report needs a file path');
    process.exit(2);
  }
  writeFileSync(target, report());
  console.log(`report → ${target}`);
} else if (args.includes('--json')) {
  process.stdout.write(JSON.stringify(run.findings, null, 1));
} else {
  // --check (the default)
  const results = ratchet(WEB, run.findings);
  let failed = false;
  console.log('Root map — part 2 checks (ratchet ON)');
  for (const r of results) {
    const c = CHECKS[r.check];
    console.log(`  ${c.title}: ${r.current} today · ${r.baselined} in baseline${c.enforced ? '' : ' · report-only'}`);
    for (const f of r.fresh) {
      console.log(`    ${c.enforced ? '::error::' : '::warning::'}NEW ${r.check}: ${f.plain} [${f.key}]`);
      if (c.enforced) failed = true;
    }
    if (r.fixed.length) {
      console.log(`    ${r.fixed.length} baselined finding(s) are fixed — run \`pnpm --filter @setnayan/web root-map --baseline\` to drop them:`);
      for (const k of r.fixed.slice(0, 10)) console.log(`      ${k}`);
    }
  }
  if (failed) {
    console.error('');
    console.error('::error::The Root map found something NEW that the ratchet does not allow (above).');
    console.error('Fix it. Only if it is genuinely right as it is, re-run');
    console.error('  pnpm --filter @setnayan/web root-map --baseline');
    console.error('and say why in the pull request — the baseline line carries the reason.');
    process.exit(1);
  }
  console.log('  no new enforced findings.');
}

/* ═══════════════════════════ the owner's report ═══════════════════════════ */

/** What a person calls a screen: its title, masthead or heading — else its address. */
function screenName(route: string): string {
  const s = screens.screens.find((x) => x.route === route);
  if (!s) return route;
  let src = '';
  try {
    src = stripComments(readFileSync(join(WEB, s.file), 'utf8'));
  } catch {
    return route;
  }
  const t =
    src.match(/metadata[^=]*=\s*\{[\s\S]{0,200}?title:\s*['"`]([^'"`$]+)['"`]/)?.[1] ??
    src.match(/<PageMasthead[^>]*?\btitle=(?:"([^"]+)"|\{\s*['"`]([^'"`$]+)['"`]\s*\})/)?.slice(1).find(Boolean) ??
    src.match(/<h1\b[^>]*>\s*([^<{]{3,60})</)?.[1];
  return t ? `${t.trim()} (${route})` : route;
}

function names(f: Finding): string {
  if (f.screens.length === 0) return `\`${f.file}\``;
  const shown = f.screens.slice(0, 3).map(screenName).join('; ');
  return f.screens.length > 3 ? `${shown}; +${f.screens.length - 3} more screens` : shown;
}

function report(): string {
  const results = ratchet(WEB, run.findings);
  const s = summarizeScreens(screens);
  const by = (c: CheckId) => run.findings.filter((f) => f.check === c);
  const o: string[] = [];
  o.push('# Root map — part 2 first run: Fields, one home, saved and used, landings, shown values (2026-10-02)');
  o.push('');
  o.push(
    'Generated from code by `pnpm --filter @setnayan/web root-map --report` (setnayan-platform, `apps/web/scripts/root-map.ts`). ' +
      'Owner rulings: DECISION_LOG 2026-10-02 "ONE MAP OF THE APP", "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT DETAILS — ONE HOME, MAPPED", ' +
      '"THE ROOT MAP ALSO CATCHES \'PRESSED BUT WENT TO THE WRONG PLACE\' AND \'FILLED IN BUT NOT SAVED\'", "…A NUMBER THAT LOOKS LIVE BUT IS TYPED IN", ' +
      '"TWO MORE THINGS EVERY BUILD IS CHECKED FOR" and "THE ROOT MAP IS A BACKEND THING". Part 1 (Screens · Doors) is in `UGAT_MAP_FIRST_RUN_2026-10-02.md`. ' +
      'Root map is the owner\'s name for the Ugat map; code keeps `lib/ugat`.',
  );
  o.push('');
  o.push('**What changed today:** every one of these checks now runs in CI on every pull request. Today\'s findings are written down as the starting list (the "baseline"), so CI is green today — and anything NEW of the six kinds marked "fails CI" stops the build. The list can only get shorter.');
  o.push('');
  o.push('## The numbers');
  o.push('');
  o.push('| check | found today | a NEW one… |');
  o.push('|---|---|---|');
  for (const r of results) {
    const c = CHECKS[r.check];
    o.push(`| ${c.title} | ${r.current} | ${c.enforced ? '**fails CI**' : 'warns'} |`);
  }
  o.push('');
  o.push(`Screens mapped: ${s.screens} (admin is mapped separately). Actions mapped: ${run.fields.actions.length}. Forms followed to their action: ${run.fields.forms.filter((f) => f.actions.length).length} of ${run.fields.forms.length}. Files that save something: ${run.fields.writers.length}.`);
  o.push('');

  o.push('## The Fields layer — what each screen reads and saves');
  o.push('');
  o.push(
    'Every screen from part 1 now carries the facts it READS (`table.column`, from its select lists), the facts it WRITES (from the save actions it can call — ' +
      'a column, a key inside a JSON column, or a database-function input), the actions themselves, and the numbers it CALCULATES. Every action carries each form field it reads and the column that field ends up in. ' +
      'Run `pnpm --filter @setnayan/web ugat:fields` to write the whole map to `apps/web/lib/ugat/fields.generated.json` (not committed — it is regenerated on every CI run, so it can never be out of date).',
  );
  o.push('');
  o.push('Numbers the map knows are calculations, not columns:');
  o.push('');
  for (const c of CALCULATIONS) o.push(`- **${c.name}** = ${c.formula}`);
  o.push('');
  const home = run.fields.screens.filter((x) => EVENT_FACT_HOME_SCREENS.includes(x.id));
  o.push(
    `**The home for event answers** is Event Details › Your info (${EVENT_FACT_HOME_SCREENS.map((r) => `\`${r}\``).join(' + ')}). Between them they read or save ` +
      `${new Set(home.flatMap((x) => [...x.reads, ...x.writes]).filter((x) => x.startsWith('events.')).map((x) => x.split('.').slice(0, 2).join('.'))).size} columns of the event record.`,
  );
  o.push('');

  const section = (check: CheckId, intro: string, line: (f: Finding) => string) => {
    const fs = by(check);
    const c = CHECKS[check];
    o.push(`## ${c.title} — ${fs.length} (${c.enforced ? 'a new one fails CI' : 'a new one warns'})`);
    o.push('');
    o.push(intro);
    o.push('');
    if (fs.length === 0) o.push('None today.');
    for (const f of fs) o.push(`- ${line(f)}`);
    o.push('');
  };

  section('no-door', 'Carried over from part 1: a page nobody can reach without typing its address. Now ratcheted.', (f) => `${screenName(f.screens[0]!)}`);
  section('broken-door', 'A link to an address no page answers.', (f) => f.plain);
  section('missing-section', 'The page exists, but the place on it the door points at (`#section`) is drawn nowhere in that page\'s code.', (f) => f.plain);
  section(
    'one-home',
    'One answer saved in two places, so the two can disagree: a table holding it both as a column and inside a JSON blob, an event column copied into another part of the event\'s record, or a copy in the browser. (Snapshots, ledgers and logs copy on purpose and are not counted.)',
    (f) => `${f.plain} Saved from: ${names(f)}.`,
  );
  section(
    'outside-home',
    'Owner, 2026-10-02: every answer about an event lives in Event Details › Your info, and no screen keeps its own copy. Each line is an event field a screen saves that Your info neither shows nor edits — either Your info gains a row for it, or it is not an "answer" (a design or system setting) and joins the reasoned exclusions in `lib/ugat/fields.ts`. The onboarding answers in `style_preferences.setup` are the owner\'s named case.',
    (f) => `\`${f.key}\` — saved from ${names(f)}.`,
  );
  section(
    'dropped-field',
    'A person fills it in and the save throws it away: either the form sends a field the action never reads, or the action reads it and then neither saves it, uses it to find a row, passes it on, returns it, nor uses it to choose what to save. Consent boxes that are checked but never recorded show up here too.',
    (f) => `${f.plain} On: ${names(f)}.`,
  );
  section(
    'typed-number',
    'A number next to a unit (days · guests · pax · tables · seats · photos · couples · % · ₱) written into a screen\'s words instead of read from the event. Rule constants ("within 7 days", "0% commission", "₱0", "(8/10/12 seats)", "save 20%", the 28-day cycle) are allowed, each with its reason, in `RULE_CONSTANTS`. Marketing samples are listed so you can decide; demo, sample, tour and dev files are not scanned.',
    (f) => `${f.plain} (${f.file}${f.screens.length ? ` — on ${names(f)}` : ''})`,
  );
  section(
    'duplicate',
    'One calculated fact worked out or drawn by two different parts of the same screen — the Home case, where the new first screen shipped on top of the old tiles ("replace means remove"). Home dedupe is in flight (PR #6278); when it lands, its lines here drop off.',
    (f) => `${screenName(f.screens[0]!)} — ${f.plain.replace(/^\S+ /, '')}`,
  );
  section('never-read', 'A column the app saves that nothing reads back — no select, no row property, no filter, and no database function, view or policy.', (f) => `${f.plain} Saved by \`${f.file}\`.`);
  section('sanitizer', 'A cleaner that keeps only the keys it knows and silently drops the rest before a save. Sometimes that is the point (an allowlist); each one is listed so a dropped answer is a decision, not an accident.', (f) => f.plain);
  section('wrong-words', 'The words on a link do not name where it lands. Judged against the destination\'s own title, heading, menu label and address, through a reasoned list of synonyms (Event Hub = website = invitation; suppliers = vendors = team …). Calls to action ("Open", "See all", "Start free") are not judged. A judgement check: it warns, it does not fail.', (f) => f.plain);
  section('retarget', 'A door that works, but through an old address that only forwards. Point it at the real page.', (f) => f.plain);

  const tested = new Set([
    'app/dashboard/[eventId]/guests/new/page.tsx',
    'app/dashboard/[eventId]/schedule/page.tsx',
    'app/dashboard/[eventId]/sponsors/_components/add-sponsor-modal.tsx',
    'app/dashboard/[eventId]/seating/_components/seating-editor.tsx',
    'app/dashboard/[eventId]/_components/vendor-itemization-card.tsx',
    'app/dashboard/[eventId]/manpower/_components/post-gig-drawer.tsx',
    'app/vendor-dashboard/services/_components/services-manager.tsx',
    'app/vendor-dashboard/payment-options/_components/add-payment-method.tsx',
    'app/dashboard/(account)/samahan/new/page.tsx',
  ]);
  const rest = createForms(run.fields).filter((x) => !tested.has(x.form));
  o.push('## Round trips — create → read back every field');
  o.push('');
  o.push(
    'Nine create forms now have a round-trip test (`apps/web/lib/ugat/create-forms-round-trip.test.ts`): every input is followed to the column it is saved in and to the screen that shows the new thing — guest, schedule moment, sponsor, seating table, budget line item, manpower gig, supplier service, supplier payment method, Samahan community. ' +
      `These ${rest.length} create forms have no round-trip test yet (the helper, \`roundTrip()\`, takes one line each):`,
  );
  o.push('');
  for (const x of rest) o.push(`- \`${x.form}\` → \`${x.action.split('#')[1]}\``);
  o.push('');
  o.push('## Home — "move the input, the output moves"');
  o.push('');
  o.push(
    '`apps/web/app/dashboard/[eventId]/home-numbers-move.test.ts` renders the real Home first screen through the same functions the page calls, for two different "today"s, two event dates and two guest lists, and fails if days to go, coming or no reply stays the same. Today: days to go reads 200 → 199 across two todays and 60 → 200 across two dates; coming 1 → 3; no reply 1 → 2.',
  );
  o.push('');
  o.push('## How it was found, and what it cannot see');
  o.push('');
  o.push('- Everything is read from the code; nothing is typed in. Each check has a fixture test that proves it finds the thing AND does not accuse the correct version, and each was sabotaged once (switched off) to prove the test notices.');
  o.push('- **Fields:** a payload assembled across several files, a column chosen at run time, and saves done through `fetch(\'/api/…\')` are not followed; a form field rendered by a component two levels down is not seen. So "dropped" means "no path found in this code" — open the named file before deleting anything.');
  o.push('- **Saved but never used** counts ANY mention of a column name as a read (generous on purpose), so it under-reports.');
  o.push('- **Typed numbers:** a number split from its unit by markup (`<b>190</b> days`) is not seen, and numbers in `lib/` copy are not scanned.');
  o.push('- **Duplicates:** only the calculations listed above are compared; a fact drawn twice through two different variables of the same name is not seen.');
  o.push('- **Not built (by design, owner 2026-10-02 "THE ROOT MAP IS A BACKEND THING"):** no owner page; the run-time "Dead ends people hit" recorder is part 3.');
  o.push('');
  return o.join('\n');
}
