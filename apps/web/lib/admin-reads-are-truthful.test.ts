/**
 * admin-reads-are-truthful.test.ts — an admin screen may not state what it did
 * not measure (2026-10-01 · admin audit 2026-09-30, step 5 PR 1).
 *
 * ── The disease (same one as admin-money-and-gift-words-are-honest.test.ts) ─
 * Supabase RESOLVES with `{ error }` instead of throwing, so a refused read
 * arrives as `data: null`, `?? []` / `?? 0` / a FALLBACK turns it into "none",
 * and the screen says so with confidence:
 *
 *   /admin/work ............. "All queues clear." over queues nobody counted
 *   /admin (Overview) ....... "0 items need you" when the digest threw
 *   Numbers › Connection logs "All clear — No active faults right now."
 *   Music Maker queue ....... "No Music Maker orders yet." with paid orders
 *   Studio › Social queue ... "No take-downs pending." on a 24-hour legal clock
 *
 * And the worse half — forms seeded from a read that failed, whose Save then
 * writes the defaults over the real values:
 *
 *   Event type › Profile / Onboarding · Budget Planner engine settings ·
 *   Ugat › Onboarding music · Integrations · Secrets
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL: every check pins the RENDER (the notice,
 * the gate before the empty state, the disabled Save), not just the binding.
 * 🛡 Sabotage-checked: each fix was reverted in turn and the matching test went
 * RED before it was trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** `later` appears after `earlier`, within `window` characters. */
function follows(s: string, earlier: string, later: string, window: number, why: string) {
  const a = s.indexOf(earlier);
  assert.ok(a >= 0, `missing: ${earlier}`);
  const b = s.indexOf(later, a);
  assert.ok(b > a && b - a < window, why);
}

// ── 1 · /admin/work + the Overview headline ─────────────────────────────────

