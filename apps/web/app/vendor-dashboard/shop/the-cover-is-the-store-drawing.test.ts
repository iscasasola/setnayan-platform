/**
 * GUARD — THE SHOP COVER IS THE STORE DRAWING (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_2026-11-23` v10,
 * F0 "Shop" + "Promote" + "Storage"). RE-AIMED from `the-quick-row-is-the-drawn-five` (19 Nov: Promote · QR · Prints ·
 * Gifts · Plan): the five tiles are gone; every door they opened is still reachable.
 *
 *   1. The Storage row: the plan's space, read honestly (`storageMeter` — an unread store is "Couldn’t load", never 0),
 *      and the plan chip that opens the storage sheet (`?sheet=storage`).
 *   2. ONE line of doors: the logo · View shop · Toolkit · Share · Promote (v19). No five-tile quick row.
 *   3. Promote is ONE sheet with two tabs — Posters & prints (the shipped Promote body: Prints · Gifts · Share your work)
 *      and QR codes (the shipped QR body). The old addresses (`?sheet=prints`, `?sheet=qr`) still land on it.
 *   4. The storage sheet: the plan, what is stored of its space, and the way up — never a typed photo limit or price.
 *   5. One door each: the photo is the cover's door, the logo the picker's.
 *
 * Sabotage: drop the plan chip (1 red) · put the quick row back (2 red) · drop the QR tab (3 red) · type "10 photos"
 * into the sheet (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { storageMeter } from '@/lib/supplier-store';

const COVER = stripComments(readFileSync(join(import.meta.dirname, '_components/shop-cover.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));

test('1 · the Storage row: the meter, honest when unread, and the plan chip opening the storage sheet', () => {
  assert.match(COVER, /function StorageRow[\s\S]*?data-shop-storage=\{m\.kind\}/);
  assert.match(COVER, /onClick=\{onOpen\}[\s\S]{0,200}data-shop-plan-chip=""/);
  assert.match(COVER, /<StorageRow storage=\{d\.storage\} plan=\{d\.planLabel\} label=\{d\.planLabel == null \? PLAN_UNREAD : `\$\{d\.planLabel\} plan`\} onOpen=\{\(\) => openSheet\('storage'\)\} \/>/);
  assert.match(COVER, /storage: \['sheet', 'storage'\]/);
  assert.match(PAGE, /meter: own \? storageMeter\(own\.tier_state \?\? null, stored\) : \{ kind: 'unread' \}/, 'an unread plan must not draw a meter');
  assert.deepEqual(storageMeter('pro', { status: 'unread' }), { kind: 'unread' });
  assert.equal(storageMeter('pro', null).kind, 'unread');
});

test('2 · one line of doors: the logo · View shop · Toolkit · Share · Promote — no quick row', () => {
  assert.doesNotMatch(COVER, /data-shop-quick-row/, 'the five-tile quick row is back');
  const one = COVER.slice(COVER.indexOf('data-shop-cover-line="one"'));
  const at = ['data-tour="shop-logo"', 'data-view-shop=""', 'data-shop-cover-icon="toolkit"', 'data-shop-cover-icon="share"', 'data-shop-cover-icon="promote"'].map((k) => one.indexOf(k));
  assert.ok(at.every((n) => n >= 0), 'line one lost the logo, View shop, Toolkit, Share or Promote');
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'line one is not logo · View shop · Toolkit · Share · Promote');
  assert.match(one, /href=\{routes\.vendorDashboard\.shop\.store\.index\(\)\} className=\{SHARE_PILL\} data-shop-cover-icon="toolkit"/, 'the Toolkit square is not the Toolkit door');
});

test('3 · Promote: one sheet, Posters & prints · My QRs, the old addresses still land', () => {
  assert.match(COVER, /label: 'Posters & prints'/);
  // The QR tab reads "My QRs" since My QRs replaced Promote's QR part (main 341aee5063).
  assert.match(COVER, /label: 'My QRs'/);
  assert.match(COVER, /\{promoteTab === 'qr' \? qrBody : promoteBody\}/);
  assert.match(COVER, /const promoteOpen = sheet === 'promote' \|\| sheet === 'prints' \|\| sheet === 'qr';/);
  assert.match(PAGE, /promoteBody=\{\s*<Suspense[\s\S]{0,80}?<PromoteBody search=\{qrSearch\} part="promote" \/>/);
  assert.match(PAGE, /qrBody=\{\s*<Suspense[\s\S]{0,80}?<PromoteBody search=\{qrSearch\} part="qr" \/>/);
  assert.doesNotMatch(PAGE, /printsBody=/, 'a third Promote sheet is back');
});

test('4 · the storage sheet: plan, used of total, the way up — no typed limit or price', () => {
  const body = COVER.slice(COVER.indexOf('function StorageBody'));
  assert.match(body, /href=\{STORAGE_UPGRADE_HREF\}/);
  assert.doesNotMatch(body, /\d+\s*(photos|GB|MB)|₱/, 'a number typed into the storage sheet');
});

test('5 · one door each: the photo is the cover door, the logo the picker', () => {
  assert.doesNotMatch(COVER, /data-shop-plan=/);
  assert.doesNotMatch(COVER, /data-shop-cover-edit=/);
  assert.match(COVER, /photoDoor=\{[\s\S]{0,200}<PortfolioUploadDoor facts=\{d\.uploadFacts\} coverPick/);
  assert.match(COVER, /<PhotoPickLabel[\s\S]{0,120}data="shop-logo"/);
});
