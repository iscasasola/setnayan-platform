/**
 * GUARD — PAPIC SELLS CREDITS, AND NOTHING ELSE, ON ANY COUPLE SURFACE.
 *
 * ⚖ Owner 2026-09-16 (DECISION_LOG "THE WHOLE PAPIC MODEL, SETTLED"): *"we do not have papic seat. we only
 * have papic with credits and shared amongst everybody. no dedicated shots individually."* On 2026-10-23,
 * over screenshots of his own Papic page still selling "Limited ₱100/guest · Unlimited ₱200/guest" with an
 * "activate 264 guest cameras · ₱6,000" button, crew-camera tiers, per-seat "Free camera 1/2/3" cards and
 * a "4 camera QRs are still in your pocket" card: *"why do i have these?"*
 *
 * 🔑 PROPERTIES, NOT PHRASINGS. Each test below states something that must be TRUE of the code — no couple
 * surface mounts a per-guest / per-camera / seat tier, no couple action mints an order for one, the
 * library never draws a seat count — so a reworded offer is caught as surely as the old one.
 *
 * Sabotage (2026-10-23, recorded in the PR body): re-mounting a tier picker on the page, giving a refused
 * action back its `orders` insert, and drawing `standings.cameras` on the stage each turned this red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from '@/lib/strip-comments';
import {
  PAPIC_CAMERA_SALE_REFUSED,
  RETIRED_PAPIC_CAMERA_SALE_KEYS,
  papicCameraSaleRefusedPath,
} from './papic-sells-only-credits';
import { supplierWayInLabel, supplierWayInState } from './papic-supplier-way-in';
import { allotmentRowValue, splitTheRest } from './papic-guest-allotments';
import { boardLaneCounts, boardShowingWords } from './papic-missions';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAPIC = join(WEB, 'app/dashboard/[eventId]/studio/papic');
const read = (p: string) => readFileSync(p, 'utf8');

/** Every couple-facing source file: the event dashboard tree, minus tests. */
function coupleSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
  };
  walk(join(WEB, 'app/dashboard'));
  return out;
}

const RETIRED_OFFERS = ['ExtraCamerasPicker', 'GuestCameraTierPicker', 'LimitedCard', 'PapicCamerasCard'];

test('🚨 no couple surface mounts a per-guest, per-camera or seat tier offer', () => {
  const files = coupleSources();
  assert.ok(files.length > 200, `only ${files.length} couple files were read — the walk lost its root`);
  const hits: string[] = [];
  for (const f of files) {
    const src = stripComments(read(f));
    for (const name of RETIRED_OFFERS) {
      if (new RegExp(`<${name}\\b|function ${name}\\b|export default function ${name}\\b`).test(src)) {
        hits.push(`${relative(WEB, f)} · ${name}`);
      }
    }
  }
  assert.deepEqual(hits, [], 'a retired camera offer is back on a couple surface:\n  ' + hits.join('\n  '));
  for (const gone of ['extra-cameras-picker.tsx', 'guest-camera-tier-picker.tsx']) {
    assert.equal(existsSync(join(PAPIC, gone)), false, `${gone} is back`);
  }
});

