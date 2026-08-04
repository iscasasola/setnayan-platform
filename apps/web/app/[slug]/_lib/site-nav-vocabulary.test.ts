/**
 * site-nav-vocabulary.test.ts — the two nav modules may not drift apart.
 *
 * ─── THE SHAPE OF THE BUG THIS EXISTS TO STOP ────────────────────────────
 * The event site has **two** navigation modules:
 *
 *   · `site-menu.ts`  → `siteMenuTabs()`   — LIVE. The bottom bar renders this.
 *   · `site-nav.ts`   → `resolveSiteNav()` — the DESIGNED per-viewer resolver,
 *                                            with zero production consumers.
 *
 * One decides what guests actually see; the other encodes the rules the owner
 * steered through five rounds. Nothing compared them, and they have already
 * disagreed **twice in two days**: a camera that vanished instead of locking,
 * and menu tabs that hid themselves after the page beneath them had started
 * rendering. Both were invisible to CI, because each module passed its own
 * tests and no test asked whether they AGREED.
 *
 * ─── WHAT THIS DOES *NOT* CLAIM ──────────────────────────────────────────
 * It does not prove the two make the same VISIBILITY decisions. They provably
 * do not, and that is by design (see the phase-awareness test at the bottom) —
 * the resolver is richer than the live bar, which is the whole reason the
 * connection is still an open follow-up.
 *
 * It proves the smaller thing that CAN be proven today: the two speak the same
 * VOCABULARY — same keys, same anchors, same words for the same tab in the same
 * phase. So the day someone wires them together the words already line up, and
 * until then neither module can quietly rename a tab out from under the other.
 *
 * ⚠ A NOTE FOR WHOEVER EDITS THIS. The first draft of this file compared the
 * two at `phase: 'day'` and "found" two failures — a missing Details/Story and
 * a home tab reading "Now" instead of "Home". BOTH were the fixture's fault:
 * the resolver deliberately drops Details/Story once the wedding is happening,
 * and deliberately renames home by phase. A cross-module guard that does not
 * model the richer module's rules reports its DESIGN as a defect. Compare
 * per-phase, or do not compare.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SITE_MENU_ANCHORS, siteMenuTabs, type SiteMenuTabKey } from './site-menu';
import { resolveSiteNav, type NavInput, type NavSlot } from './site-nav';

/** The two slots the resolver models that are NOT in-page anchors. They reach
 *  the bar as separate props (`camera`, `watch`) because they LEAVE the page.
 *  Named here so the difference between the modules is a stated fact rather
 *  than an accident nobody noticed. */
const OFF_PAGE_SLOTS = ['camera', 'watch'] as const;

/** `before` is the only phase in which every in-page anchor can appear — the
 *  resolver drops Details and Story once the wedding is happening. This is the
 *  phase the live bar's fixed tab list actually corresponds to. */
const BEFORE: NavInput = {
  viewer: { kind: 'guest' },
  phase: 'before',
  hostAllowsCamera: true,
  anyChapterPublic: true,
  hasStory: true,
  liveBroadcast: false,
  destinations: { camera: '/c/abc', watch: null },
};

const slotsAt = (over: Partial<NavInput> = {}): NavSlot[] =>
  resolveSiteNav({ ...BEFORE, ...over } as NavInput);
const keysAt = (over: Partial<NavInput> = {}): string[] => slotsAt(over).map((s) => s.key);

/** Every key the resolver can EVER emit, across the phases and viewers that
 *  exist. Compared against the live anchor map as a set — per-phase visibility
 *  is the resolver's business, not this test's. */
function everyResolverKey(): Set<string> {
  const out = new Set<string>();
  for (const phase of ['before', 'day', 'after'] as const) {
    // A vendor viewer carries the kits their category unlocks — omitting them
    // is not a smaller vendor, it is a malformed one, and the resolver throws.
    for (const viewer of [
      { kind: 'public' },
      { kind: 'guest' },
      { kind: 'couple' },
      { kind: 'vendor', kits: ['floor_command', 'song_desk', 'stage_script'] },
    ] as const) {
      for (const liveBroadcast of [false, true]) {
        for (const k of keysAt({ phase, viewer, liveBroadcast } as Partial<NavInput>)) out.add(k);
      }
    }
  }
  return out;
}

test('every anchor the LIVE bar can render is a slot the resolver knows about', () => {
  const liveKeys = Object.keys(SITE_MENU_ANCHORS) as SiteMenuTabKey[];
  const resolverKeys = everyResolverKey();
  const unknown = liveKeys.filter((k) => !resolverKeys.has(k));
  assert.deepEqual(
    unknown,
    [],
    `The bottom bar can render tabs the rules engine has never heard of: ${unknown.join(', ')}.\n` +
      `That is how the two drifted before — the bar grew a tab, the resolver did not, and the ` +
      `resolver silently stopped describing the real menu.\n` +
      `Add the slot to NavSlotKey in site-nav.ts (with its anchor), or remove the tab from ` +
      `SITE_MENU_ANCHORS.`,
  );
});

