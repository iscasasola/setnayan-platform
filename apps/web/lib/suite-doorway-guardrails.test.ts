/**
 * Suite doorway guardrail tests — Whats_Next_Suite_AI_Pricing_2026-07-18 §2,
 * the 7 guardrails the 2026-07-18 doorway audit called for. Written against
 * the SHIPPED surface: /dashboard/[eventId]/suite (flag NEXT_PUBLIC_SUITE,
 * name constant SUITE_NAME). Owner 2026-07-19: the name is LOCKED as "Suite"
 * (supersedes the shipped "Silid" naming these tests were first written
 * against) — these tests follow the surface if it ever moves again (the
 * source-scan below fails loudly if the page file moves).
 *
 * Statically covered here (5 of the 7):
 *   1. routes-helper   — every FREE_TOOLS href in suite/page.tsx comes from a
 *                        `routes.*` builder (no hand-typed paths) AND each
 *                        referenced builder resolves to a real app-router page.
 *   2. retired-prefix  — no doorway href starts with a retired route prefix
 *                        (/design, /vendors/compare).
 *   3. addOnHref       — addOnHref()/appStoreDetailHref() resolve to a real
 *                        app-router page for every catalog key (both seating
 *                        flag branches), and every non-opensDirect live entry
 *                        has an add-ons-detail.ts entry so /about can't 404.
 *   4. free ≠ surface  — the Suite free layer never contains a paid buy-wall
 *                        surface (the audit's Custom-QR regression), and a
 *                        free-trial chip is never presented as "Free".
 *   5. free ≠ paid     — every "Free"-labelled catalog entry's doorway lands
 *                        on a working page; the two audit-known gaps
 *                        (photo-delivery, music-creator) are pinned below in
 *                        KNOWN_GAPS so they stay visible until resolved.
 *
 * NOT covered here (need a running server — see the changelog fragment):
 *   6. auth-guard is the only legal redirect out of a tool page.
 *   7. smoke server binds localhost dual-stack + warm-compiles the routes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADD_ONS, addOnHref, appStoreDetailHref } from './add-ons-catalog';
import { addOnDetail } from './add-ons-detail';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(LIB_DIR, '..', 'app');
/*
  🧭 THE SUITE PAGE IS GONE (owner 2026-10-02, tracker d1: "remove the old
  full-page More Services — the More menu is the one place"). The four tests
  that read its SOURCE (its FREE_TOOLS hrefs, its routes.* builders, its
  Compare doorway, its retired prefixes) went with it — there is no source left
  for them to read, and its free tools all live at their homes
  (`TOOL_HOMES`, lib/our-services.ts). Every test below is about the CATALOG,
  which every menu still reads, and stays.
*/

/** Retired route prefixes (2026-07-18 doorway audit) — nothing may link here. */
const RETIRED_PREFIXES = ['/design', '/vendors/compare'] as const;

/**
 * Audit-known gaps, pinned so they stay VISIBLE until resolved (per the task
 * brief: encode current reality, don't hide it). Each entry keeps its guardrail
 * green while asserting the gap still looks exactly the way we think it does —
 * if reality changes (owner flips a status, a real surface ships), the paired
 * assertion below fails and this allowlist must be updated consciously.
 *
 * BOTH prior gaps RESOLVED 2026-07-22 (owner pricing answers), so this is empty:
 *   • photo-delivery — moved to studioGroup 'utility' (delivered THROUGH Papic),
 *     so it no longer sits in the free layer. Locked below.
 *   • music-creator  — RETIRED (folded into Pakanta); the card is removed from
 *     the catalog. Locked below.
 */
const KNOWN_GAPS: Record<string, string> = {};

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.ts', 'route.tsx'];

function hasPageFile(dir: string): boolean {
  return PAGE_FILES.some((f) => fs.existsSync(path.join(dir, f)));
}

function subDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Resolve an app URL against the app-router tree on disk, mirroring Next.js
 * matching just enough for these guardrails: literal segments shadow dynamic
 * `[param]` siblings, `(group)` folders are URL-transparent, and a catch-all
 * `[...param]` swallows the rest.
 */