test('🚨 no couple surface prices a camera or a guest — "₱… / guest", "₱… per camera", a tier to pick', () => {
  // The shape of every retired offer: a peso amount bound to ONE guest or ONE camera, or an invitation
  // to pick a camera's tier. Credits are priced per PACK, never per head or per device.
  const PRICED_PER_HEAD = /₱[^'"`<>{}\n]{0,24}(?:\/|per |a )(?:guest|camera|seat)\b/i;
  const PICK_A_TIER = /pick (?:their|a|the) (?:camera )?tier|activate [^'"`<>\n]{0,12}guest cameras/i;
  const hits: string[] = [];
  // Papic surfaces only: a caterer may honestly quote "₱850 / guest" — a Papic camera may not.
  const papicFiles = coupleSources().filter((f) => /papic/i.test(f) || /papic/i.test(read(f)));
  assert.ok(papicFiles.length > 20, `only ${papicFiles.length} Papic files were read — the filter lost its target`);
  for (const f of papicFiles) {
    const src = stripComments(read(f));
    if (PRICED_PER_HEAD.test(src) || PICK_A_TIER.test(src)) hits.push(relative(WEB, f));
  }
  assert.deepEqual(hits, [], 'a couple surface prices a guest or a camera again:\n  ' + hits.join('\n  '));
});

test('🚨 the three retired camera sales REFUSE — couple-checked, and nothing reaches `orders`', () => {
  const src = stripComments(read(join(PAPIC, 'actions.ts')));
  const bodyOf = (fn: string) => {
    const at = src.indexOf(`export async function ${fn}(`);
    assert.ok(at > -1, `${fn} is gone — an old page's form would hit a framework error, not a sentence`);
    const next = src.indexOf('\nexport ', at + 10);
    return src.slice(at, next > -1 ? next : undefined);
  };
  const refuse = src.slice(src.indexOf('async function refuseRetiredCameraSale('), src.indexOf('export async function purchasePapicCameras('));
  assert.match(refuse, /getCoupleEventId\(/, 'the refusal no longer checks the couple first');
  assert.match(refuse, /redirect\(papicCameraSaleRefusedPath\(/, 'the refusal no longer says why');
  for (const fn of ['purchasePapicCameras', 'activatePapicLimited', 'purchasePapicExtras']) {
    const body = bodyOf(fn);
    assert.match(body, /refuseRetiredCameraSale\(formData\)/, `${fn} no longer refuses`);
    assert.doesNotMatch(body, /\.from\(|\.insert\(|\.rpc\(|payPath\(|provision/i, `${fn} reads, writes or bills again`);
  }
  // Nothing else in the file mints an order under a retired key, or under the camera order key.
  assert.doesNotMatch(src, /PAPIC_CAMERAS_ORDER_KEY|computeCameraQuote|computeLimitedQuote|provisionPaidCamerasAdmin/);
  for (const key of RETIRED_PAPIC_CAMERA_SALE_KEYS) {
    assert.ok(!new RegExp(`service_key:\\s*'${key}'`).test(src), `an order is minted under ${key} again`);
  }
  assert.equal(papicCameraSaleRefusedPath('E'), `/dashboard/E/studio/papic?papic_error=${PAPIC_CAMERA_SALE_REFUSED}`);
});

test('the refusal is spoken on the page, once, and historical camera money is untouched', () => {
  const page = stripComments(read(join(PAPIC, 'page.tsx')));
  assert.match(page, /papicError === PAPIC_CAMERA_SALE_REFUSED[\s\S]{0,200}PAPIC_CAMERA_SALE_REFUSED_WORDS/, 'the page no longer says why');
  // The activation hooks for orders already paid stay wired — retiring a door is not abandoning its orders.
  const activation = read(join(WEB, 'lib/sku-activation.ts'));
  assert.match(activation, /provisionPapicSeatsAdmin\(/, 'the PAPIC_SEATS activation hook is gone — paid orders would strand');
  // …and the page still keeps a paid Limited snapshot's cameras in step with RSVPs.
  assert.match(page, /syncGuestCameras\(/, 'a paid guest-camera snapshot no longer syncs');
});

test('🚨 the Papic page draws no seat count, no "in your pocket" card, and no per-seat cards', () => {
  const page = stripComments(read(join(PAPIC, 'page.tsx')));
  assert.doesNotMatch(page, /still in your pocket|claimLinkUnclaimed|claimLinkTotal|extraCameraCount/, 'a seat count is back on the page');
  assert.doesNotMatch(page, /label="Crew cameras"|label="Your uploads"/, 'a retired way-in row is back');
  const crew = stripComments(read(join(PAPIC, 'crew/page.tsx')));
  assert.doesNotMatch(crew, /fetchPapicSeats|reissuePapicSeat|provisionPapicSeats|Free camera/, 'the per-seat cards are back on /crew');
  assert.match(crew, /One code for everyone/, '/crew no longer shows the one shared code');
  const print = stripComments(read(join(PAPIC, 'crew/print/page.tsx')));
  assert.match(print, /redirect\(`\/dashboard\/\$\{eventId\}\/studio\/papic\/crew\/poster`\)/, 'the per-seat print pack is back');
});

// (The library strip's render test went with `papic-stage.tsx`, deleted 2026-10-24 — unmounted once the library moved
// to Memories, whose count line names no seat either.)

test('one door to the uploader — Memories’ + Add photos, never a second entry', () => {
  // 🗂 2026-10-23 (owner, PR-B): the library is the event's Memories tab — "+ Add photos" in its thumb row is the one
  // upload door; the Papic page (the camera only) carries none.
  const papic = stripComments(read(join(PAPIC, 'page.tsx')));
  assert.doesNotMatch(papic, /<AddToLibrary\b|<AddPhotosDoor\b/, 'the Papic page opens an uploader again');
  const memories = stripComments(read(join(PAPIC, '..', '..', 'memories', 'page.tsx')));
  assert.equal((memories.match(/<AddToLibrary\b/g) ?? []).length, 1, 'the uploader is built once, not per door');
  const grid = stripComments(read(join(PAPIC, '..', '..', '..', '..', '_components', 'memories', 'event-memories-gallery.tsx')));
  assert.equal((grid.match(/label: 'Add photos'/g) ?? []).length, 1, 'Memories carries exactly one Add photos door');
});

test('the Suppliers row says the reason it READ, and a failed read is never "not open"', () => {
  assert.equal(supplierWayInLabel(supplierWayInState({ laneOn: null, booked: 3, over: false })), 'Couldn’t check');
  assert.equal(supplierWayInLabel(supplierWayInState({ laneOn: true, booked: null, over: false })), 'Couldn’t check');
  assert.equal(supplierWayInLabel(supplierWayInState({ laneOn: true, booked: 0, over: null })), 'Couldn’t check');
  assert.equal(supplierWayInLabel(supplierWayInState({ laneOn: false, booked: 3, over: false })), 'Waiting on privacy approval');
  assert.equal(supplierWayInLabel(supplierWayInState({ laneOn: true, booked: 0, over: false })), 'Book one to open');
  assert.equal(supplierWayInLabel(supplierWayInState({ laneOn: true, booked: 2, over: false })), '2 booked');
  assert.equal(supplierWayInLabel(supplierWayInState({ laneOn: true, booked: 2, over: true })), 'Closed after your day');
});

test('the per-guest row never shows a computed number as if the couple chose it', () => {
  const base = { pot: 12_850, guestCount: 40, named: [] as number[], sponsors: [] };
  const derived = splitTheRest({ ...base, everyoneElse: null });
  const shareEach = derived.perHead;
  assert.equal(allotmentRowValue({ enabled: false, split: derived, shareEach, everyoneElse: null }), 'Shared, no limit');
  assert.equal(allotmentRowValue({ enabled: true, split: derived, shareEach, everyoneElse: null }), `Up to ${shareEach} · equal share`);
  const typedLow = splitTheRest({ ...base, everyoneElse: 50 });
  assert.equal(allotmentRowValue({ enabled: true, split: typedLow, shareEach, everyoneElse: 50 }), 'Up to 50 · your limit');
  // A typed number ABOVE the share does not apply — the share does, and the row says so.
  const typedHigh = splitTheRest({ ...base, everyoneElse: 5_000 });
  assert.equal(allotmentRowValue({ enabled: true, split: typedHigh, shareEach, everyoneElse: 5_000 }), `Up to ${shareEach} · equal share`);
});

test('the challenges card names what fills the board — the parts add up to what guests see', () => {
  const rows = [
    ...[1, 2, 3].map((n) => ({ source: 'couple', board_slot: n })),
    { source: 'vendor', board_slot: 4 },
    { source: 'auto', board_slot: 5 },
    ...[6, 7, 8, 9, 10].map((n) => ({ source: 'setnayan', board_slot: n })),
    { source: 'couple', board_slot: null },
  ];
  const c = boardLaneCounts(rows);
  assert.deepEqual(c, { total: 10, yours: 3, suppliers: 2, suggested: 5 });
  assert.equal(c.yours + c.suppliers + c.suggested, c.total);
  assert.equal(boardShowingWords(c), 'Guests see 10: your 3 + 2 from suppliers + 5 suggested');
  assert.equal(boardShowingWords({ total: 3, yours: 3, suppliers: 0, suggested: 0 }), 'Guests see 3: your 3');
  const card = stripComments(read(join(PAPIC, 'couple-challenges-manager.tsx')));
  assert.doesNotMatch(card, /showing to guests/, 'the bare "N showing to guests" is back beside "N of M chosen"');
  assert.match(card, /boardShowingWords\(boardLaneCounts\(missions\)\)/);
});
