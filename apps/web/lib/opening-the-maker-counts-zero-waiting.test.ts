/**
 * opening-the-maker-counts-zero-waiting.test.ts — OPENING THE MAKER, WITH NO
 * EDIT, LEAVES APPLY AT 0.
 *
 * Owner, live phone test 2026-10-02: Apply wore a "1" before he had done
 * anything. Every editor in Details stays mounted (`details-workspace.tsx`), so
 * anything that saves from a mount effect is a write on OPEN — and the one that
 * did was `HeroFrameSync`: an event whose hero photo was set before the Maker
 * (or at onboarding) had that photo measured and drafted as the Main background
 * the moment the Maker opened. The count then said a change was waiting that
 * the couple never made. Rule (`lib/hero-frame-sync.ts`): a measurement may
 * ride along with the couple's own change, never BE the change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { emptyHubDraft, mergeHubDraft, summarizeHubDraft, type HubDraft, type HubLiveState } from './hub-draft';
import { heroFrameWrites } from './hero-frame-sync';
import type { HubMainGround } from './hub-canvas';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const HERO = 'r2://setnayan-media/event/hero-photo.jpg';
/** An event made before the Maker: a themed page, a hero photo, its Main background never measured. */
const live = (main: HubMainGround | null = null): HubLiveState =>
  ({
    events: { invite_theme: 'galeriya', landing_page_hero_image_url: HERO },
    widgets: [
      {
        widget_id: 'w-hero',
        widget_type: 'hero',
        is_always_on: true,
        display_order: 0,
        mode: 'auto',
        config_json: main ? { main } : {},
      },
    ],
  }) as unknown as HubLiveState;

/** What the mounted `HeroFrameSync` leaves in the draft after the Maker opens (its own save, simulated). */
function draftAfterOpening(input: {
  draft: HubDraft | null;
  current: HubMainGround | null;
  heroRef: string | null;
  liveHeroRef: string | null;
  mainDrafted: boolean;
}): HubDraft | null {
  if (!heroFrameWrites(input)) return input.draft;
  const follow: HubMainGround = { follow: 'hero', of: input.heroRef!, tint: { match: true, frame: ['#c2a37a', '#4a3a2a'] } };
  return mergeHubDraft(input.draft ?? emptyHubDraft(), { widgets: { hero: { main: follow } } });
}

test('opening the Maker with no edits shows 0 waiting — for a couple with and without Pro', () => {
  for (const ownsPro of [true, false]) {
    const after = draftAfterOpening({ draft: null, current: null, heroRef: HERO, liveHeroRef: HERO, mainDrafted: false });
    const bar = summarizeHubDraft(after, live(), ownsPro);
    assert.equal(bar.changeCount, 0, `opening the Maker drafted ${bar.changeCount} change(s) nobody made (ownsPro=${ownsPro})`);
    assert.equal(bar.hasChanges, false);
  }
});

test('a stale measurement (an older hero) is not re-measured on open either', () => {
  const old: HubMainGround = { follow: 'hero', of: 'r2://setnayan-media/event/older.jpg', tint: { match: true, frame: ['#000000'] } };
  const after = draftAfterOpening({ draft: null, current: old, heroRef: HERO, liveHeroRef: HERO, mainDrafted: false });
  assert.equal(summarizeHubDraft(after, live(old), false).changeCount, 0);
});

test('the measurement still rides along with the couple’s own change', () => {
  // 🔎 Positive control: a measurement that IS written reaches the count — so the
  // "0" above is the rule holding, not the simulated save being sanitized away.
  const written = draftAfterOpening({ draft: null, current: null, heroRef: HERO, liveHeroRef: 'r2://setnayan-media/event/other.jpg', mainDrafted: false });
  assert.ok(summarizeHubDraft(written, live(), false).changeCount >= 1, 'the simulated measurement never reached the count — this test cannot see a phantom');
  // A new hero photo they put in the draft: measured where it was made.
  assert.equal(heroFrameWrites({ current: null, heroRef: 'r2://setnayan-media/event/new.jpg', liveHeroRef: HERO, mainDrafted: false }), true);
  // "Same as my hero" pressed over another live choice: the draft differs from live, so it is measured.
  assert.equal(heroFrameWrites({ current: null, heroRef: HERO, liveHeroRef: HERO, mainDrafted: true }), true);
  // An override is in charge: never replaced.
  assert.equal(
    heroFrameWrites({ current: { ground: 'none' } as HubMainGround, heroRef: 'r2://setnayan-media/event/new.jpg', liveHeroRef: HERO, mainDrafted: true }),
    false,
  );
});

test('every mount of HeroFrameSync hands it what guests see, and it decides through the one rule', () => {
  const panel = code('app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx');
  assert.match(panel, /const needs = heroFrameWrites\(/, 'HeroFrameSync no longer asks lib/hero-frame-sync.ts before it writes');
  assert.ok(!/function heroNeedsMeasuring/.test(panel), 'a second copy of the measuring rule is back in the panel');
  const mounts = [
    ...code('app/dashboard/[eventId]/website/editor/page.tsx').matchAll(/<HeroFrameSync[\s\S]*?\/>/g),
    ...panel.matchAll(/<HeroFrameSync[\s\S]*?\/>/g),
  ].map((m) => m[0]);
  assert.equal(mounts.length, 2, `expected the two mounts (Hero workspace · Main panel), found ${mounts.length}`);
  for (const m of mounts) {
    assert.match(m, /liveHeroRef=\{/, `a HeroFrameSync mount does not say which hero guests see:\n${m}`);
    assert.match(m, /mainDrafted=\{/, `a HeroFrameSync mount does not say whether the Main background is the couple's change:\n${m}`);
  }
});
