/**
 * 🔒 NO "e.g." EXAMPLE IN A TYPING BOX — owner R3, 27 Nov 2026 (DECISION_LOG "remove placeholder copy"; owner's
 * "yes to all" on the L4 calls, relayed by the ship controller the same day):
 *   "also look for placeholder texts and remove them. we want this to be a fixed app, not an app with guidelines on
 *    what should be here."
 *
 * A box says its NAME ("Email", "Password", "Search guests", "Inclusion") or nothing. It never shows a made-up example
 * of what to type. This walks every screen file (app/, components/, lib/ — not tests, not the dev labs) and fails on:
 *   1 · a line that sets a box hint — `placeholder`, `empty=` / `empty:` (TypedRow's placeholder) or `hints` — and
 *       holds "e.g.";
 *   2 · any string literal that STARTS with "e.g." (a hint table such as a per-kind map of examples).
 * Help lines, notes under a field, error messages, AI prompts and comments may still say "e.g."; only the box is held.
 *
 * ALLOW is a bill, not a decision: each line names who removes it and why it is still here.
 *
 * 🛡 SABOTAGE (seen RED, then restored): `placeholder="e.g. Owner"` typed back into the claim door's role box (red: 1)
 *   · `person: 'e.g. Amara'` added to a lookup table (red: 2) · an ALLOW line whose file no longer has the hint (red: 3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();

/** `file` → why an "e.g." box hint is still there, and who removes it. */
const ALLOW: Record<string, string> = {
  'app/dashboard/[eventId]/seating/_components/seating-editor.tsx':
    'Seat plan (Table name · e.g. Sponsors 1; the bar menu box): NEW account, L10. The old account never edits seat-plan files.',
  'app/dashboard/[eventId]/seating/walkthrough/_components/walkthrough-manager.tsx':
    'Seat plan walkthrough ("New zone — e.g. …"): NEW account, L10.',
  'app/tour/seating/_components/find-your-seat.tsx': 'The public seat-plan tour (find your seat): NEW account, L10.',
  'app/[slug]/_components/rsvp-name-correction.tsx':
    'Guest Event Hub reply card ("e.g. Maria Teresita Aquino-Reyes"): NEW account, L2 (RSVP form). The reply card is byte-pinned by the-reply-card-is-todays-page.test.ts.',
  'app/[slug]/_components/song-request-card.tsx': 'Guest Event Hub song request box: NEW account, L2 (Guest + Hub).',
  'app/[slug]/pabuya/_components/gift-record-sheet.tsx': 'Guest E-Gifts note box ("e.g. For your merienda machine!"): NEW account, L2 (Guest + Hub).',
  'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx':
    'Not a box: the note under the "Stays out of face recognition" switch ("e.g. a minor"). Owner\'s call if notes go too.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.lab\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const BOX_LINE = /\b(?:placeholder|empty\s*[=:]|hints\b)/;
const STARTS_EG = /(['"`])e\.g\./;

function offenders(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const root of ['app', 'components', 'lib']) {
    for (const f of walk(join(WEB, root))) {
      const rel = relative(WEB, f);
      const lines = stripComments(readFileSync(f, 'utf8')).split('\n');
      for (const line of lines) {
        if (!line.includes('e.g.')) continue;
        if ((BOX_LINE.test(line) && /e\.g\./.test(line)) || STARTS_EG.test(line)) {
          found.set(rel, [...(found.get(rel) ?? []), line.trim().slice(0, 120)]);
        }
      }
    }
  }
  return found;
}

test('1 · 2 · no typing box shows an "e.g." example outside the allow-list', () => {
  const bad = [...offenders()].filter(([f]) => !(f in ALLOW));
  assert.deepEqual(
    bad.map(([f, l]) => `${f}: ${l[0]}`),
    [],
    'a box shows a made-up example again (owner R3: "a fixed app, not an app with guidelines"). Say the field\'s name, or nothing.',
  );
});

test('3 · every allow-list line is still owed (a fixed one is deleted, never kept)', () => {
  const found = offenders();
  const stale = Object.keys(ALLOW).filter((f) => !found.has(f));
  assert.deepEqual(stale, [], `these ALLOW lines no longer hold an "e.g." hint — delete them: ${stale.join(', ')}`);
});