test('the resolver adds exactly the two OFF-PAGE slots, and no unexplained third', () => {
  const liveKeys = new Set(Object.keys(SITE_MENU_ANCHORS));
  const extra = [...everyResolverKey()].filter((k) => !liveKeys.has(k)).sort();
  assert.deepEqual(
    extra,
    [...OFF_PAGE_SLOTS].sort(),
    `The resolver models slots the live anchor map does not, and the ONLY ones that may differ ` +
      `are the two that LEAVE the page (camera, watch — the bar takes them as its own props).\n` +
      `An unexpected extra means a slot was added to the rules engine that no guest can reach, ` +
      `or a real anchor was dropped from site-menu.ts.`,
  );
});

test('a tab the guest reads is spelled the same in both modules, phase for phase', () => {
  // Labels are what a guest sees, and the owner has already renamed one of
  // these on the record ("Gallery", never "Photos") — exactly the kind of
  // decision a tidy-up reverses in the module nobody was looking at.
  const tabs = siteMenuTabs({ details: true, story: true, gallery: true });
  const labelByKey = new Map(slotsAt().map((s) => [s.key, s.label]));

  const mismatched: string[] = [];
  for (const tab of tabs) {
    const resolverLabel = labelByKey.get(tab.key);
    if (resolverLabel != null && resolverLabel !== tab.label) {
      mismatched.push(`${tab.key}: bar says "${tab.label}", resolver says "${resolverLabel}"`);
    }
  }
  assert.deepEqual(
    mismatched,
    [],
    `The two nav modules disagree about a word a guest reads, in the SAME phase:\n  ` +
      mismatched.join('\n  ') +
      `\nOne of them is wrong on a page the couple's entire guest list opens.`,
  );
});

test('the live anchor ids and the resolver hrefs point at the same sections', () => {
  // `site-menu.ts` stores bare ids ('site-story'); `site-nav.ts` stores hrefs
  // ('#site-story'). Same target, two spellings — so compare normalised, and
  // fail if a section id is renamed in one module only.
  const hrefByKey = new Map(slotsAt().map((s) => [s.key, s.href]));

  const wrong: string[] = [];
  for (const [key, anchorId] of Object.entries(SITE_MENU_ANCHORS)) {
    // `Object.entries` widens the key to `string`; the anchor map's keys are a
    // subset of NavSlotKey by the first test's assertion, so the narrowing is
    // sound — and if it ever stops being sound, that test reddens first.
    const href = hrefByKey.get(key as SiteMenuTabKey);
    if (href == null || !href.startsWith('#')) continue; // absent, or an off-page destination
    if (href.slice(1) !== anchorId) {
      wrong.push(`${key}: bar anchors '#${anchorId}', resolver points at '${href}'`);
    }
  }
  assert.deepEqual(
    wrong,
    [],
    `A section id was renamed in ONE module only — the other now points at a section that does ` +
      `not exist, which is a tab that scrolls nowhere:\n  ` + wrong.join('\n  '),
  );
});

test('RECORDED DIFFERENCE: the resolver renames home by phase; the live bar does not', () => {
  // Not a defect — a capability the live bar has not been given yet, pinned so
  // the connection step knows it is a real behaviour change and not a rename
  // to "fix". A guest on the day should see "Now", and after it "Recap".
  const homeLabel = (phase: NavInput['phase']) =>
    slotsAt({ phase }).find((s) => s.key === 'home')?.label;

  assert.equal(homeLabel('before'), 'Home');
  assert.equal(homeLabel('day'), 'Now', 'on the day the home tab is meant to read "Now"');
  assert.equal(homeLabel('after'), 'Recap', 'after the wedding it is meant to read "Recap"');

  // The live bar is fixed — one spelling, every phase.
  const barHome = siteMenuTabs({ details: true, story: true, gallery: true }).find(
    (t) => t.key === 'home',
  );
  assert.equal(
    barHome?.label,
    'Home',
    'if the live bar has become phase-aware, delete this test — the drift it records is closed',
  );
});

test('the comparison is not vacuous — both modules actually produced slots', () => {
  // Every assertion above passes trivially if either side returns an empty
  // list. That is the failure mode of a cross-module guard: green by comparing
  // nothing.
  const tabs = siteMenuTabs({ details: true, story: true, gallery: true });
  const keys = keysAt();
  assert.ok(tabs.length >= 4, `the bar produced only ${tabs.length} tabs — the fixture is wrong`);
  assert.ok(keys.length >= 4, `the resolver produced only ${keys.length} slots — the fixture is wrong`);
  assert.ok(
    everyResolverKey().size >= 6,
    `the phase sweep produced only ${everyResolverKey().size} distinct keys — it is not sweeping`,
  );
});