test('/admin/work: an uncounted queue is never folded into "All queues clear."', () => {
  const s = src('app/admin/queues/_components/queues-triage-feed.tsx');
  // Derived from the rendered rows, so a queue added later is covered.
  assert.match(s, /const unreadCount = items\.filter\(\(i\) => i\.count === null\)\.length;/);
  assert.match(s, /couldn’t be read — refresh to try again\./);
  // THE RENDER: the all-clear is gated on nothing being unread…
  assert.match(s, /\{totalOpen === 0 && !unreadNote && \(/, 'the all-clear must be withheld when a queue is unread');
  follows(s, '{totalOpen === 0 && !unreadNote && (', 'All queues clear.', 900, '"All queues clear." must sit inside the unread gate');
  assert.equal([...s.matchAll(/All queues clear\./g)].length, 1, 'a second, ungated all-clear appeared');
  // …the notice is rendered…
  assert.match(s, /\{unreadNote \? \(\s*<div\s+role="alert"/);
  // …and the subtitle does not say "Nothing waiting" over an unread queue.
  assert.match(s, /unreadNote && totalOpen === 0\s*\?\s*unreadNote/);
});

test('Overview: the headline says "—", not "0 items need you", when a queue went uncounted', () => {
  const s = src('app/admin/page.tsx');
  assert.match(s, /const actionableUnread = Object\.entries\(ADMIN_QUEUE_META\)\.some\(/);
  assert.match(s, /typeof digest\[key\]\?\.count !== 'number'/);
  assert.match(s, /\{actionableUnread \? '—' : <CountUp value=\{actionableOpen\} \/>\}/);
  assert.doesNotMatch(s, /^\s*<CountUp value=\{actionableOpen\} \/>\s*$/m, 'an ungated headline count came back');
  // The cleared-queues ring does not show a partial percentage either.
  assert.match(s, /pct=\{anyUnavailable \? 0 : clearedPct\}/);
  // Recent activity: a refused log read is not "No admin actions logged yet."
  assert.match(s, /const \{ data: auditRows, error: auditError \} = await admin/);
  follows(s, '{auditError ? (', 'No admin actions logged yet.', 400, 'the empty activity line must sit after the auditError gate');
});

// ── 2 · Numbers › Connection logs ───────────────────────────────────────────

test('Connection logs: a refused read is not "All clear"', () => {
  const s = src('app/admin/app-performance/_surfaces/connection-logs-surface.tsx');
  assert.match(s, /\{ data: activeData, error: activeError \}/);
  assert.match(s, /\{ data: resolvedData, error: resolvedError \}/);
  // The island (whose empty state IS the all-clear) is never mounted on a refusal.
  follows(s, 'if (activeError || resolvedError) {', '<ConnectionLogsClient', 900, 'the refusal must return before the island mounts');
  assert.match(s, /if \(activeError \|\| resolvedError\) \{\s*return \(/);
});

// ── 3 · Music Maker queue ───────────────────────────────────────────────────

test('Music Maker queue: a refused orders read sets queryError and withholds "No Music Maker orders yet."', () => {
  const s = src('app/admin/pakanta/page.tsx');
  assert.match(s, /if \(orderErr\) \{\s*logQueryError\([\s\S]{0,160}?\);\s*queryError = orderErr\.message;/, 'the orders read logs but does not set queryError');
  assert.match(s, /if \(fallback\.error\) \{\s*logQueryError\([\s\S]{0,160}?\);\s*queryError = fallback\.error\.message;/);
  assert.match(s, /\{rows\.length === 0 && queryError \? null : rows\.length === 0 \? \(/, 'the empty state must be withheld on a failed read');
  follows(s, 'rows.length === 0 && queryError ? null', 'No Music Maker orders yet.', 500, 'the empty state must sit behind the queryError gate');
});

// ── 4 · Studio › Social queue ───────────────────────────────────────────────

test('Social queue: every section answers "what if the read failed?"', () => {
  const s = src('app/admin/studio/_surfaces/social-queue-surface.tsx');
  // Required on the type, so a new section cannot skip it.
  assert.match(s, /loadFailed: boolean;\s*children: React\.ReactNode;/);
  const sections = [...s.matchAll(/<QueueSection\b[\s\S]*?>/g)].map((m) => m[0]);
  assert.ok(sections.length >= 8, `expected the 8 queue sections, found ${sections.length}`);
  for (const tag of sections) assert.match(tag, /loadFailed=\{/, `a QueueSection has no loadFailed: ${tag.slice(0, 80)}`);
  // THE RENDER: the notice comes before the empty state, and the count is "—".
  assert.match(s, /\{title\} · \{loadFailed \? '—' : formatCount\(count\)\}/);
  assert.match(
    s,
    /\{loadFailed \? \(\s*<p role="alert"[\s\S]{0,260}?Couldn&rsquo;t load this[\s\S]{0,60}?\) : count === 0 \? \(/,
    'the empty state must sit after the loadFailed notice',
  );
  // Take-downs — the one with the legal clock — is wired to its own read.
  follows(s, 'title="Take-downs needed"', 'loadFailed={Boolean(takedownErr)}', 300, 'take-downs must carry its own read error');
  // The consent lists also depend on the event lookup, which used to be unbound.
  assert.match(s, /const \{ data: eventData, error: eventErr \} = await admin/);
  assert.match(s, /loadFailed=\{Boolean\(pendingErr\) \|\| consentEventsFailed\}/);
});

// ── 5 · forms seeded from a read may not Save over the real values ─────────

test('Event type › Profile: a refused profile read disables Save', () => {
  const s = src('app/admin/event-types/[eventType]/profile/page.tsx');
  assert.match(s, /const \{ data: profileData, error: profileError \} = await admin/);
  assert.match(s, /const profileReadFailed = Boolean\(profileError\);/);
  assert.match(s, /<SubmitButton\s+disabled=\{profileReadFailed\}/);
  assert.match(s, /!profileData && !profileReadFailed \? 'No profile row yet/, '"No profile row yet" must not print over a refused read');
  // A refused vocab read is not a 404.
  assert.match(s, /if \(vocabError\) return <ProfileReadFailed \/>;\s*if \(!vocab\) notFound\(\);/);
});

test('Event type › Onboarding: a refused override read never mounts the editor', () => {
  const s = src('app/admin/event-types/[eventType]/onboarding/page.tsx');
  assert.match(s, /\{ data: rowData, error: rowError \}/);
  follows(s, 'if (rowError) return <OnboardingReadFailed />;', '<OnboardingEditor', 4000, 'the editor must not mount after a refused read');
  assert.match(s, /if \(vocabError\) return <OnboardingReadFailed \/>;\s*if \(!vocab\) notFound\(\);/);
});

test('Budget Planner: a refused engine-config read disables "Save settings"', () => {
  const s = src('app/admin/budget-planner/page.tsx');
  assert.match(s, /const configUnread = Boolean\(configRes\.error\);/);
  assert.match(s, /disabled=\{configUnread\}\s*>\s*Save settings/);
});

test('Ugat › Onboarding music: the measured settings read disables Save', () => {
  const s = src('app/admin/ugat/_surfaces/onboarding-surface.tsx');
  assert.match(s, /await fetchPlatformSettingsMeasured\(admin\)/);
  assert.doesNotMatch(s, /\bfetchPlatformSettings\(/, 'went back to the unmeasured read');
  assert.match(s, /disabled=\{settingsReadFailed\}\s*>\s*Save background music/);
});

test('Integrations: any refused read renders the notice INSTEAD of the forms', () => {
  const s = src('app/admin/integrations/page.tsx');
  assert.match(s, /await Promise\.all\(\[[\s\S]*?getSecretPresenceMapMeasured\(\)/);
  assert.doesNotMatch(s, /\bgetSecretPresenceMap\(\)/);
  const gate = s.indexOf('if (secretRes.error || settingsRes.error || presence.readFailed) {');
  const firstForm = s.indexOf('<form');
  assert.ok(gate > 0 && firstForm > gate, 'the refusal must return before the first form');
  assert.match(s, /presence\.readFailed\) \{\s*return \(/);
});

test('Secrets: unread presence is "unknown", unread rotations replace the alarm banner', () => {
  const s = src('app/admin/secrets/page.tsx');
  assert.match(s, /const presenceUnread = presence\.readFailed \|\| Boolean\(resendRes\.error\);/);
  assert.match(s, /const consolePresence: Record<string, boolean> = presenceUnread\s*\?\s*\{\}/, 'an unread presence map must answer "unknown", not "not configured"');
  assert.match(s, /const rotationsUnread = Boolean\(rotationRes\.error\);/);
  follows(s, '{rotationsUnread ? (', 'Every', 1600, 'the all-clear banner must sit behind the rotationsUnread gate');
});

test('getSecretPresenceMapMeasured reports a refused read instead of an all-false map', () => {
  const s = src('lib/integration-config.ts');
  assert.match(s, /const \{ data, error \} = await admin\s*\.from\('platform_integration_secrets'\)/);
  assert.match(s, /if \(error\) return \{ map, readFailed: true \};/);
  // The old entry point is a thin wrapper, so both answer from one read.
  assert.match(s, /return \(await getSecretPresenceMapMeasured\(\)\)\.map;/);
});
