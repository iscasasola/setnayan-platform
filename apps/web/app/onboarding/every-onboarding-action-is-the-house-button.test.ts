/**
 * 🔘 EVERY ONBOARDING ACTION IS THE HOUSE BUTTON — the button rule (HOUSE_TEMPLATES T19) extended to
 * `app/onboarding/**` and `app/open-shop/**` (Build 5 Lane P).
 *
 * Owner, 10 Nov ~18:50, verbatim: *"the rule or uniform buttons and design templates is not followed yet."*
 * T19: the shared `ActionButton` only (`components/action-button.tsx`); equal-weight choices in ONE row at EQUAL
 * widths (`useFitRow`); no hand-styled buttons. The supplier sweep (`app/vendor-dashboard/every-supplier-action-
 * is-a-button.test.ts`) holds its swept files at zero; onboarding is NOT swept yet — measured on this branch it
 * holds the bare `<button>` counts below — so this guard is a RATCHET, both ways, anchored PER COMPONENT (a
 * file-level count cannot say which component still holds one — repo CLAUDE.md, the 2026-08-20 trap):
 *   · a component's count may not RISE, and a component not listed may hold none (a new step is born on the rule);
 *   · a count that FALLS must be written down here in the same PR (the gain is locked in, like the lints).
 * A control that is genuinely not an action button (a calendar day cell, a map pin) may stay bare only with
 * `// button-ok: <why>` on its tag's line — and is then not counted.
 *
 * The table is DEBT, not permission: each Lane P slice that moves a step onto the template lowers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const web = process.cwd();

/** Bare `<button>` per component, measured 2026-11-10 (Lane P). Lower it; never raise it. */
const BARE: Readonly<Record<string, number>> = {
  'onboarding/[type]/_components/generic-onboarding.tsx › GenericOnboarding': 8,
  'onboarding/[type]/_components/specialty-fields.tsx › Roster': 2,
  'onboarding/[type]/_components/specialty-fields.tsx › OpenMultiselect': 1,
  'onboarding/[type]/_components/specialty-fields.tsx › Field': 3,
  'onboarding/[type]/_components/specialty-fields.tsx › SpecialtyFields': 1,
  'onboarding/_shared/date-calendar.tsx › DateCalendar': 5,
  'onboarding/_shared/needs-step.tsx › NeedsStep': 1,
  'onboarding/_shared/services-step.tsx › Stepper': 2,
  'onboarding/_shared/services-step.tsx › PackPoolPicker': 2,
  'onboarding/_shared/services-step.tsx › ServicesStep': 2,
  'onboarding/_shared/setup-card.tsx › SetupFrame': 2,
  'onboarding/_shared/setup-card.tsx › SetupCard': 2,
  'onboarding/wedding/_components/location-step.tsx › LocationStep': 4,
  'onboarding/wedding/_components/onboarding-music.tsx › OnboardingMusic': 1,
  'onboarding/wedding/_components/onboarding-shell.tsx › RefineCard': 1,
  'onboarding/wedding/_components/onboarding-shell.tsx › PCard': 1,
  'onboarding/wedding/_components/onboarding-shell.tsx › PickCard': 1,
  'onboarding/wedding/_components/onboarding-shell.tsx › OnboardingShell': 38,
  'onboarding/wedding/_components/song-preview-list.tsx › SongPreviewList': 1,
  'onboarding/wedding/_components/wedding-venues.tsx › VenueRoleRow': 1,
  'onboarding/wedding/_components/welcome-moments.tsx › WelcomeMoments': 1,
  'open-shop/_components/city-pin.tsx › CityPin': 2,
  'open-shop/_components/claim-door.tsx › ClaimDoor': 6,
  'open-shop/_components/plan-sheet.tsx › PlanBody': 2,
  'open-shop/_components/service-cards.tsx › ServiceCards': 1,
  'open-shop/_components/service-cards.tsx › Specialties': 1,
  'open-shop/_components/service-picker.tsx › ServicePicker': 2,
  'open-shop/_components/service-picker.tsx › CategoryTiles': 1,
  'open-shop/_components/services-at-events.tsx › ServicesAtEvents': 1,
};

const START = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([A-Z]\w*)\s*[(<]|const\s+([A-Z]\w*)\s*(?::[^=]+)?=)/gm;

/** Each top-level component's bare `<button>` count (lines carrying `button-ok:` are spared). */
export function bareByComponent(source: string): { component: string; bare: number }[] {
  const spared = source
    .split('\n')
    .map((l) => (/button-ok:/.test(l) ? l.replace(/<button(?=[\s>/])/g, '<button-ok') : l))
    .join('\n');
  const src = stripComments(spared);
  const starts = [...src.matchAll(START)].map((m) => ({ name: (m[1] ?? m[2])!, at: m.index! }));
  const slices: { name: string; body: string }[] = [];
  if (starts.length === 0 || starts[0]!.at > 0) slices.push({ name: '(module)', body: src.slice(0, starts[0]?.at ?? src.length) });
  starts.forEach((s, i) => slices.push({ name: s.name, body: src.slice(s.at, starts[i + 1]?.at ?? src.length) }));
  return slices.map((s) => ({ component: s.name, bare: (s.body.match(/<button(?=[\s>/])/g) ?? []).length }));
}

function scan(): Record<string, number> {
  const files = execSync('git ls-files app/onboarding app/open-shop', { cwd: web, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'));
  assert.ok(files.length > 30, `scanned ${files.length} files — the walk has gone blind`);
  const out: Record<string, number> = {};
  for (const f of files) {
    for (const c of bareByComponent(readFileSync(join(web, f), 'utf8'))) {
      if (c.bare) out[`${f.replace(/^app\//, '')} › ${c.component}`] = c.bare;
    }
  }
  return out;
}

test('the cutter names the component that holds the bare button, and `button-ok` spares one (fixtures)', () => {
  const two = ['export function Swept() {', '  return <ActionButton tone="brand" label="Go" />;', '}', 'function Other() {', '  return <button type="button">x</button>;', '}'].join('\n');
  assert.deepEqual(bareByComponent(two), [{ component: 'Swept', bare: 0 }, { component: 'Other', bare: 1 }]);
  const spared = 'function Day() {\n  return <button type="button" /* x */>1</button>; // button-ok: a calendar day cell\n}';
  assert.deepEqual(bareByComponent(spared), [{ component: 'Day', bare: 0 }]);
});

test('no onboarding component holds more bare buttons than measured — a new one is born on ActionButton', () => {
  const now = scan();
  const table = Object.entries(now).map(([k, n]) => `  ${String(n).padStart(3)} / ${String(BARE[k] ?? 0).padStart(3)}  ${k}`);
  console.log(`bare <button> now / allowed:\n${table.join('\n')}`);
  const rose = Object.entries(now).filter(([k, n]) => n > (BARE[k] ?? 0)).map(([k, n]) => `${k}: ${BARE[k] ?? 0} → ${n}`);
  assert.deepEqual(rose, [], 'use ActionButton (components/action-button.tsx) — equal-weight choices in one useFitRow row');
});

test('a fall is written down in the same PR (the gain is locked in)', () => {
  const now = scan();
  const fell = Object.entries(BARE).filter(([k, n]) => (now[k] ?? 0) < n).map(([k, n]) => `${k}: ${n} → ${now[k] ?? 0}`);
  assert.deepEqual(fell, [], 'lower BARE in this file to the new count');
});