function walk(dir: string, segs: readonly string[]): boolean {
  if (segs.length === 0) {
    if (hasPageFile(dir)) return true;
    // A group folder can host the leaf page (e.g. dashboard/(launcher)/page.tsx).
    return subDirs(dir)
      .filter((n) => n.startsWith('(') && n.endsWith(')'))
      .some((n) => walk(path.join(dir, n), segs));
  }
  const head = segs[0]!; // segs.length > 0 guarded above
  const rest = segs.slice(1);
  const names = subDirs(dir);
  // 1 · literal match wins (Next.js: literal shadows dynamic without backtracking).
  if (names.includes(head) && walk(path.join(dir, head), rest)) return true;
  for (const name of names) {
    // 2 · catch-all swallows everything that remains.
    if (/^\[\.\.\..+\]$/.test(name) && hasPageFile(path.join(dir, name))) return true;
    // 3 · dynamic segment.
    if (/^\[[^\].]+\]$/.test(name) && walk(path.join(dir, name), rest)) return true;
    // 4 · route groups are transparent — retry the same segments inside.
    if (name.startsWith('(') && name.endsWith(')') && walk(path.join(dir, name), segs)) {
      return true;
    }
  }
  return false;
}

function routeExists(href: string): boolean {
  const clean = href.split('?')[0]!.split('#')[0]!;
  return walk(
    APP_DIR,
    clean.split('/').filter((s) => s.length > 0),
  );
}

/** Replicates the Suite page's free-layer partition (suite/page.tsx). */
function suiteFreeLayerKeys(): string[] {
  return ADD_ONS.filter(
    (a) => a.studioGroup !== 'utility' && a.tier === 'free' && a.status !== 'coming_soon',
  ).map((a) => a.key);
}

const EVT = 'EVENT_ID';


test('no add-on href starts with a retired route prefix', () => {
  for (const a of ADD_ONS) {
    for (const href of [addOnHref(a.key, EVT), appStoreDetailHref(a.key, EVT)]) {
      for (const prefix of RETIRED_PREFIXES) {
        assert.ok(
          !href.startsWith(prefix),
          `${a.key}: ${href} points into the retired ${prefix} tree`,
        );
      }
    }
  }
});

test('addOnHref resolves to a real app-router page for every catalog key', () => {
  for (const a of ADD_ONS) {
    const href = addOnHref(a.key, EVT);
    assert.ok(routeExists(href), `${a.key}: addOnHref → ${href} has no page`);
  }
});

test('addOnHref seating kill-switch branch (NEXT_PUBLIC_SEATING_3D=false) also resolves', () => {
  const prev = process.env.NEXT_PUBLIC_SEATING_3D;
  try {
    process.env.NEXT_PUBLIC_SEATING_3D = 'false';
    const fallback = addOnHref('seating', EVT);
    assert.equal(fallback, `/dashboard/${EVT}/seating`, 'kill-switch must open the 2D editor');
    assert.ok(routeExists(fallback), `seating fallback ${fallback} has no page`);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SEATING_3D;
    else process.env.NEXT_PUBLIC_SEATING_3D = prev;
  }
});

test('appStoreDetailHref resolves to a real app-router page for every catalog key', () => {
  for (const a of ADD_ONS) {
    const href = appStoreDetailHref(a.key, EVT);
    assert.ok(routeExists(href), `${a.key}: appStoreDetailHref → ${href} has no page`);
  }
});

test('every non-opensDirect live entry has an add-ons-detail entry (its /about page cannot 404)', () => {
  for (const a of ADD_ONS) {
    if (a.opensDirect || a.status === 'coming_soon' || a.studioGroup === 'utility') continue;
    assert.ok(
      addOnDetail(a.key),
      `${a.key}: /studio/about/${a.key} would notFound() — add an ADD_ON_DETAILS entry`,
    );
  }
});

// ── 4 · free layer ≠ paid buy-wall surface ─────────────────────────────────────

test('a free-trial chip is never presented as "Free" (trial ≠ free)', () => {
  for (const a of ADD_ONS) {
    if (a.freeTrial) {
      assert.notEqual(
        a.tier,
        'free',
        `${a.key}: carries both a freeTrial chip and tier 'free' — a trial is not free`,
      );
    }
  }
});

