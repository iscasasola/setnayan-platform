/**
 * couple-media-cap-is-enforced.test.ts — THE ALLOWANCE IS A CAP (FREE 10 MB ·
 * EVENT HUB PRO 500 MB), A REMOVED PICTURE GIVES ITS BYTES BACK, AND THE METER
 * SITS WHERE THE UPLOADS HAPPEN.
 *
 * DECISION_LOG 2026-09-25: *"that means they can only upload a total of 100MB
 * compressed files"* — the couple's OWN Event Hub uploads, measured after
 * compression, "with a visible meter". Guest/Papic media is separate. Owner FINAL
 * 2026-10-15 made the number follow the plan: "Free 10MB" · "Pro is 500MB".
 *
 * Held here (the SQL half — reserve refuses, settle frees — is
 * tests/db/a-couple-upload-over-the-cap-is-refused.db.test.ts):
 *   1 · what counts: the couple's own Event Hub folders for THIS event only —
 *       never Papic captures, supplier media, or another event's folder;
 *   2 · a removed picture stops counting (the settle measures what is KEPT),
 *       a just-landed upload still counts, a PUT that never landed never does;
 *   3 · the route reserves BEFORE it signs the PUT, and refuses with the plain
 *       reason; the old after-the-fact increment is gone;
 *   4 · the meter renders under the Maker's Upload media, and the Main
 *       background's upload, inside the lazy chunk (never the first load).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

import {
  COUPLE_MEDIA_FULL_CODE,
  coupleMediaFullMessage,
  isCoupleMediaMeterPath,
  measureCoupleMediaBytes,
  referencedEventKeys,
} from './couple-media-allowance';
import { coupleMediaCapBytes } from './maker-media-limits';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));
const EDITOR = 'app/dashboard/[eventId]/website/editor';
const MB = 1024 * 1024;

const E = '11111111-2222-3333-4444-555555555555';
const OTHER = '99999999-8888-7777-6666-555555555555';
const key = (sub: string, name: string, ev = E) => `events/${ev}/${sub}/0b6c2f1e-1d0a-4b8e-9b7a-3c1f2e4d5a6b-${name}`;
const ref = (k: string) => `r2://setnayan-media/${k}`;
const OLD = new Date('2026-09-01T00:00:00Z');
const NOW = new Date('2026-10-02T12:00:00Z');

/* ── 1 · WHAT COUNTS ─────────────────────────────────────────────────────── */

test('1 · only the couple’s own Event Hub folders of THIS event count', () => {
  for (const sub of ['landing-page-hero', 'our-photos', 'site-music', 'std-video', 'std-background', 'main-background', 'scene-background']) {
    assert.ok(isCoupleMediaMeterPath(`events/${E}/${sub}`, E), `${sub} is the couple's own media`);
  }
  // Papic captures (guest + seat), supplier media, admin-delivered songs and
  // payment/paperwork files are never the couple's allowance.
  assert.equal(isCoupleMediaMeterPath(`papic/event-${E}/seat-1`, E), false, 'a Papic capture never counts');
  assert.equal(isCoupleMediaMeterPath(`papic/guest/g1`, E), false, 'a guest capture never counts');
  assert.equal(isCoupleMediaMeterPath(`vendors/v1/portfolio`, E), false, 'supplier media never counts');
  assert.equal(isCoupleMediaMeterPath(`events/${E}/pakanta-song`, E), false, 'an admin-delivered song never counts');
  assert.equal(isCoupleMediaMeterPath(`payment-proof/events/${E}`, E), false);
  assert.equal(isCoupleMediaMeterPath(`events/${OTHER}/our-photos`, E), false, 'another event’s folder never counts here');
});

/* ── 2 · THE SETTLE: WHAT IS KEPT, NOT WHAT WAS EVER UPLOADED ────────────── */

test('2 · a removed photo frees its bytes; a kept one, and one still landing, count', () => {
  const kept = key('our-photos', 'kept.jpg');
  const removed = key('scene-background', 'removed.jpg');
  const landing = key('main-background', 'just-now.mp4');
  const papic = `papic/event-${E}/seat-1/x.jpg`;
  const objects = [
    { key: kept, size: 30 * MB, lastModified: OLD },
    { key: removed, size: 40 * MB, lastModified: OLD },
    { key: landing, size: 5 * MB, lastModified: new Date(NOW.getTime() - 60_000) },
    { key: papic, size: 50 * MB, lastModified: OLD },
  ];
  const before = JSON.stringify([{ our_photos: [ref(kept)] }, [{ config_json: { canvas: { media: ref(removed) } } }], null]);
  const after = JSON.stringify([{ our_photos: [ref(kept)] }, [{ config_json: { canvas: {} } }], null]);
  assert.equal(measureCoupleMediaBytes({ eventId: E, objects, referenceText: before, now: NOW }), 75 * MB);
  assert.equal(
    measureCoupleMediaBytes({ eventId: E, objects, referenceText: after, now: NOW }),
    35 * MB,
    'removing the scene photo gave its 40 MB back; the Papic capture never counted',
  );
});

