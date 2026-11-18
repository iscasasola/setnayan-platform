/**
 * CHAT-33 (walk 16 Nov 2026): in the picked client's Hub, "CREW FOR THE DAY" was drawn twice (an eyebrow over the
 * crew body, which carries its own) and "View only — ask the hosts" three times (the booked list's line, then again
 * inside each page row's fold). Each is said once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(process.cwd(), 'app/vendor-dashboard/on-the-day/page.tsx'), 'utf8');
const panel = readFileSync(join(process.cwd(), 'app/vendor-dashboard/on-the-day/_components/crew-panel.tsx'), 'utf8');

test('the crew body owns its heading — nothing above it repeats it', () => {
  assert.match(panel, /Crew for the day<\/p>/, 'CrewPanel draws its own head');
  assert.doesNotMatch(page, /\{setup\}\s*<HubEyebrow>Crew for the day<\/HubEyebrow>\s*\{crew\}/);
  // The only page-level "Crew for the day" eyebrow is the no-day branch, which draws no CrewPanel under it.
  assert.equal((page.match(/>\s*Crew for the day\s*</g) ?? []).length, 1);
});

test('"View only — ask the hosts for more." is written once in the booked pages list', () => {
  assert.equal((page.match(/View only — ask the hosts for more\./g) ?? []).length, 1);
});
