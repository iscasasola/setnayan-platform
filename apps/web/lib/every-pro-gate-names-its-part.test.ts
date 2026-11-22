/**
 * every-pro-gate-names-its-part.test.ts — 💎 EVENT PRO, PART BY PART (owner 2026-10-22).
 *
 * The property: a Pro gate asks for ONE PART, never for "Pro". So
 *   (1) every look-write gate (`requireLookPro` / `lookProAllows`) names its part, as a literal the reader can see;
 *   (2) "everything" (`eventCoupleWebsiteProActive` / `websiteProActiveFor`) is asked ONLY where everything is the
 *       answer — the "Powered by Setnayan" footer (gate 37), the Full Pro buy surfaces, onboarding's one offer — each
 *       file listed with its reason. A new gate that reaches for "everything" fails here and has to pick its part;
 *   (3) no price is typed in the parts code: the figures are catalogue rows.
 *
 * Sabotage (recorded in the PR): put `requireLookPro(eventId, 'change')` back in `widgets/actions.ts` → (1) red;
 * swap `eventHubPartActive(…, 'background')` for `eventCoupleWebsiteProActive(…)` in `couple-media-allowance.server.ts`
 * → (2) red; type `1000` into `lib/hub-parts.ts` → (3) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import { HUB_PART_IDS } from './hub-parts';

const WEB = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))].map((p) => ({
  rel: relative(WEB, p),
  code: stripComments(readFileSync(p, 'utf8')),
}));

/** The arguments of the call that opens at `open` (the index of its `(`), split at top-level commas. */
function argsAt(code: string, open: number): string[] {
  let depth = 0;
  let cur = '';
  const out: string[] = [];
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i]!;
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      if (depth === 1) continue;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        return out;
      }
    } else if (ch === ',' && depth === 1) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  return out;
}

function callsOf(name: string): Array<{ rel: string; args: string[] }> {
  const out: Array<{ rel: string; args: string[] }> = [];
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  for (const f of FILES) {
    for (let m = re.exec(f.code); m; m = re.exec(f.code)) {
      const before = f.code.slice(Math.max(0, m.index - 20), m.index);
      if (/function\s+$|async\s+function\s+$/.test(before)) continue; // the definition
      out.push({ rel: f.rel, args: argsAt(f.code, m.index + m[0].length - 1) });
    }
  }
  return out;
}

const PART = new RegExp(`^'(${HUB_PART_IDS.join('|')})'$`);

test('(1) every look-write gate names ONE part, as a literal', () => {
  const calls = [...callsOf('requireLookPro'), ...callsOf('lookProAllows')].filter((c) => c.rel !== 'lib/hub-look-gate.ts');
  console.log(`[pro-gates] look-write gates seen: ${calls.length}`);
  assert.ok(calls.length >= 15, `only ${calls.length} gate calls found — the scan is not seeing the tree`);
  const bad = calls.filter((c) => c.args.length !== 3 || !PART.test(c.args[2]!));
  assert.deepEqual(
    bad.map((c) => `${c.rel}: (${c.args.join(', ')})`),
    [],
    'a look gate asks for "Pro" instead of naming its part (lib/hub-parts.ts HUB_PRO_GATES)',
  );
});

test('(1) every part gate names a real part', () => {
  const calls = [...callsOf('eventHubPartActive'), ...callsOf('hubPartActiveFor'), ...callsOf('eventOwnsHubPart')];
  assert.ok(calls.length >= 15, `only ${calls.length} part reads found`);
  const bad = calls.filter((c) => {
    const part = c.args[c.args.length - 1] ?? '';
    return !PART.test(part) && !/^part$/.test(part); // `part` = a pass-through parameter
  });
  assert.deepEqual(bad.map((c) => `${c.rel}: (${c.args.join(', ')})`), []);
});

/**
 * Where "everything" is the right question — and why. A file not listed here that asks it fails the test below.
 */
const EVERYTHING_ASKED_HERE: Record<string, string> = {
  'lib/couple-website-pro.ts': 'its definition, and the Editorial dual unlock (free for everyone)',
  'app/[slug]/_lib/hub-look.ts': '`websiteProActiveFor` — the guest look shell and the page ground',
  'app/[slug]/_lib/loaders.ts': 'the guest look shell (Pro colours and face)',
  'app/dashboard/[eventId]/studio/editorial-pro/page.tsx': 'the Editorial buy surface, which Full Pro includes',
  'app/dashboard/[eventId]/launch/page.tsx': "the Maker's one Full Pro offer and its marks (PR2 moves the marks to parts)",
  'app/dashboard/[eventId]/website/our-story/page.tsx': 'the buy CTA on the legacy story page — Full Pro',
  'app/dashboard/[eventId]/website/editor/page.tsx': "the legacy editor's padlocks and its one Full Pro unlock button",
  'app/dashboard/[eventId]/website/widgets/page.tsx': "the legacy scenes page's Pro marks",
};

