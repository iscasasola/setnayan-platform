/**
 * tip-popups-are-off.test.ts — THE CENTERED TIP POPUPS ARE SWITCHED OFF (owner, 2026-10-03).
 *
 * Owner, verbatim: "also remove these since we will place the spotlight tour soon" — about the
 * centered step carousel ("STEP 1 OF 2 · … · Back / Skip / Next"). ONE switch, `TIP_POPUPS_ON`
 * in `lib/tip-popups.ts`, turns off all of them: `MiniTour` (the ~40 mounts), the role-welcome
 * `GuidedTour`, the guest `GuestGuidedTour`, and the `GuidedTourCard` as the last backstop.
 * The mounts and `lib/tours.ts` stay — they are the spotlight tour's keys and script.
 *
 * This fails if the switch is flipped on (the spotlight tour should then replace this file, not
 * the other way round), or if any of the four pieces stops checking it.
 *
 * It is a property guard, not a phrasing guard: the GuidedTour / guidedTourView checks CALL the
 * real functions; MiniTour (imports the server Supabase client) and the two client pieces are
 * anchored on the source, each printing what it found so a blind scan is visible.
 *
 * ⚠ It also pins what must NOT be switched off: "Who can reply?" is a settings question that
 * saves a choice, not a tip, and must not read the switch.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { TIP_POPUPS_ON } from '@/lib/tip-popups';

const WEB = process.cwd();
const read = (rel: string): string => readFileSync(join(WEB, rel), 'utf8');

test('the one switch is off', () => {
  assert.equal(TIP_POPUPS_ON, false, 'TIP_POPUPS_ON is on — the centered tip popups are back. Owner 2026-10-03: off until the spotlight tour.');
  assert.match(read('lib/tip-popups.ts'), /export const TIP_POPUPS_ON: boolean = false;/, 'the switch declaration moved');
});

test('GuidedTour renders null and guidedTourView draws nothing while it is off', async () => {
  const { GuidedTour, guidedTourView } = await import('@/app/_components/guided-tour');
  const out = GuidedTour({ tourKey: 'couple_welcome_v1', completeAction: async () => {} });
  assert.equal(out, null, 'GuidedTour drew something while tip popups are off');
  const view = guidedTourView('guest_welcome_v1');
  assert.equal(view.slides.length, 0, 'guidedTourView still draws slides while tip popups are off');
  console.log(`GuidedTour → ${out}; guidedTourView slides → ${view.slides.length}`);
});

test('MiniTour returns null BEFORE any database read', () => {
  const src = read('app/_components/mini-tour.tsx');
  const guard = src.indexOf('if (!TIP_POPUPS_ON) return null;');
  const read1 = src.indexOf('createClient()');
  assert.ok(guard > -1, 'MiniTour does not check the switch');
  assert.ok(read1 > -1, 'the scan is blind: createClient() not found in MiniTour');
  assert.ok(guard < read1, 'MiniTour checks the switch AFTER it already read the database');
  console.log(`MiniTour: switch check at ${guard}, first DB read at ${read1}`);
});

test('the guest tour never opens and never reads localStorage while it is off', () => {
  const src = read('app/_components/guest-guided-tour.tsx');
  const effect = src.indexOf('useEffect(() => {');
  const guard = src.indexOf('if (!TIP_POPUPS_ON) return;');
  const storage = src.indexOf('window.localStorage.getItem');
  assert.ok(effect > -1 && storage > -1, 'the scan is blind: effect or localStorage read not found');
  assert.ok(guard > effect && guard < storage, 'GuestGuidedTour does not check the switch before its localStorage read');
  console.log(`GuestGuidedTour: effect ${effect}, switch check ${guard}, localStorage read ${storage}`);
});

test('the card itself opens only while the switch is on (last backstop)', () => {
  const src = read('app/_components/guided-tour-card.tsx');
  assert.match(src, /useState<boolean>\(TIP_POPUPS_ON\)/, 'GuidedTourCard opens regardless of the switch');
  assert.doesNotMatch(src, /useState\(true\)/, 'GuidedTourCard has a state that starts open');
});

test('every direct mount of the popups still exists (the spotlight tour reuses the keys)', () => {
  const dash = read('app/dashboard/layout.tsx');
  const admin = read('app/admin/layout.tsx');
  assert.match(dash, /<GuidedTour tourKey="couple_welcome_v1"/, 'the couple welcome mount was deleted — the switch keeps mounts, it does not remove them');
  assert.match(admin, /<GuidedTour tourKey="admin_welcome_v1"/, 'the admin welcome mount was deleted');

  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(name)) files.push(p);
    }
  };
  walk(join(WEB, 'app'));
  const mounts = files.filter((f) => /<MiniTour\b/.test(readFileSync(f, 'utf8'))).length;
  assert.ok(mounts >= 15, `only ${mounts} files mount a MiniTour — mounts were deleted wholesale instead of switched off`);
  console.log(`files mounting a MiniTour: ${mounts}`);
});

test('"Who can reply?" does not read the switch — it is a setting, not a tip', () => {
  const dir = join(WEB, 'app/dashboard/[eventId]/guests/_components');
  const f = join(dir, 'who-can-reply-ask.tsx');
  let src: string | null = null;
  try {
    src = readFileSync(f, 'utf8');
  } catch {
    // The component can be retired by its own owner ruling (a separate decision) — then there is nothing to pin.
  }
  if (src !== null) {
    assert.doesNotMatch(src, /TIP_POPUPS_ON|tip-popups/, 'WhoCanReplyAsk reads the tip-popup switch — it is a real settings question and must still show');
  }
  console.log(`who-can-reply-ask.tsx ${src === null ? 'absent (retired separately)' : 'present, does not read the switch'}`);
});
