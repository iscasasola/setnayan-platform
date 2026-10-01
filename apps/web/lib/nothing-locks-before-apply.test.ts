/**
 * lib/nothing-locks-before-apply.test.ts
 *
 * 💎 TRY FIRST, PAY AT APPLY — NOTHING ON THE EVENT HUB LOCKS A COUPLE OUT
 * BEFORE THEY HAVE MADE ANYTHING.
 *
 * Owner, 2026-09-29: *"◆ marks Pro and never blocks; there are no padlocks;
 * Apply is the gate ('Unlock Pro and Apply')."* A couple without Event Hub Pro
 * tries every Pro touch; the Maker's Apply sheet names what they chose and asks
 * for Pro then. Three places still answered a free couple with a lock before
 * they had made anything — "Photos you add" (an early `WebsiteProLock`), the
 * story workroom (fields `disabled={!isPro}` behind a padlock and an "Unlock
 * Editorial PRO" link) and the Maker's Post Event row (`locked: !ownsPro`).
 *
 * Two halves, because a lock can come back two ways:
 *
 *   1. THE SWEEP — every couple-side Event Hub source (the Maker, its pages and
 *      the story workroom), read with comments stripped: no page renders a Pro
 *      lock, a padlock, a Pro-disabled field or the retired "Editorial PRO"
 *      unlock. The pages that still do are named below, each with its reason;
 *      the list can only SHRINK (a named page that stops locking fails the test
 *      until it is taken off), and a new page that locks fails by name.
 *   2. THE PROPERTY — for ANY drafted story extras against ANY live story
 *      (seeded, generated), the Apply plan never lets a Pro addition through
 *      for a couple without Pro, never drops one (it stays in the draft), and
 *      lets every one through for a couple with Pro.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { planHubDraftApply, type HubDraftState, type HubLiveState } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';
import { storyProExtrasOf, STORY_PRO_EXTRA_KEYS, type StoryProExtras } from './story-pro-extras';

const WEB = join(__dirname, '..');
const EVENT = join(WEB, 'app', 'dashboard', '[eventId]');

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE SWEEP
   ═══════════════════════════════════════════════════════════════════════════ */

/** The couple-side Event Hub surfaces: the Maker, every page it opens, the story workroom. */
const ROOTS = ['website', 'launch', 'story'].map((d) => join(EVENT, d));

/** Each way a page has locked a couple out before Apply. */
const LOCKS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'a WebsiteProLock wall', re: /<WebsiteProLock\b/ },
  { name: 'a padlock mark', re: /<PaidMark\b[^>]*state=(?:"locked"|\{\s*'locked'\s*\})/ },
  { name: 'a padlock label', re: /paidMarkLabel\(\s*'locked'/ },
  { name: 'a ProChip that turns into a padlock', re: /owned \? 'unlocked' : 'locked'/ },
  { name: 'a field disabled until Pro', re: /disabled=\{\s*!\s*(?:isPro|ownsPro|proActive|hasPro)\b/ },
  { name: 'the retired "Editorial PRO" unlock', re: /Unlock Editorial PRO/ },
  { name: 'a Maker row locked on Pro alone', re: /locked:\s*!\s*ownsPro\b/ },
];

/**
 * 🧾 STILL LOCKING — each one's writer is LIVE (it writes straight to the page
 * guests read), so opening its page would be a save the server refuses. They
 * move to try-first when their page saves to the draft the way "Photos you add"
 * now does. Take a line off the moment its page stops locking — the test says so.
 */
const STILL_LOCKING: Readonly<Record<string, string>> = {
  'website/hero-photo/page.tsx':
    'Your own hero photo — the standalone page writes live; the Maker’s hero row already tries it free.',
  'website/living-hero/page.tsx': 'Living hero — `saveLivingHero` writes live and refuses a free couple.',
  'website/site-chrome/page.tsx':
    'Background music and video hero — `updateSiteChrome` writes live; the Maker’s music row already tries it free.',
};

/** The lock's own definition is not a page that uses it. */
const DEFINES_THE_LOCK = new Set(['website/_components/website-pro-lock.tsx']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

function offenders(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const rel = relative(EVENT, file).split('\\').join('/');
      if (DEFINES_THE_LOCK.has(rel)) continue;
      const src = stripComments(readFileSync(file, 'utf8'));
      const hits = LOCKS.filter((l) => l.re.test(src)).map((l) => l.name);
      if (hits.length > 0) found.set(rel, hits);
    }
  }
  return found;
}

