/**
 * root-map-findings.ts — every Root map check, run once, and the RATCHET that
 * compares them with the committed baselines (part 2, slice 6).
 *
 * Owner brief (2026-10-02, part 2): "CI fails on NEW no-door screens, new
 * broken doors, new one-home violations, new dropped fields, new typed live
 * numbers, and new duplicates. Today's findings go into baseline files (one
 * line per finding, reasoned) so CI is green today and can only improve."
 *
 *   baselines   `lib/ugat/baselines/<check>.baseline.txt`, one finding per
 *               line: `<key>\t# <why it is on the list>`. Written ONLY by
 *               `pnpm --filter @setnayan/web root-map --baseline`.
 *   new         a finding whose key is not in its baseline. For an ENFORCED
 *               check (`CHECKS[…].enforced`) it fails CI; for the judgement
 *               checks it warns.
 *   fixed       a baseline line no longer found. Silent pass + a printed hint
 *               to drop it (part 1's posture: removing a line is a fix, and a
 *               fix merged on a sibling branch must not turn main red).
 *
 * Filesystem access — generator, tests and the CI check only.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { areaForRoute, SCREEN_AREA_LABEL, type UgatScreensMap } from './screens';
import type { UgatFieldsMap } from './fields';
import { scanFields } from './scan-fields';
import { scanReaders, scanSanitizers } from './scan-readers';
import { scanLandings } from './scan-landings';
import { scanShownValues } from './scan-shown-values';
import { tableNodeIndex } from './scan-screens';
import {
  CHECKS,
  CHECK_ORDER,
  doorFindings,
  droppedFieldFindings,
  neverReadFindings,
  oneHomeFindings,
  type CheckId,
  type Finding,
} from './root-map-checks';

export interface RootMapRun {
  screens: UgatScreensMap;
  fields: UgatFieldsMap;
  findings: Finding[];
}

/** Run every check over the app at `webRoot`. The Screens map is the committed one (CI checks it is current). */
export function runRootMap(webRoot: string, screens: UgatScreensMap): RootMapRun {
  const fields = scanFields({ webRoot, screens });
  const readers = scanReaders(webRoot);
  const findings = [
    ...doorFindings(screens),
    ...oneHomeFindings(fields, tableNodeIndex()),
    ...droppedFieldFindings(fields),
    ...neverReadFindings(fields, readers),
    ...scanSanitizers(webRoot, new Set(fields.writers.map((w) => w.from))),
    ...scanLandings({ webRoot, screens }),
    ...scanShownValues({ webRoot, screens }),
  ];
  return { screens, fields, findings };
}

/* ═══════════════════════════ baselines ═══════════════════════════ */

export const BASELINE_DIR = 'lib/ugat/baselines';
export const baselinePath = (webRoot: string, check: CheckId) => join(webRoot, BASELINE_DIR, `${check}.baseline.txt`);

/** `key\t# why` lines → the set of keys. `#` lines and blanks are comments. */
export function parseBaseline(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.startsWith('#')) continue;
    const tab = raw.indexOf('\t# ');
    out.add((tab >= 0 ? raw.slice(0, tab) : raw).trim());
  }
  return out;
}

export function readBaseline(webRoot: string, check: CheckId): Set<string> {
  const p = baselinePath(webRoot, check);
  return existsSync(p) ? parseBaseline(readFileSync(p, 'utf8')) : new Set();
}

/** Where a finding lives, in the owner's words — the first half of every reason. */
function whereOf(f: Finding): string {
  if (f.file.startsWith('app/admin/')) return 'admin console';
  if (f.screens.length) return SCREEN_AREA_LABEL[areaForRoute(f.screens[0]!)].toLowerCase();
  if (f.file.startsWith('app/')) return SCREEN_AREA_LABEL[areaForRoute(`/${f.file.slice(4).split('/')[0]}`)].toLowerCase();
  return 'shared code';
}

/**
 * The baseline file for one check — every finding today, each with its
 * reason: on the list since the first run, where it is, and what the check
 * says is wrong with it. The ratchet can only remove lines from here.
 */
export function writeBaselineText(check: CheckId, findings: Finding[]): string {
  const c = CHECKS[check];
  const head = [
    `# Root map baseline — ${c.title}.`,
    `# ${c.enforced ? 'ENFORCED: a finding not listed here fails CI.' : 'Report-only: a finding not listed here warns in CI.'}`,
    '# One line per finding: <key><TAB># <why it is on the list>. Written by',
    '#   pnpm --filter @setnayan/web root-map --baseline',
    '# Never add a line by hand to make CI pass — fix the finding. A fixed one is',
    '# dropped by re-running the command above.',
  ];
  const lines = findings
    .filter((f) => f.check === check)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((f) => `${f.key}\t# first run 2026-10-02 · ${whereOf(f)} · ${c.why}`);
  return `${[...head, ...lines].join('\n')}\n`;
}

export interface RatchetResult {
  check: CheckId;
  current: number;
  baselined: number;
  fresh: Finding[];
  fixed: string[];
}

export function ratchet(webRoot: string, findings: Finding[]): RatchetResult[] {
  return CHECK_ORDER.map((check) => {
    const base = readBaseline(webRoot, check);
    const mine = findings.filter((f) => f.check === check);
    const keys = new Set(mine.map((f) => f.key));
    return {
      check,
      current: mine.length,
      baselined: base.size,
      fresh: mine.filter((f) => !base.has(f.key)),
      fixed: [...base].filter((k) => !keys.has(k)).sort(),
    };
  });
}
