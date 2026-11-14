/**
 * the-papers-and-the-qr-hold.test.ts — 🧾📥🔦 A NEW SHOP'S STEPS 5 AND 6, AND THE TOUR AFTER THEM.
 *
 * Owner 7 Nov 2026 (build-sessions/PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07.md, Track C1–C3; prototype
 * `open-shop-redesign.html` v21 — "Send your documents", "Download your QR", the spotlight after step 6):
 *
 *   A · THE QR LEADS TO THE SHOP'S OWN PAGE, `/v/<slug>` (`myPageUrl`) — never the root `/<slug>`, which is a couple's
 *       Event Hub. Download is the one filled button; the file keeps the shipped name.
 *   B · THE PAPER ROWS ARE `REQUIRED_DOC_SLOT_KEYS` — never a hand list; each row's state is read off the latest
 *       application, and a refused read is said, never drawn as four empty rows. The upload is the shipped one.
 *   C · THE TOUR IS THE HOUSE SPOTLIGHT (`SpotlightMount` → dim + gliding ring), started by the download, once; its
 *       record is step 6's ✓.
 *
 * Sabotage (7 Nov 2026, each run and reverted — see the PR body): page.tsx's QR back to `buildVendorInviteUrl` ·
 * `setupPapers` filtering by a hand list · the folds mounting `MiniTour` instead of `SpotlightMount` — each RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

async function drawLab(docs: 'none' | 'some' | 'checking' | 'fix' | 'unread' = 'none'): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { TodayEasyLab, LAB_SHOP_QR_URL } = await import('@/app/dev/supplier-lab/today-easy-lab');
  const { renderUrlQrSvg } = await import('@/lib/qr');
  const { TOURS } = await import('@/lib/tours');
  const { SETUP_TOUR_KEY } = await import('@/lib/supplier-setup');
  const noop = async () => {};
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const qrSvg = await renderUrlQrSvg(LAB_SHOP_QR_URL, 220);
  return renderToStaticMarkup(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(TodayEasyLab, { sup: 'caterer', moment: 'setup', actions, docs, gbb: 2, qrSvg, tourScript: TOURS[SETUP_TOUR_KEY].spotlight ?? null }),
    ),
  );
}

const between = (html: string, from: string, to?: string) => {
  const i = html.indexOf(from);
  assert.ok(i >= 0, `${from} is not drawn`);
  const j = to ? html.indexOf(to, i + from.length) : -1;
  return html.slice(i, j > i ? j : undefined);
};

// ── A · the QR ────────────────────────────────────────────────────────────────────────────────────────────────────

test('A1 · Today’s QR is the shop’s own page, /v/<slug> — never the root slug, never the shortlist invite', () => {
  const page = code('app/vendor-dashboard/page.tsx');
  // 💳 The step-6 QR is the supplier's OWN code — the same page, tagged ?src=own (owner 2026-11-13, F-W1-58).
  assert.match(page, /const qrUrl = details\.slug \? ownPageUrl\(siteOrigin\(\), details\.slug\) : null;/, 'the step-6 QR is not built by ownPageUrl');
  assert.doesNotMatch(page, /buildVendorInviteUrl/, 'Today’s QR went back to the shortlist invite');
  assert.doesNotMatch(page, /siteOrigin\(\)\}\/\$\{[^}]*slug/, 'a root /<slug> address (a couple Event Hub) is built on Today');
  const { myPageUrl } = require('@/lib/supplier-qr-codes') as typeof import('@/lib/supplier-qr-codes');
  assert.equal(myPageUrl('https://www.setnayan.com', 'titanena'), 'https://www.setnayan.com/v/titanena');
});

test('A2 · drawn: the code, where it leads (/v/), "put it on your photos", Download filled — the shipped file name', async () => {
  const html = await drawLab();
  const qr = between(html, 'data-setup-body="qr"');
  assert.match(qr, /data-qr-card="setup-shop"/);
  assert.match(qr, /<svg/, 'step 6 draws no code');
  const words = text(qr);
  assert.match(words, /Scanning it opens your page — www\.setnayan\.com\/v\/titanena/);
  assert.doesNotMatch(words, /setnayan\.com\/titanena\b/, 'the QR line names the root slug');
  assert.match(words, /Put it on your photos, posts and cards so couples find you\./);
  // Download is the filled (main) button; Share is not. The order stays Share · Copy link · Download (owner 2026-11-06).
  const dl = qr.match(/<a[^>]*data-qr-download=""[^>]*>/)?.[0] ?? '';
  assert.match(dl, /download="setnayan-shop-qr\.svg"/, 'the QR file was renamed');
  assert.match(dl, /ab-main/, 'Download is not the filled button on step 6');
  assert.doesNotMatch(qr.match(/<button[^>]*data-qr-share=""[^>]*>/)?.[0] ?? '', /ab-main/, 'Share is still filled on step 6');
  assert.match(code('app/vendor-dashboard/_components/setup-qr-step.tsx'), /SETUP_QR_FILENAME = 'setnayan-shop-qr\.svg'/);
  // The days-off row stays under it (a door kept).
  assert.match(qr, /data-form-row="setup-days-off"/);
});

// ── B · the papers ────────────────────────────────────────────────────────────────────────────────────────────────

test('B1 · one row per REQUIRED_DOC_SLOT_KEYS, in DOC_SLOTS order — never a hand list', async () => {
  const { setupPapers } = await import('@/lib/setup-papers');
  const { DOC_SLOTS, REQUIRED_DOC_SLOT_KEYS } = await import('@/lib/vendor-verification');
  const rows = setupPapers({ measured: true, status: null, uploads: {} })!;
  assert.deepEqual(rows.map((r) => r.key), DOC_SLOTS.filter((s) => REQUIRED_DOC_SLOT_KEYS.has(s.key)).map((s) => s.key));
  assert.equal(rows.length, REQUIRED_DOC_SLOT_KEYS.size);
  assert.deepEqual(rows.map((r) => r.n), rows.map((_, i) => i + 1));
  const src = code('lib/setup-papers.ts');
  assert.match(src, /DOC_SLOTS\.filter\(\(s\) => REQUIRED_DOC_SLOT_KEYS\.has\(s\.key\)\)/, 'the rows are not read off REQUIRED_DOC_SLOT_KEYS');
  for (const k of REQUIRED_DOC_SLOT_KEYS) assert.doesNotMatch(src, new RegExp(`'${k}'`), `lib/setup-papers.ts hand-lists ${k}`);
  // Drawn: four rows, keyed by the slots.
  const html = await drawLab();
  const docs = between(html, 'data-setup-body="docs"', 'data-setup-body="qr"');
  assert.deepEqual([...docs.matchAll(/data-setup-paper="([a-z_0-9]+)"/g)].map((m) => m[1]), [...REQUIRED_DOC_SLOT_KEYS]);
});

test('B2 · each row’s state is read off the latest application — none · uploaded · review · approved · new copy', async () => {
  const { setupPapers } = await import('@/lib/setup-papers');
  const one = { dti_certificate: { r2_key: 'vendors/x/verification/dti_certificate/a.pdf' } };
  const st = (status: string | null) => setupPapers({ measured: true, status, uploads: one })!.map((r) => r.state);
  assert.deepEqual(st(null), ['none', 'none', 'none', 'none']);
  assert.deepEqual(st('draft'), ['uploaded', 'none', 'none', 'none']);
  assert.deepEqual(st('pending_review'), ['review', 'none', 'none', 'none']);
  assert.deepEqual(st('in_review'), ['review', 'none', 'none', 'none']);
  assert.deepEqual(st('approved'), ['approved', 'none', 'none', 'none']);
  // Sent back: the next upload starts a fresh draft with nothing in it — every paper needs a new copy.
  assert.deepEqual(st('rejected'), ['new_copy', 'new_copy', 'new_copy', 'new_copy']);
  assert.deepEqual(st('withdrawn'), ['none', 'none', 'none', 'none']);
  // Only a draft's paper can be replaced in place; in review or approved nothing can be.
  assert.equal(setupPapers({ measured: true, status: 'draft', uploads: one })![0]!.ref, one.dti_certificate.r2_key);
  assert.ok(setupPapers({ measured: true, status: 'pending_review', uploads: one })!.every((r) => !r.editable));
  // Drawn: "some" = one uploaded in a draft; "checking" = four under review; "fix" = the reason, said once.
  const some = between(await drawLab('some'), 'data-setup-body="docs"', 'data-setup-body="qr"');
  assert.match(some, /data-setup-paper="dti_certificate" data-paper-state="uploaded"/);
  // The row with a file: its thumbnail, "✓ Saved · <the file's own name>" (the shipped `filenameFromRef`), opens in place.
  assert.match(some, /data-setup-paper-thumb="image"/);
  assert.match(text(some), /Saved · dti-certificate\.jpg/);
  assert.equal((some.match(/data-setup-paper-open/g) ?? []).length, 1);
  // No state pill: the line says it. The three without a file are one tap — Add, nothing to open first.
  assert.doesNotMatch(text(some), /Not sent yet/);
  assert.equal((some.match(/data-testid="setup-paper-add"/g) ?? []).length, 3);
  assert.match(text(some), /Required · 2 of 4 · PDF \/ JPG \/ PNG up to 15 MB/);
  const checking = between(await drawLab('checking'), 'data-setup-body="docs"', 'data-setup-body="qr"');
  assert.equal((checking.match(/data-paper-state="review"/g) ?? []).length, 4);
  assert.doesNotMatch(checking, /data-setup-paper-open|setup-paper-add/, 'a paper under review can still be replaced');
  assert.equal((text(checking).match(/Under review · Setnayan checks it/g) ?? []).length, 4);
  const fix = between(await drawLab('fix'), 'data-setup-body="docs"', 'data-setup-body="qr"');
  assert.equal((fix.match(/data-paper-state="new_copy"/g) ?? []).length, 4);
  assert.equal((fix.match(/data-testid="setup-paper-add"/g) ?? []).length, 4);
  assert.equal((text(fix).match(/Needs a new copy/g) ?? []).length, 4);
  assert.match(text(fix), /Setnayan sent them back: The BIR 2303 photo is cut off at the bottom/);
});

test('B3 · a refused read is said — never four empty rows', async () => {
  const { setupPapers } = await import('@/lib/setup-papers');
  assert.equal(setupPapers({ measured: false, status: null, uploads: null }), null);
  const docs = between(await drawLab('unread'), 'data-setup-body="docs"', 'data-setup-body="qr"');
  assert.match(docs, /data-could-not-load/, 'a refused papers read is not said');
  assert.doesNotMatch(docs, /data-paper-state="none"/, 'a refused read is drawn as "Not sent yet"');
  // The page's read carries its measured flag into the rows.
  assert.match(code('app/vendor-dashboard/profile/details-data.ts'), /papers: setupPapers\(\{ measured: verifyMeasured,/);
});

test('B4 · the upload is the shipped one — the same bucket, folder and save as Your details; saves one at a time', () => {
  const c = code('app/vendor-dashboard/_components/setup-papers.tsx');
  assert.match(c, /import \{ loadInlineDocs, updateDocUploadInline \} from '\.\.\/shop\/inline-docs-actions';/);
  assert.match(c, /bucket="vendor-verification"/);
  // ONE TAP: Add / Replace press the shipped upload's own picker (drawn only as the pill, `studio-prints-six.tsx` `pick`).
  assert.match(c, /querySelector<HTMLInputElement>\('\[data-setup-paper-upload\] input\[type="file"\]'\)\?\.click\(\)/);
  assert.match(c, /label="Add" onClick=\{pick\}|label="Add"\s+onClick=\{pick\}/);
  assert.match(c, /tone="danger" icon=\{<Trash2 [^\n]*?\/>\} label="Remove"/);
  assert.match(c, /pathPrefix=\{`vendors\/\$\{vendorProfileId\}\/verification\/\$\{p\.key\}`\}/);
  assert.match(c, /const run = queue\.then\(\(\) => updateDocUploadInline\(null, fd\)\);/, 'two first saves can race to make two drafts');
  // The shipped papers' upload moved to the one upload place (design v10, 2026-11-14) — same bucket and folder.
  const shipped = code('app/vendor-dashboard/shop/_components/paper-upload-place.tsx');
  assert.match(shipped, /bucket="vendor-verification"/, 'the shipped papers moved bucket — move this with them');
  // No founding-supplier deadline line: there is no ruling for it.
  assert.doesNotMatch(c, /Founding|31 Jan 2027/);
});

// ── C · the tour ──────────────────────────────────────────────────────────────────────────────────────────────────

test('C1 · the tour after step 6 is the HOUSE spotlight — SpotlightMount, never a centred card or a carousel', async () => {
  const folds = code('app/vendor-dashboard/_components/supplier-setup-folds.tsx');
  assert.match(folds, /import \{ SpotlightMount \} from '@\/app\/_components\/spotlight-mount';/);
  assert.match(folds, /<SpotlightMount tourKey=\{SETUP_TOUR_KEY\}/, 'the setup tour is not mounted through the shared spotlight');
  assert.doesNotMatch(folds, /MiniTour|GuidedTourCard|GuidedTour\b/, 'the setup tour is drawn as a carousel / centred card');
  const { TOURS } = await import('@/lib/tours');
  const { SETUP_TOUR_KEY } = await import('@/lib/supplier-setup');
  const t = TOURS[SETUP_TOUR_KEY];
  assert.equal(t.slides.length, 0, 'the setup tour carries carousel slides');
  assert.deepEqual(
    t.spotlight?.steps.map((s) => [s.anchor, s.title]),
    [
      ['today-setup', 'Get your shop live'],
      ['today-coming-up', 'Coming up'],
      ['today-shop', 'Your shop'],
      ['supplier-messages', 'Messages'],
      ['tab-vendor-dashboard', 'The menu'],
    ],
    'the stops are not the prototype’s, in order',
  );
  // The first stop is drawn on the setup section itself.
  assert.match(folds, /data-tour="today-setup"/);
});

test('C2 · the download starts it, once — and its record is step 6’s ✓ (a refused read: neither)', async () => {
  assert.match(code('app/vendor-dashboard/_components/setup-qr-step.tsx'), /onDownloaded=\{tour\?\.qrSaved\}/, 'the download does not start the tour');
  assert.match(code('app/_components/save-file-link.tsx'), /if \(state\.k !== 'saved' \|\| said\.current === state\) return;/, 'the tour could start on a tap that saved nothing');
  const folds = code('app/vendor-dashboard/_components/supplier-setup-folds.tsx');
  assert.match(folds, /const canTour = tour != null && tour\.seen === false;/, 'the tour runs again, or on a refused read');
  const { assembleSetup } = await import('@/lib/supplier-setup');
  const { buildFirstStepsRail } = await import('@/lib/vendor-first-steps');
  const rail = buildFirstStepsRail({
    verified: false, profileDone: 2, profileTotal: 6, hasLogo: false, serviceCount: 0, docsStatus: 'none', docsIn: 0, docsTotal: 4,
    submitMissing: [], customerCount: 0, notAvailableCount: 3, offer: null,
  });
  const qr = (qrSaved: boolean | null) =>
    assembleSetup({ checklist: [], rail, offer: null, docs: { status: null, docsIn: 0, docsTotal: 4 }, shopName: null, qrSaved }).folds.find((f) => f.key === 'qr')!;
  assert.equal(qr(true).done, true);
  assert.equal(qr(false).done, false, 'days off marked ticks "Download your QR"');
  assert.equal(qr(null).done, false);
  assert.equal(qr(null).badge?.word, 'Couldn’t load');
  assert.match(code('app/vendor-dashboard/page.tsx'), /readTourSeen\(supabase, user\.id, SETUP_TOUR_KEY\)/);
  const seen = code('lib/tour-seen.server.ts');
  assert.match(seen, /if \(error\) \{\s*logQueryError\([^;]*\);\s*return null;\s*\}/, 'a refused tour read reads as "not yet"');
  assert.doesNotMatch(seen, /\?\? false|return false/, 'a refused tour read reads as "not yet"');
});
