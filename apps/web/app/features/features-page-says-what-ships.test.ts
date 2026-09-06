import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * `/features` MAY ONLY PROMISE WHAT THE APP DOES.
 *
 * 🔴 THE SWEEP THIS GUARD IS MADE OF (2026-09-06). `/features` is twelve
 * section files of hand-written bilingual copy, and nothing had ever checked it
 * against the code. Three false claims were found in `_PlanningToolkit.tsx` and
 * fixed; the same vocabulary then turned up in two more sections, and both were
 * false there too:
 *
 *   · "a single .ics feed your phone subscribes to · updates push live; you
 *     don't re-import · family members get their own subscribable feed" —
 *     there is no feed. `/api/budget/[eventId]/ics` sends
 *     `Content-Disposition: attachment` behind `supabase.auth.getUser()`, so a
 *     phone cannot subscribe to it (it cannot authenticate) and nothing pushes.
 *     It carries vendor payment due dates and nothing else — no RSVP cutoffs,
 *     no fittings, no tastings, no run-of-show.
 *
 *   · "OCR-scans the signed page, and surfaces the key fields (deposit amount,
 *     balance due date, deliverables list) into the ledger automatically" —
 *     there is no OCR anywhere in the tree, `payment-receipt-read.server.ts`
 *     says refusing it was deliberate, and the AI-analysis SKU that would have
 *     done this (Contract Intelligence, iteration 0032) was RETIRED on
 *     2026-05-18 by `20260518200000_vendor_contracts_dual_esign_retire_0032`.
 *
 *   · "Drop the PDF the vendor sent you" — the couple cannot upload one. Their
 *     own contracts page reads: "Vendors will upload PDFs here once you agree
 *     on terms in chat."
 *
 * 🔑 THE SHAPE OF THE MISTAKE, NOT THE WORDS. Every one of these described a
 * PLAUSIBLE version of a feature that really exists — there IS calendar export,
 * there ARE contracts — enriched with the automation a reader would want. That
 * is what makes marketing copy rot invisibly: it is never nonsense, it is
 * always the next version of the truth, and only somebody holding the code can
 * tell the two apart.
 *
 * ── WHAT THIS GUARD CAN AND CANNOT DO ───────────────────────────────────────
 * It cannot read English. It bans the specific PHRASES that were false, in both
 * languages, so the exact claims cannot come back — and pairs each with the
 * shipped fact that makes it false, so a future session that genuinely builds
 * the feature knows precisely what to change here and why. Ban a phrase only
 * with such a reason attached; a banned word with no reason is a guard nobody
 * can retire honestly.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SECTIONS = join(HERE, '_sections');