test('the Suite free layer is exactly the reviewed set (any change is a conscious diff)', () => {
  // 2026-07-22: music-creator RETIRED (folds into Pakanta) and photo-delivery
  // moved to 'utility' (delivered THROUGH Papic) — both consciously dropped here.
  // 2026-07-23: indoor-blueprint ADDED — owner "indoor blueprint is free and uses
  // the 2D Plan for free"; the retired paid ₱1,499 SKU is now a free tool riding
  // on the free 2D seat plan (tier:'free', opensDirect).
  // 2026-08-14: 'event' + 'editorial' DROPPED — consciously. The website
  // consolidation (verdict §2 defect 1 · owner sign-off #2) retires both
  // standalone cards into chips on the "Your Website" card. Same mechanism as
  // photo-delivery 2026-07-22: studioGroup 'utility', so the card leaves the
  // grid while the entry + every deep link to it stay alive. Locked below.
  // 2026-09-06: custom-qr-guest ADDED — owner "keep custom QR per guest free".
  // The SKU was already ₱0.00 in the catalogue and published as free in
  // llms.txt, while `eventOwnsSku` still demanded an order — so the branded QR
  // stayed locked behind a zero-peso checkout. It joined FREE_FOR_ALL_SKUS and
  // the entry took `tier: 'free'`; this row is the Suite's half of that.
  assert.deepEqual(suiteFreeLayerKeys().sort(), [
    'animated-monogram',
    'indoor-blueprint',
    'landing-page',
    'mood-board',
    'panood',
    'playlist',
    'rsvp',
    'save-the-date',
    'seating',
  ]);
});

// ── 2026-08-14 · the website consolidation + the Tab-1 refile ─────────────────

test('the website section is ONE doorway plus the two parts that own their own job', () => {
  const website = ADD_ONS.filter((a) => a.studioGroup === 'website').map((a) => a.key).sort();
  // Verdict §2 defect 1: five doorways for one product became three. Save the
  // Date (own SKU) and RSVP (own guest-tool job) deliberately KEEP standalone
  // rows — chipping them would be a miniaturized re-dupe. If a sixth website
  // doorway ever appears, this fails and someone has to justify it.
  assert.deepEqual(website, ['landing-page', 'rsvp', 'save-the-date', 'website-pro']);
});

test('a retired part-card keeps its entry, its label and a working doorway', () => {
  // The retirement must NOT be a deletion. Deleting the entry is what leaves
  // raw slugs on the ~33 surfaces that read this catalog, and it would 404 the
  // /studio/<key> redirect that still serves old bookmarks.
  for (const key of ['event', 'editorial']) {
    const entry = ADD_ONS.find((a) => a.key === key);
    assert.ok(entry, `${key}: entry was DELETED — retire it via studioGroup 'utility' instead`);
    assert.equal(entry!.studioGroup, 'utility', `${key}: must be retired to 'utility'`);
    assert.ok(routeExists(addOnHref(key, EVT)), `${key}: doorway no longer lands on a page`);
  }
});

test('the Your Website card carries NO chips, because its landing already does', () => {
  /*
    ⭐ THE CHIPS WERE RETIRED 2026-09-02 (owner ruling — "if it is the same then
    adjust"). Until then the card opened the `/website` hub and carried two
    deep-link chips, "Event page" and "Editorial"; the hub was the map and the
    chips were the shortcuts. The card now opens the Event Hub CONTROLLER, whose
    own "set once" strip carries both of those destinations by name — so a chip
    would be a second control for a door already visible one tap in, the exact
    "distinction a couple can see is fake" the 2026-08-14 verdict removed.

    🔑 THE CHIPS WERE ONLY EVER ABOUT REACHABILITY, so that is what is pinned
    now — not their absence alone. An assertion that merely counted zero chips
    would still pass on the day somebody strips the controller's strip and
    leaves both editors reachable from nowhere.
  */
  // The card's own destination is the controller…
  const cardHref = appStoreDetailHref('landing-page', EVT);
  assert.equal(cardHref, `/dashboard/${EVT}/launch`, 'the card no longer opens the controller');
  assert.ok(routeExists(cardHref), 'the card opens a route that does not exist');

  // …and the controller still carries what the two chips used to reach. If it
  // stops, this fails and the chips (or something better) have to come back.
  const controller = fs.readFileSync(
    path.join(APP_DIR, 'dashboard', '[eventId]', 'launch', 'page.tsx'),
    'utf8',
  );
  for (const door of ['/website/editor', '/story']) {
    assert.ok(
      controller.includes(`\${base}${door}`),
      `the controller no longer links ${door} — the retired chip was that page's last shortcut`,
    );
    assert.ok(routeExists(`/dashboard/${EVT}${door}`), `${door} lost its route`);
  }
});