test('2b · a ref counts wherever it is filed — r2:// ref, public URL, the draft — and an upload that never landed does not', () => {
  const hero = key('landing-page-hero', 'h.jpg');
  const drafted = key('scene-background', 'd.jpg');
  const text = JSON.stringify([
    { landing_page_hero_image_url: `https://media.setnayan.com/${hero}?v=2` },
    [],
    { draft_json: { widgets: { countdown: { canvas: { media: ref(drafted) } } } } },
  ]);
  const keys = referencedEventKeys(text, E);
  assert.ok(keys.has(hero) && keys.has(drafted));
  // The counter is settled from R2's listing: a presign whose PUT never
  // happened has no object, so it is simply absent here — it never counts.
  assert.equal(
    measureCoupleMediaBytes({
      eventId: E,
      objects: [
        { key: hero, size: 2 * MB, lastModified: OLD },
        { key: drafted, size: 3 * MB, lastModified: OLD },
      ],
      referenceText: text,
      now: NOW,
    }),
    5 * MB,
  );
  assert.equal(referencedEventKeys(text, 'not-a-uuid').size, 0, 'an odd id can never become a regex');
});

test('2c · 🖼 an RSVP picture line counts — its ref held in `rsvp_ask_config`, live or drafted (DECISION_LOG 2026-10-12 (a))', () => {
  const live = key('scene-background', 'live-picture.jpg');
  const drafted = key('scene-background', 'drafted-picture.jpg');
  const removed = key('scene-background', 'removed-picture.jpg');
  const picture = (k: string) => ({ look: { added: { rsvp: [{ id: '1', k: 'p', p: ref(k) }] } } });
  /* The rows a settle reads, as it reads them: the WHOLE events row, every canvas, the draft and its undo snapshot. */
  const text = JSON.stringify([{ rsvp_ask_config: picture(live) }, [], { draft_json: { events: { rsvp_ask_config: picture(drafted) } }, applied_snapshot: null }]);
  assert.equal(
    measureCoupleMediaBytes({
      eventId: E,
      objects: [
        { key: live, size: 2 * MB, lastModified: OLD },
        { key: drafted, size: 3 * MB, lastModified: OLD },
        { key: removed, size: 7 * MB, lastModified: OLD },
      ],
      referenceText: text,
      now: NOW,
    }),
    5 * MB,
    'a picture line\u2019s file is not counted (or a removed one still is)',
  );
  /* …because the settle reads WHOLE rows: the events row (every column, `rsvp_ask_config` with it) and the draft. */
  const server = stripComments(readFileSync(join(ROOT, 'lib/couple-media-allowance.server.ts'), 'utf8'));
  assert.match(server, /admin\.from\('events'\)\.select\('\*'\)\.eq\('event_id', eventId\)\.maybeSingle\(\)/);
  assert.match(server, /admin\.from\('event_site_drafts'\)\.select\('draft_json, applied_snapshot'\)/);
});

/* ── 3 · THE ROUTE REFUSES BEFORE IT SIGNS ───────────────────────────────── */

test('3 · the refusal is the plain reason, names the room left, and names THIS plan’s number', () => {
  // PRO: 500 MB, no Pro mention (they have it).
  assert.equal(
    coupleMediaFullMessage(coupleMediaCapBytes(true), 2 * MB, true),
    'This event has used its 500 MB of uploads. Remove a photo or video to add more.',
  );
  assert.equal(
    coupleMediaFullMessage(496 * MB, 12 * MB, true),
    'This file is 12 MB, and this event has 4 MB of its 500 MB of uploads left. Remove a photo or video to make room, or pick a smaller file.',
  );
  // FREE: 10 MB, then ONE line about Pro — a ◆, never a padlock.
  assert.equal(
    coupleMediaFullMessage(coupleMediaCapBytes(false), 2 * MB, false),
    'This event has used its 10 MB of uploads. Remove a photo or video to add more. ◆ Event Hub Pro gives you 500 MB of uploads.',
  );
  assert.equal(
    coupleMediaFullMessage(6 * MB, 12 * MB, false),
    'This file is 12 MB, and this event has 4 MB of its 10 MB of uploads left. Remove a photo or video to make room, or pick a smaller file. ◆ Event Hub Pro gives you 500 MB of uploads.',
  );
  assert.doesNotMatch(coupleMediaFullMessage(10 * MB, MB, false), /🔒|lock/i, 'Pro marks itself with ◆ and never blocks with a padlock');
  assert.equal(COUPLE_MEDIA_FULL_CODE, 'event_media_full');
});