test('the sweep reads the surfaces it claims to (a sweep of nothing passes everything)', () => {
  const files = ROOTS.flatMap((r) => walk(r)).map((f) => relative(EVENT, f).split('\\').join('/'));
  for (const must of [
    'website/our-photos/page.tsx',
    'story/_components/editorial-editor.tsx',
    'website/editor/page.tsx',
    'website/editor/_components/authoring-panels.tsx',
  ]) {
    assert.ok(files.includes(must), `the sweep no longer reads ${must}`);
  }
  assert.ok(files.length > 50, `the sweep read only ${files.length} files`);
});

test('💎 no couple-side Event Hub page locks a couple out before Apply', () => {
  const found = offenders();
  const fresh = [...found].filter(([rel]) => !(rel in STILL_LOCKING));
  assert.deepEqual(
    fresh.map(([rel, hits]) => `${rel} — ${hits.join(', ')}`),
    [],
    'A page now locks a couple out before they have made anything. Let them try it (save to the Event Hub draft) and let Apply ask for Pro.',
  );
});

test('🧾 the pages still locking are exactly the ones named — the list only shrinks', () => {
  const found = offenders();
  const stale = Object.keys(STILL_LOCKING).filter((rel) => !found.has(rel));
  assert.deepEqual(stale, [], 'These pages no longer lock — take them off STILL_LOCKING.');
});

