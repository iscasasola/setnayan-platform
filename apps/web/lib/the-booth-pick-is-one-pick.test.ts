/**
 * GUARD — THE BOOTH'S TEMPLATE PICK IS ONE PICK, ON THE BOOTH AND ON HOME (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 8: "Primary template ▾ · Backup template ▾").
 *
 *   1. The pick lives at the EVENT's scope (`/dashboard/<event>`), so Home's Video booth card reads the very cookie the
 *      booth writes — not a second store, not a narrower copy.
 *   2. Home's card reads it through `patiktokBoothCookieName` and posts the booth's OWN action, with `return_to=home`;
 *      the action sends that back to Home (a fixed word picks a fixed path).
 *   3. The pre-2026-10-24 cookie is read as a fallback on the booth pages and NEVER written.
 *
 * Sabotage (2026-10-24): the path back to `/studio/patiktok` → 1 red; the card posts another action → 2 red. Restored → green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { patiktokBoothCookieName, patiktokBoothCookiePath, patiktokBoothLegacyCookieName } from '@/lib/patiktok-booth-templates';

const code = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
const E = '00000000-0000-4000-8000-000000000001';

test('1 · the pick is scoped to the event — Home and the booth read one cookie', () => {
  const home = `/dashboard/${E}`;
  const booth = `/dashboard/${E}/studio/patiktok/booth`;
  const path = patiktokBoothCookiePath(E);
  assert.ok(home === path || home.startsWith(`${path}/`), `Home (${home}) cannot read a cookie at ${path}`);
  assert.ok(booth.startsWith(`${path}/`), `the booth (${booth}) cannot read a cookie at ${path}`);
  assert.notEqual(patiktokBoothCookieName(E), patiktokBoothLegacyCookieName(E), 'the wider cookie re-uses the narrower name — the old pick would shadow it');
});

test('2 · Home reads the same cookie and posts the booth’s own action, landing back on Home', () => {
  const card = code('app/dashboard/[eventId]/_components/home-cards/home-booth-card.tsx');
  assert.match(card, /jar\.get\(patiktokBoothCookieName\(eventId\)\)/, 'the card does not read the booth’s pick');
  const pick = code('app/dashboard/[eventId]/_components/home-cards/booth-template-pick.tsx');
  assert.match(pick, /action=\{savePatiktokBoothTemplates\}/, 'the card posts something other than the booth’s action');
  assert.match(pick, /name="return_to" value="home"/, 'a pick on Home would land on the booth');
  // Only the slot that changed is posted (review 2026-10-24): both boxes start disabled, a pick enables its own.
  assert.match(pick, /name="primary" defaultValue=\{primary\} disabled/, 'the Primary is posted with every pick — a Backup pick would rewrite it');
  assert.match(pick, /name="backup" defaultValue=\{backup\} disabled/, 'the Backup is posted with every pick');
  assert.match(pick, /other\.disabled = true;/, 'the other slot is posted too');
  // …and Home offers the pickers only over a pick it can read; otherwise the first pick is the booth's.
  assert.match(card, /\{savedHere \? \(\s*<BoothTemplatePick/, 'Home guesses a pick it cannot read and would overwrite the old one');
  const actions = code('app/dashboard/[eventId]/studio/patiktok/actions.ts');
  assert.match(actions, /formData\.get\('return_to'\) === 'home'\) redirect\(`\/dashboard\/\$\{eventId\}`\)/, 'the action does not send Home back to Home');
});

test('3 · the old cookie is only ever read', () => {
  const actions = code('app/dashboard/[eventId]/studio/patiktok/actions.ts');
  assert.doesNotMatch(actions, /jar\.set\(patiktokBoothLegacyCookieName/, 'the old, narrower cookie is written again');
  const booth = code('app/dashboard/[eventId]/studio/patiktok/booth/page.tsx');
  assert.match(booth, /\?\? jar\.get\(patiktokBoothLegacyCookieName\(eventId\)\)/, 'a pick made before the move is lost on the booth');
});