test('3b · /api/upload reserves the bytes BEFORE it signs the PUT, and counts nowhere else', () => {
  const route = read('app/api/upload/route.ts');
  const reserveAt = route.indexOf('reserveCoupleMediaBytes(coupleMediaEventId, sizeBytes)');
  const signAt = route.indexOf('presignUploadUrl({');
  assert.ok(reserveAt > 0, 'the couple-media upload is reserved against the cap');
  assert.ok(signAt > reserveAt, 'the reservation comes BEFORE the PUT is signed — a refused upload never reaches storage');
  const refusal = route.slice(reserveAt, signAt);
  assert.match(
    refusal,
    /if \(reservation\.kind === 'full'\) \{\s*return NextResponse\.json\(\s*\{\s*error: coupleMediaFullMessage\(reservation\.usedBytes, sizeBytes, reservation\.isPro\),\s*code: COUPLE_MEDIA_FULL_CODE,\s*\},\s*\{ status: 413 \},?\s*\);\s*\}/,
    'a full allowance RETURNS the refusal — nothing reaches the signer',
  );
  assert.match(
    refusal,
    /if \(reservation\.kind === 'unavailable'\) \{\s*return NextResponse\.json\([\s\S]*?\{ status: 503 \},?\s*\);\s*\}/,
    'fails CLOSED when it cannot read itself',
  );
  assert.match(route, /if \(coupleMediaEventId\) \{\s*const reservation = await reserveCoupleMediaBytes/, 'every couple-media upload is reserved');
  assert.doesNotMatch(route, /increment_couple_media_bytes/, 'the after-the-fact, never-refusing increment is gone');
  // The only door into the counter is the atomic reserve; the settle is the only way down.
  const server = read('lib/couple-media-allowance.server.ts');
  // The cap handed to the RPC is the PLAN's, from the one function, read with the real Pro gate — never a literal.
  assert.match(server, /const isPro = await eventCoupleWebsiteProActive\(admin, eventId\)\.catch\(\(\) => false\);\s*const capBytes = coupleMediaCapBytes\(isPro\);/);
  assert.match(server, /rpc\('reserve_couple_media_bytes'[\s\S]*?p_cap: capBytes,/);
  assert.doesNotMatch(server, /MAKER_EVENT_MEDIA_BYTES_CAP|\d+ \* 1024 \* 1024/, 'no second constant set beside coupleMediaCapBytes');
  assert.match(server, /rpc\('set_couple_media_bytes'/);
  assert.match(server, /if \(listing\.truncated \|\| referenceText === null\) return null;/, 'a partial view never lowers the number');
});

test('3c · ONE cap: the existing constant is plan-aware, and only its own file names it', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (name === 'node_modules' || name === '.next') continue;
      const rel = `${dir}/${name}`;
      const st = statSync(join(ROOT, rel));
      if (st.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(rel);
    }
  };
  walk('lib');
  walk('app');
  assert.ok(files.length > 500, 'the walk found the tree');
  const offenders: string[] = [];
  for (const f of files) {
    const src = read(f);
    if (f !== 'lib/maker-media-limits.ts' && /MAKER_EVENT_MEDIA_BYTES_CAP/.test(src)) offenders.push(`${f}: reads the cap around coupleMediaCapBytes`);
    if (/(?:FREE|PRO)_COUPLE_MEDIA_BYTES|COUPLE_MEDIA_(?:BYTES_)?(?:CAP|QUOTA|LIMIT)\b/.test(src)) offenders.push(`${f}: a second quota constant`);
  }
  assert.deepEqual(offenders, []);
  const limits = read('lib/maker-media-limits.ts');
  assert.match(limits, /export const MAKER_EVENT_MEDIA_BYTES_CAP = \{\s*free: 10 \* 1024 \* 1024,[^\n]*\n\s*pro: 500 \* 1024 \* 1024,[^\n]*\n\} as const;/);
  assert.match(limits, /export function coupleMediaCapBytes\(isPro: boolean\): number \{\s*return isPro \? MAKER_EVENT_MEDIA_BYTES_CAP\.pro : MAKER_EVENT_MEDIA_BYTES_CAP\.free;\s*\}/);
});

/* ── 4 · THE METER WHERE THE UPLOADS HAPPEN ──────────────────────────────── */

async function paintRow(props: Record<string, unknown>): Promise<string> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { SceneBackgroundRow } = await import(`../${EDITOR}/_components/scene-background-row`);
  const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: router as never },
      React.createElement(SceneBackgroundRow, {
        eventId: E,
        widgetType: 'countdown',
        canvas: { media: ref(key('scene-background', 'a.jpg')) },
        stageScenes: [{ type: 'countdown', canvas: {} }],
        stageLabel: 'Invitation',
        draftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
        themeColours: ['#1b1a17'],
        ownsPro: true,
        ...props,
      }),
    ),
  );
}