test('(2) "everything" is asked only where everything is the answer', () => {
  const asked = new Set(
    [...callsOf('eventCoupleWebsiteProActive'), ...callsOf('eventOwnsCoupleWebsitePro'), ...callsOf('websiteProActiveFor')].map((c) => c.rel),
  );
  console.log(`[pro-gates] files asking for everything: ${asked.size}`);
  const stray = [...asked].filter((f) => !(f in EVERYTHING_ASKED_HERE));
  assert.deepEqual(stray, [], 'a gate asks for all of Event Pro — name its ONE part instead (lib/hub-parts.ts)');
  /* …and an entry that no longer asks is deleted, or it silently widens what may. */
  const stale = Object.keys(EVERYTHING_ASKED_HERE).filter((f) => !asked.has(f));
  assert.deepEqual(stale, [], 'listed as asking for everything, but no longer does — remove it from the list');
});

/**
 * 💎 THE EVENT PRO PLAN (owner 2026-11-19, DECISION_LOG "Event plans part 2 (#8004) — four calls"): the plan's OWN perks
 * stayed Event Pro's (and Ultra's) — the 11 Hub parts and Editorial are Event Plus's since the owner's 20 Nov ruling. Those ask the Pro PLAN
 * (`eventProPlanActive` / `eventOwnsProPlan` / `proPlanActiveFor`), never everything and never a part — and only here.
 */
const PRO_PLAN_ASKED_HERE: Record<string, string> = {
  'app/[slug]/_lib/hub-look.ts': '`proPlanActiveFor` — the footer reader (gate 37)',
  'app/[slug]/_lib/loaders.ts': 'the footer (`proWatermarkHidden`, gate 37)',
  'lib/setnayan-mark-by-plan.server.ts': 'the Setnayan mark by plan — Event Pro takes every mark off (gate 37, DECISION_LOG 2026-11-04)',
  'app/[slug]/print/page.tsx': 'the print page footer (gate 37)',
  'app/[slug]/_components/editorial/editorial-content.tsx': 'the editorial colophon footer (gate 37)',
  'lib/onboarding-services-orders.ts': 'onboarding sells the Pro plan — never twice (owner 2026-10-22)',
  'lib/schedule-release.server.ts': "the Schedule's Release — Pro by the owner's 1 Nov ruling (plan §3b), and not an Event Hub part",
  'app/[slug]/_lib/your-schedule.server.ts': "the guest's Your schedule honours Release only on Pro (plan §3b) — not an Event Hub part",
  'lib/schedule-view-as.server.ts': "the Schedule's View as a guest, a role or a supplier — Pro by the owner's 1 Nov ruling (plan §3b; Suppliers by time is Free, 2 Nov), and not an Event Hub part",
  'app/api/schedule/[eventId]/export/route.ts': "one View as person's day as a PDF (POST) — Pro like the view it prints (owner 2026-11-04, slice 6), and not an Event Hub part",
};

test('(2b) the Pro PLAN is asked only for the plan’s own perks (owner 2026-11-19)', () => {
  const asked = new Set([...callsOf('eventProPlanActive'), ...callsOf('eventOwnsProPlan'), ...callsOf('proPlanActiveFor')].map((c) => c.rel));
  console.log(`[pro-gates] files asking for the Pro plan: ${asked.size}`);
  assert.ok(asked.size >= 8, 'the scan found almost no Pro-plan askers — it is blind');
  const stray = [...asked].filter((f) => !(f in PRO_PLAN_ASKED_HERE));
  assert.deepEqual(stray, [], 'a gate asks for the Pro plan — is it the plan’s own perk, or a Hub part (Ultra)? List it with its reason');
  const stale = Object.keys(PRO_PLAN_ASKED_HERE).filter((f) => !asked.has(f));
  assert.deepEqual(stale, [], 'listed as asking for the Pro plan, but no longer does — remove it from the list');
});

test('(2) the footer is the Pro plan’s, and the guest look asks its parts', () => {
  const loaders = FILES.find((f) => f.rel === 'app/[slug]/_lib/loaders.ts')!.code;
  assert.match(loaders, /proWatermarkHiddenAhead\s*=\s*startAhead\(proPlanActiveFor\(/, 'the footer stopped asking for the Pro plan');
  const look = FILES.find((f) => f.rel === 'app/[slug]/_lib/hub-look.ts')!.code;
  /* The theme and the page ground ask their parts, never everything. */
  /* 2026-11-19: the theme asks gate 13 (its home is Style; Event Plus passes it too) — one gate, still not everything. */
  assert.match(look, /hubGateActiveFor\(event\.event_id, '13'\)/);
  assert.match(look, /hubPartActiveFor\(event\.event_id, 'background'\)/);
});

test('(3) no price is typed in the parts code — every figure is a catalogue row', () => {
  for (const rel of ['lib/hub-parts.ts', 'lib/couple-website-pro.ts', 'lib/hub-look-gate.ts']) {
    const code = FILES.find((f) => f.rel === rel)!.code.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
    assert.doesNotMatch(code, /₱/, `${rel} types a peso figure`);
    const numbers = (code.match(/\b\d{3,}\b/g) ?? []).filter((n) => Number(n) >= 100);
    assert.deepEqual(numbers, [], `${rel} types a number that could be a price: ${numbers.join(', ')}`);
  }
});