/** Each: the phrase, and the shipped fact that makes it a lie today. */
const BANNED: ReadonlyArray<{ phrase: RegExp; why: string }> = [
  {
    phrase: /subscribable feed|feed your phone subscribes to|phone subscribes|Subscribe to the \.ics feed|sina-subscribe ng phone|I-subscribe ang \.ics/i,
    why:
      'There is no subscribable calendar feed. `/api/budget/[eventId]/ics` returns ' +
      '`Content-Disposition: attachment` behind `supabase.auth.getUser()` — a phone ' +
      'calendar cannot authenticate, so it cannot subscribe. Say "download and import", ' +
      'or build a signed unauthenticated feed URL first and then rewrite this.',
  },
  {
    phrase: /updates push live|don’t re-import|don't re-import|hindi mo na kailangang mag-re-import|laging updated/i,
    why:
      'Nothing pushes. The .ics routes render a file per request; a downloaded file is a ' +
      'snapshot and the reader must re-export to see a change. Promising live updates ' +
      'is the one thing a download provably cannot do.',
  },
  {
    phrase: /OCR/,
    why:
      'There is no OCR in this codebase. `lib/payment-receipt-read.server.ts` records that ' +
      'refusing it was a cost decision, and Contract Intelligence (iteration 0032), the SKU ' +
      'that would have read contracts, was retired 2026-05-18 by migration ' +
      '20260518200000_vendor_contracts_dual_esign_retire_0032.',
  },
  {
    phrase: /Drop the PDF the vendor sent you|I-drop ang PDF na pinadala/i,
    why:
      'The couple cannot upload a contract. `app/dashboard/[eventId]/contracts/page.tsx` ' +
      'says so in its own empty state: "Vendors will upload PDFs here once you agree on ' +
      'terms in chat." The vendor uploads; both parties sign in-browser.',
  },
  /* ── ADDED 2026-09-06, the sweep that finished the audit ──────────────────
     The first pass fixed the sections carrying the .ics/OCR vocabulary and
     stopped there. Finishing the remaining eight files found four more, none
     of which shared a single word with the first three — which is the argument
     against ever calling a copy audit done at the first clean grep. */
  {
    phrase: /three aspect ratios|tatlong aspect ratio/i,
    why:
      'The invite renders at ONE size. `app/api/website/qr/guest/[guestId]/route.ts` ' +
      'emits a single 1024x1024 PNG; there is no story/feed/print variant set anywhere ' +
      'in the tree. The print sheet at /dashboard/[eventId]/invitation/print is real and ' +
      'may be claimed — a second and third aspect ratio may not.',
  },
  {
    phrase: /delivery preferences \(per channel, per category\)|Per-event delivery preferences/i,
    why:
      'There is no notification-preference table and no surface that edits one. Which ' +
      'channel a notice takes is a HARDCODED per-notice-type allowlist in ' +
      '`lib/notifications.ts` ("ON the email allowlist" / "NOT on the push allowlist"), ' +
      'chosen by us and not by the couple. Build a preferences table and a UI before ' +
      'this sentence goes back.',
  },
  {
    phrase: /arrives in your gallery the next morning|Dumarating ang compilation sa gallery mo kinabukasan/i,
    why:
      'Nothing runs overnight. `vercel.json` ships `"crons": []`, the render happens in ' +
      "the guest's browser (WebCodecs/MediaRecorder) and is closed out by " +
      '`finalizePatiktokRenderJob` the moment it completes — the stub queue-drainer that ' +
      'would have batched it was DELETED, and `patiktok-render-completion-writer.test.ts` ' +
      'exists to keep it deleted. A morning-after promise implies a schedule we removed ' +
      'on purpose.',
  },
  {
    phrase: /receipts download together|sabay-sabay na nada-download/i,
    why:
      'There is no combined download and no receipts index. `lib/routes.ts` exposes only ' +
      '`receipts.detail(receiptId)`; each receipt is its own printable page at ' +
      '/receipts/[receiptId], reached from its order. "Together" promises a bundle that ' +
      'does not exist.',
  },
];

function sectionFiles(): string[] {
  return readdirSync(SECTIONS).filter((f) => f.endsWith('.tsx'));
}

test('the sections exist — the guard cannot silently scan an empty directory', () => {
  const files = sectionFiles();
  assert.ok(
    files.length >= 10,
    `Only ${files.length} section files found under ${SECTIONS}. A guard pointed at the ` +
      'wrong directory reads nothing and passes forever.',
  );
});

test('/features makes no claim the app cannot keep', () => {
  /*
    EVERY VIOLATION IS COLLECTED, NEVER JUST THE FIRST.

    🔴 This test used to assert inside the loop, so the first bad phrase threw
    and the rest of the page went unread. Caught by its own mutation check on
    2026-09-06: four known-false claims were restored and the run reported
    exactly ONE of them — the other three were invisible, in a guard whose whole
    job is finding claims nobody has looked at. A checker that stops at the
    first problem hides the others, which is the same defect this file exists to
    catch in the copy.
  */
  const found: string[] = [];
  for (const file of sectionFiles()) {
    /*
      Comments are stripped FIRST — this file's own docblock quotes every banned
      phrase to explain it, and the sections now carry correction notes that do
      the same. A scan that reads prose finds the thing it bans in the sentence
      saying it is gone.
    */
    const src = stripComments(readFileSync(join(SECTIONS, file), 'utf8'));
    for (const { phrase, why } of BANNED) {
      const hit = phrase.exec(src);
      if (hit) found.push(`${file} claims "${hit[0]}" — and the app does not do it.\n    ${why}`);
    }
  }
  assert.deepEqual(
    found,
    [],
    `/features makes ${found.length} claim(s) the app cannot keep:\n\n` +
      found.map((f, i) => `  ${i + 1}. ${f}`).join('\n\n') +
      '\n\nIf you have genuinely SHIPPED one of these, delete its entry from BANNED in ' +
      'this file and say in the same commit what now makes it true. Do not weaken a ' +
      'pattern to get green.',
  );
});