test('4 · the meter renders under the scene’s Upload media, with the settled number', async () => {
  const html = await paintRow({ mediaUsedBytes: 42 * MB });
  const upload = /data-inspector-row="scene-upload"[\s\S]*$/.exec(html)?.[0] ?? '';
  assert.match(upload, /aria-label="Event media storage used"/, 'the meter sits in the upload row');
  assert.match(upload, /Your media · 42 MB of 500 MB/, 'a Pro couple reads the Pro number');
  assert.doesNotMatch(upload, /Unlock Pro/, 'a Pro couple is never offered Pro');
  const full = await paintRow({ mediaUsedBytes: coupleMediaCapBytes(true) });
  assert.match(full, /remove something to add more/, 'a full allowance says what to do');
  assert.doesNotMatch(full, /Unlock Pro/);
});

test('4a · a FREE couple reads 10 MB, and at the cap sees one ◆ Pro line with Unlock Pro on the existing path', async () => {
  const part = await paintRow({ ownsPro: false, mediaUsedBytes: 4 * MB });
  const meter = (h: string) => /data-inspector-row="scene-upload"[\s\S]*$/.exec(h)?.[0] ?? '';
  assert.match(meter(part), /Your media · 4 MB of 10 MB/, 'a Free couple reads the Free number');
  assert.doesNotMatch(meter(part), /Unlock Pro/, 'the Pro line waits until the allowance is used');
  const full = meter(await paintRow({ ownsPro: false, mediaUsedBytes: coupleMediaCapBytes(false) }));
  assert.match(full, /10 MB of 10 MB/);
  assert.match(full, /◆ Event Hub Pro gives you 500 MB\./, 'ONE line, the Pro mark, the Pro number');
  assert.match(full, new RegExp(`href="/dashboard/${E}/studio/website-pro"[^>]*>Unlock Pro<`), 'Unlock Pro goes to the existing upgrade path');
  assert.doesNotMatch(full, /🔒|padlock/i, 'never a padlock');
  // A couple already OVER the new Free number (files are never deleted): full, nothing removed, still just one line.
  const over = meter(await paintRow({ ownsPro: false, mediaUsedBytes: 40 * MB }));
  assert.match(over, /40 MB of 10 MB/);
  assert.equal((over.match(/Event Hub Pro gives you/g) ?? []).length, 1);
});

test('4b · the Main background shows it too, and both stay in the lazy Maker chunk', () => {
  const panel = read(`${EDITOR}/_components/main-background-panel.tsx`);
  assert.match(panel, /<FileUpload[\s\S]*?pathPrefix=\{`events\/\$\{eventId\}\/main-background`\}[^<]*?\/>[\s{}]*\{typeof mediaUsedBytes === 'number' \? <MakerMediaMeter usedBytes=\{mediaUsedBytes\} capBytes=\{coupleMediaCapBytes\(ownsPro\)\} proHref=\{ownsPro \? null : `\/dashboard\/\$\{eventId\}\/studio\/website-pro`\} \/> : null\}/);
  const page = read(`${EDITOR}/page.tsx`);
  assert.match(page, /<MainBackgroundPanel[\s\S]*?mediaUsedBytes=\{mediaUsedBytes\}/);
  assert.match(page, /sceneFormat=\{\{[\s\S]*?mediaUsedBytes,/);
  assert.match(page, /couple_media_bytes/, 'the editor reads the counter in its one event read');
  const shell = read(`${EDITOR}/_components/editor-shell.tsx`);
  assert.match(shell, /<SceneBackgroundRow[\s\S]*?mediaUsedBytes=\{sceneFormat\.mediaUsedBytes\}/);
  // ⚡ The first-load budget: both panels load through next/dynamic only.
  const lazy = read('app/dashboard/[eventId]/launch/_components/details-lazy.tsx');
  assert.match(lazy, /SceneBackgroundRow = dynamic\(/);
  assert.match(lazy, /MainBackgroundPanel = dynamic\(/);
  assert.doesNotMatch(shell, /import \{[^}]*MakerMediaMeter/, 'the meter is never pulled into the shell’s first load');
});