test('the three pages this change opened stay open', () => {
  const found = offenders();
  for (const rel of [
    'website/our-photos/page.tsx',
    'story/_components/editorial-editor.tsx',
    'website/editor/page.tsx',
    'website/editor/_components/authoring-panels.tsx',
  ]) {
    assert.ok(!found.has(rel), `${rel} locks again: ${found.get(rel)?.join(', ')}`);
  }
  // Photos you add: a couple without Pro saves to the DRAFT, not live.
  const photos = stripComments(readFileSync(join(EVENT, 'website/our-photos/page.tsx'), 'utf8'));
  assert.match(photos, /!proActive \? \([\s\S]*?name=\{HUB_DRAFT_FIELD\} value="1"/, 'a free couple’s gallery save no longer goes to the draft');
  // The Maker: every row's lock is the drafted rule (store shell only) — never Pro alone.
  const maker = stripComments(readFileSync(join(EVENT, 'website/editor/page.tsx'), 'utf8'));
  for (const m of maker.matchAll(/\blocked:\s*([^,\n]+)/g)) {
    const v = m[1]!.trim();
    assert.ok(
      v === 'false' || /^draftedRowLockedIf\(/.test(v) || new RegExp(`const ${v} = draftedRowLockedIf\\(`).test(maker),
      `a Maker row is locked by \`${v}\` — only \`draftedRowLockedIf\` (the store shell) may lock a row`,
    );
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE PROPERTY — Apply is the gate, for any story
   ═══════════════════════════════════════════════════════════════════════════ */

/** A small seeded PRNG (mulberry32) — the same cases every run, so a failure reproduces. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['First Kiss', 'The toast', 'Tita Bing', 'so happy', 'Lola', 'x', 'The dog'];

function genExtras(r: () => number): StoryProExtras {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const n = () => Math.floor(r() * 4);
  return storyProExtrasOf({
    chapterOverrides: Array.from({ length: n() }, (_, i) => ({
      leadId: `lead${Math.floor(r() * 5)}`,
      ...(r() < 0.6 ? { title: pick(WORDS) } : {}),
      ...(r() < 0.4 ? { writeUp: pick(WORDS) } : {}),
      ...(r() < 0.2 ? { hidden: true } : {}),
      _i: i,
    })),
    customColumns: Array.from({ length: n() }, () => ({
      id: `col${Math.floor(r() * 5)}`,
      title: pick(WORDS),
      body: pick(WORDS),
    })),
    reviews: Array.from({ length: n() }, () => ({
      author: pick(WORDS),
      role: r() < 0.5 ? 'guest' : null,
      quote: r() < 0.9 ? pick(WORDS) : '',
      stars: Math.floor(r() * 7) - 1,
    })),
  });
}

/** Sometimes the draft is a SUBSET of live (a removal), sometimes new. */
function genDraft(r: () => number, live: StoryProExtras): Partial<StoryProExtras> {
  const other = genExtras(r);
  const out: Partial<StoryProExtras> = {};
  for (const k of STORY_PRO_EXTRA_KEYS) {
    const roll = r();
    if (roll < 0.25) continue;
    if (roll < 0.45) (out as Record<string, unknown>)[k] = (live[k] as unknown[]).slice(0, Math.floor(r() * live[k].length));
    else if (roll < 0.55) (out as Record<string, unknown>)[k] = [];
    else (out as Record<string, unknown>)[k] = other[k];
  }
  return out;
}

const liveOf = (story: Record<string, unknown>): HubLiveState => ({ events: {}, widgets: [], editorial: story });

test('💎 property — for any story, Apply without Pro never writes a Pro extra, never loses one; with Pro, writes them all', () => {
  const r = rng(20260930);
  let sawHeld = 0;
  let sawRemoval = 0;
  for (let run = 0; run < 400; run += 1) {
    const liveExtras = genExtras(r);
    const liveStory = { headline: 'Kept', ...liveExtras };
    const drafted = genDraft(r, liveExtras);
    const draft: HubDraftState = { events: {}, widgets: {}, editorial: drafted };
    const live = liveOf(liveStory);

    const free = planHubDraftApply(draft, live, false);
    for (const item of free.apply) {
      if (item.kind !== 'editorial') continue;
      const f = item.item.field;
      if (f !== 'chapterOverrides' && f !== 'customColumns' && f !== 'reviews') continue;
      assert.ok(
        item.change === 'remove' || item.change === 'none',
        `run ${run}: a couple without Pro had ${f} applied as '${item.change}'`,
      );
      sawRemoval += 1;
    }
    for (const item of free.refused) {
      if (item.kind !== 'editorial') continue;
      const f = item.item.field;
      if (f !== 'chapterOverrides' && f !== 'customColumns' && f !== 'reviews') continue;
      sawHeld += 1;
      // Held, not lost: the refused extra stays in the draft, whole.
      assert.deepEqual(free.remaining.editorial?.[f], drafted[f], `run ${run}: a held ${f} left the draft`);
      // …and the Apply sheet names it, so the couple is told what Pro is for.
      const named = hubDraftProEffects(draft, live, false).map((e) => e.id);
      assert.ok(named.includes(`story:${f}`), `run ${run}: the Apply sheet did not name ${f}`);
    }

    const pro = planHubDraftApply(draft, live, true);
    assert.equal(pro.refused.length, 0, `run ${run}: a couple WITH Pro had something held`);
    // Every extra that differs from live is written for a Pro couple.
    for (const k of STORY_PRO_EXTRA_KEYS) {
      const d = drafted[k];
      if (d === undefined || JSON.stringify(d) === JSON.stringify(liveExtras[k])) continue;
      assert.ok(
        pro.apply.some((i) => i.kind === 'editorial' && i.item.field === k),
        `run ${run}: a Pro couple's ${k} was not applied`,
      );
    }
  }
  // The generator really exercised both branches (a property of nothing passes).
  assert.ok(sawHeld > 50, `only ${sawHeld} held extras were generated`);
  assert.ok(sawRemoval > 10, `only ${sawRemoval} removals were generated`);
});

test('💎 the Apply ACTION keeps a held story extra in the draft too (it keeps its own held list)', () => {
  // `planHubDraftApply` is not the only author of what stays: the Apply action
  // rebuilds the remaining draft from its own `held` list. An extra refused for
  // Pro and not kept there would vanish from the couple's draft on the first Apply.
  const action = stripComments(readFileSync(join(EVENT, 'website/hub-draft-actions.ts'), 'utf8'));
  const rebuild = action.slice(action.indexOf('const remaining: HubDraftState'));
  for (const f of STORY_PRO_EXTRA_KEYS) {
    assert.ok(rebuild.includes(`item.item.field === '${f}'`), `the Apply action drops a held ${f} from the draft`);
  }
});
