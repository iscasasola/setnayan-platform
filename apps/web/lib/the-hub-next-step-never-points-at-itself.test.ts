/**
 * THE EVENT HUB CONTROLLER'S "RIGHT NOW" STEP NEVER POINTS AT ITSELF.
 *
 * ── WHAT THIS EXISTS TO CATCH (AREA-CHAT, 2026-09-19) ────────────────────────
 * Walked as the couple with every reply in: the S3 tile read "Every reply is
 * in. … Preview the day" and its button carried `ctaPath: '/launch'` — the
 * controller's own route. The page renders that as `${base}/launch`, so the
 * one primary button on the page reloaded the page. A circular door, drawn in
 * the primary colour, on the state the couple reaches when they have done
 * everything right.
 *
 * The ONE step allowed to name `/launch` is `unreadable` — "Try again" is a
 * deliberate reload, rendered as a plain anchor for that reason. Every other
 * step must open something else: a route under the dashboard, or `''`, which
 * the page renders as the couple's public address in a new tab.
 *
 * EXECUTED, not grepped: the resolver is run over the phases and guest states
 * that reach every branch, and every answer is checked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHubStanding,
  resolveHubNextStep,
  type HubEventRead,
  type HubGuestRead,
  type HubEditorialRead,
  type HubNextStep,
} from '@/lib/event-hub-control';

const MNL = 'Asia/Manila';
const at = (iso: string) => new Date(iso).getTime();
const NOW = at('2026-09-02T10:00:00+08:00');

const event = (over: Partial<HubEventRead> = {}): HubEventRead => ({
  measured: true,
  eventDate: '2026-12-18',
  eventEndDate: null,
  clearedAt: null,
  timezone: MNL,
  slug: 'maria-and-jomar',
  ...over,
});
const guests = (over: Partial<HubGuestRead> = {}): HubGuestRead => ({
  shared: true,
  measured: true,
  invited: 90,
  replied: 61,
  ...over,
});
const editorial = (over: Partial<HubEditorialRead> = {}): HubEditorialRead => ({
  measured: true,
  status: 'draft',
  chaptersWritten: 0,
  photosIn: 0,
  columnsOn: true,
  columnsMeasured: true,
  columnsPending: 0,
  ...over,
});

/** Every branch of the resolver, by construction — each label names the state. */
function everyStep(): Array<{ label: string; step: HubNextStep }> {
  const plan = event();
  const day = event({ eventDate: '2026-09-02' });
  const after = event({ eventDate: '2026-08-01' });
  const cases: Array<{ label: string; e: HubEventRead; g: HubGuestRead; ed?: HubEditorialRead | null }> = [
    { label: 'unmeasured event', e: event({ measured: false }), g: guests() },
    { label: 'the day', e: day, g: guests() },
    { label: 'after · nothing pending', e: after, g: guests(), ed: editorial() },
    { label: 'after · columns pending', e: after, g: guests(), ed: editorial({ columnsPending: 3 }) },
    { label: 'after · no editorial read', e: after, g: guests(), ed: null },
    { label: 'no slug', e: event({ slug: null }), g: guests() },
    { label: 'guest list not shared', e: plan, g: guests({ shared: false }) },
    { label: 'guest read refused', e: plan, g: guests({ measured: false }) },
    { label: 'no guests yet', e: plan, g: guests({ invited: 0, replied: 0 }) },
    { label: 'replies pending', e: plan, g: guests({ invited: 90, replied: 61 }) },
    { label: 'every reply in', e: plan, g: guests({ invited: 90, replied: 90 }) },
  ];
  return cases.map(({ label, e, g, ed }) => ({
    label,
    step: resolveHubNextStep(resolveHubStanding(e, NOW), e, g, ed),
  }));
}

test('the sweep reaches every key the resolver can answer with', () => {
  const keys = new Set<string>(everyStep().map((s) => s.step.key));
  for (const k of ['unreadable', 'day', 'story', 'link', 'preview', 'guests', 'replies', 'ready']) {
    assert.ok(keys.has(k), `no case reaches the "${k}" step — the sweep has a hole`);
  }
});

test('🔴 no step but "Try again" points the primary button at the controller itself', () => {
  let checked = 0;
  for (const { label, step } of everyStep()) {
    if (step.key === 'unreadable') {
      // The deliberate reload keeps its meaning.
      assert.equal(step.ctaPath, '/launch', `${label}: "Try again" must reload the controller`);
      continue;
    }
    assert.notEqual(step.ctaPath, '/launch', `${label}: "${step.ctaLabel}" reloads the page it is on`);
    assert.ok(
      step.ctaPath === '' || step.ctaPath.startsWith('/'),
      `${label}: ctaPath "${step.ctaPath}" is neither the public address nor a dashboard route`,
    );
    checked += 1;
  }
  assert.ok(checked >= 8, `checked ${checked} steps`);
});

test('every reply in → the couple is sent to look at their page as a guest, not back here', () => {
  const e = event();
  const step = resolveHubNextStep(resolveHubStanding(e, NOW), e, guests({ invited: 90, replied: 90 }));
  assert.equal(step.key, 'ready');
  assert.equal(step.ctaPath, '', 'the ready step must open the public address (the page renders "" as /<slug>, new tab)');
  assert.equal(step.ctaLabel, 'Open as a guest');
});