test('the Tab-1 refile holds: planning tools are not filed as identity', () => {
  // Verdict §2 defect 5 · owner sign-off #1. Branding is now honestly pure
  // identity; Mood Board / Seat Plan / Indoor Blueprint are planning tools.
  const groupOf = (k: string) => ADD_ONS.find((a) => a.key === k)?.studioGroup;
  for (const k of ['mood-board', 'seating', 'indoor-blueprint']) {
    assert.equal(groupOf(k), 'setnayan_ai', `${k}: refiled out of 'branding' 2026-08-14`);
  }
  const branding = ADD_ONS.filter((a) => a.studioGroup === 'branding').map((a) => a.key).sort();
  assert.deepEqual(branding, ['animated-monogram', 'pakanta']);
});

// ── 5 · free label ≠ paid SKU: every shipped entry's doorway works ─────────────

test('every live/web_v1 entry opens a working page (known gaps pinned in KNOWN_GAPS)', () => {
  for (const a of ADD_ONS) {
    if (a.status === 'coming_soon') continue;
    const href = addOnHref(a.key, EVT);
    assert.ok(
      routeExists(href),
      KNOWN_GAPS[a.key]
        ? `${a.key}: ${href} has no page — known gap: ${KNOWN_GAPS[a.key]}`
        : `${a.key}: status='${a.status}' but ${href} has no page`,
    );
  }
});

test('the 2026-07-22 free-layer resolutions hold (Photo Delivery on Papic, Music Creator → Pakanta)', () => {
  // photo-delivery: delivered THROUGH Papic → moved to studioGroup 'utility', so
  // it is out of the free layer but its page stays reachable by deep link. If it
  // ever returns to the free layer (non-utility + free), this fails on purpose.
  const photoDelivery = ADD_ONS.find((a) => a.key === 'photo-delivery');
  assert.ok(photoDelivery, 'photo-delivery should still exist in the catalog (page kept)');
  assert.equal(
    photoDelivery!.studioGroup,
    'utility',
    'photo-delivery must stay out of the free layer — it is delivered via Papic',
  );
  assert.ok(
    !suiteFreeLayerKeys().includes('photo-delivery'),
    'photo-delivery must not appear in the Suite free layer',
  );

  // music-creator: RETIRED — the card is removed from the catalog (folds into
  // Pakanta). The addOnHref alias stays as the "301 to Pakanta" for old links.
  assert.ok(
    !ADD_ONS.some((a) => a.key === 'music-creator'),
    'music-creator card must be retired from the catalog',
  );
  assert.equal(
    addOnHref('music-creator', EVT),
    `/dashboard/${EVT}/studio/pakanta`,
    'the music-creator → Pakanta alias (301) must remain so lingering links resolve',
  );
});

// ── 6 · Suite search/browse tags — every service is tagged ─────────────────────

test('every catalog service carries browse tags (Suite search + chips)', () => {
  // The Suite shows tag chips per service and indexes them in its search box.
  // A service with no tags renders a blank chip row and is only findable by its
  // label/blurb — so every catalog entry must carry at least one short tag.
  const untagged = ADD_ONS.filter((a) => !a.tags || a.tags.length === 0).map((a) => a.key);
  assert.deepEqual(
    untagged,
    [],
    `catalog services missing browse tags (add a \`tags\` array): ${untagged.join(', ')}`,
  );
  // Tags stay short (1–2 words) so the chips + search read cleanly.
  for (const a of ADD_ONS) {
    for (const t of a.tags ?? []) {
      assert.ok(
        t.length > 0 && t.split(/\s+/).length <= 2,
        `${a.key}: tag "${t}" should be 1–2 words`,
      );
    }
  }
});
