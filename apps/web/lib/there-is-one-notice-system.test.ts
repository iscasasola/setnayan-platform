/**
 * 🔔 THERE IS ONE NOTICE SYSTEM — the guard (owner approved 14 Nov 2026, DECISION_LOG "one notice system approved";
 * corpus `prototypes/notices_system_2026-11-14_fable.html`).
 *
 * Before it, the app had 46 added notices in ~9 looks remembering "I closed this" in 13 hand-written stores. Every one
 * now renders through `app/_components/notices/` (`<Notice>` + `<NoticeSlot>`, or `InlineNotice` where the prototype
 * keeps a notice in place) and every close is kept by ONE memory (`lib/notice-memory.ts` → `notice_closes`).
 *
 * What fails here:
 *   1 · a NEW dismiss store — a `localStorage` / `sessionStorage` write whose key reads like a close ("dismissed",
 *       "seen", "nudge", "banner", "asked", "later", "snooze", "hide") in a file not listed below. Use the notice memory.
 *   2 · a NEW hand-drawn close — a button whose words are a notice's close ("Got it", "Not now", "Maybe later",
 *       "Dismiss") in a file not listed below. Register a `<Notice>`; the kind supplies the close word.
 *   3 · a listed file that no longer does it (a stale line hides nothing and should go).
 *   4 · a notice of the inventory that stopped rendering through the system.
 *
 * The lists are the measured state of `main` when this landed, each with its reason. They may only SHRINK.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const ROOTS = ['app', 'lib', 'components'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = ROOTS.flatMap((r) => walk(join(WEB, r))).map((p) => ({ rel: relative(WEB, p), src: stripComments(readFileSync(p, 'utf8')) }));

/** The notice system's own files — they ARE the one store and the one look. */
const SYSTEM = new Set([
  'app/_components/notices/notices.tsx',
  'app/_components/notices/notice-store.ts',
  'app/_components/notices/inline-notice.tsx',
  'app/_components/notices/inline-notice-lazy.tsx',
  'lib/notice-memory.ts',
  'lib/notices.ts',
]);

// ── 1 · dismiss stores ───────────────────────────────────────────────────────

const CLOSE_KEY = /dismiss|seen|nudge|banner|asked|later|snooze|hide|skip/i;

/**
 * Every web-storage WRITE in a file, as the call's own text plus the key it resolves to through a same-file const or
 * key-builder (`const K = '…'`, `const k = (id) => \`…\``, `function k(…) { return \`…\` }`), when it can be resolved.
 */
function writes(src: string): string[] {
  const out: string[] = [];
  const re = /\b(?:[\w$]+\.)*setItem\(\s*([^,]+),([^\n;]*)/g;
  for (const m of src.matchAll(re)) {
    const arg = m[1]!.trim();
    let key = arg;
    const ident = /^([A-Za-z_$][\w$]*)/.exec(arg)?.[1];
    if (ident) {
      const def =
        new RegExp(`(?:const|let)\\s+${ident}\\b[^=]*=\\s*(?:\\([^)]*\\)\\s*(?::[^=]*)?=>\\s*)?['"\`]([^'"\`]*)`).exec(src) ??
        new RegExp(`function\\s+${ident}\\b[\\s\\S]{0,400}?return\\s+['"\`]([^'"\`]*)`).exec(src);
      if (def) key = `${ident} = ${def[1]}`;
    }
    out.push(`${key} ⟵ ${m[2]!.trim().slice(0, 40)}`);
  }
  return out;
}

/**
 * Files that write a close-shaped key today, and why each is not a notice. A NOTICE's close never belongs here — it is
 * the notice memory's. (Measured 14 Nov 2026 on the one-notice-system branch.)
 */
const STORES_THAT_ARE_NOT_NOTICES: Record<string, string> = {
  'app/vendor-dashboard/_components/badge-earned-line.tsx':
    'the badge line\'s "which rungs were announced" list, written on Got it beside the notice memory (foundation PR) — it decides WHICH rung is news, not whether the line is closed',
  'app/dashboard/[eventId]/_components/home-parts.tsx': 'Home Today\'s "Later" fold — a list control the couple moves rows into, not a notice',
  'app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx': 'the budget coach\'s first-use hint inside the accordion — a field explanation, not a notice',
  'app/dashboard/[eventId]/vendors/_components/booked-where.tsx': '"Where was it?" skipped for this visit — an answer to a question on a booking row',
  'app/[slug]/_components/ticket-popup.tsx': 'the guest\'s ticket shown once per guest (lib/guest-landing.ts) — the ticket itself, not a notice about it',
  'app/[slug]/_components/hub-seen-beacon.tsx': '"who\'s here" presence — the guest was seen on the hub, not a close',
  'app/_components/guest-spotlight.tsx': 'a spotlight tour\'s "seen" — tours are not notices (prototype §1)',
  'app/_components/guest-guided-tour.tsx': 'a guided tour\'s "seen" — tours are not notices (prototype §1)',
  'lib/spotlight-later.ts': 'a spotlight tour\'s "later" for this visit — tours are not notices (prototype §1)',
  'lib/reveal-once-per-visit.ts': 'the cinematic reveal played once per visit — the reveal, not a notice',
  'app/dashboard/[eventId]/_components/set-date-nudge.tsx': 'Home #12, kept as shipped (controller 14 Nov: Home shows no notices on its first screen, owner\'s choice) — its own close stays until Home is ruled on',
  'app/dashboard/[eventId]/_components/papic-ready-nudge.tsx': 'Home #13, kept as shipped (same ruling as #12)',
  'lib/last-seen/store.ts': 'the "last-seen data" cache (DECISION_LOG 2026-10-02) — page data kept for an instant first paint, not a close',
};

test('1 · no new dismiss store — a notice\'s close is kept by the one notice memory', () => {
  const found = new Map<string, string[]>();
  for (const f of FILES) {
    if (SYSTEM.has(f.rel)) continue;
    const keys = writes(f.src).filter((k) => CLOSE_KEY.test(k));
    if (keys.length) found.set(f.rel, keys);
  }
  // Anti-vacuity: the parser sees the stores it is meant to see.
  assert.ok(found.has('app/dashboard/[eventId]/_components/home-parts.tsx'), 'the key parser no longer finds a known store — it would pass everything');
  const fresh = [...found].filter(([rel]) => !(rel in STORES_THAT_ARE_NOT_NOTICES)).map(([rel, k]) => `${rel}  →  ${k.join(', ')}`);
  assert.deepEqual(
    fresh,
    [],
    `A new hand-written dismiss store. A notice's "Got it" / "Not now" / "Hide" is kept by the ONE notice memory (lib/notice-memory.ts) — register a <Notice> (app/_components/notices/notices.tsx) and let it close itself. If this is truly not a notice, add the file to STORES_THAT_ARE_NOT_NOTICES with the reason:\n  ${fresh.join('\n  ')}`,
  );
  const stale = Object.keys(STORES_THAT_ARE_NOT_NOTICES).filter((rel) => !found.has(rel));
  assert.deepEqual(stale, [], `listed as a store but no longer writes one — drop the line:\n  ${stale.join('\n  ')}`);
});

// ── 2 · hand-drawn close words ──────────────────────────────────────────────

/** A close word as the visible text of a button-like element (JSX text, or a `label=` string). */
const CLOSE_TEXT = />\s*(?:Got it|Not now|Maybe later|Dismiss)\s*</g;
const CLOSE_LABEL = /\blabel=(?:"|\{['"`])(?:Got it|Not now|Maybe later|Dismiss)\b/g;
const CLOSE_ARIA = /aria-label=(?:"|\{['"`])Dismiss\b/g;

function closeWordsIn(src: string): number {
  return (src.match(CLOSE_TEXT) ?? []).length + (src.match(CLOSE_LABEL) ?? []).length + (src.match(CLOSE_ARIA) ?? []).length;
}

/**
 * Files that draw a close word today and are not notices — each a choice the person makes inside a flow (a sheet's
 * second button, a step of a form), which the prototype leaves alone. A NOTICE never belongs here. The number is how
 * many it draws; it may only go DOWN.
 */
const SHEET = 'the second button of a sheet or dialog the person opened (Cancel-like), not a notice';
const FLOW = 'a choice inside a step or form the person is working in (skip this, not now for this one), not a notice';
const ADMIN = 'an admin queue action ("Dismiss" a report or a flag) — a decision on a record, not a notice';
const TOAST = 'the toast\'s own close — a toast is the answer to something the person just did, not a notice';
const TOUR = 'a tour step or an explainer — tours are not notices (prototype §1)';
/* Measured 14 Nov 2026 when the one notice system landed, classed by where each sits (path), not read one by one —
   each class is a kind of thing the prototype does not count as an added notice. */
const HOME = 'Home #12/#13 kept as shipped (controller 14 Nov: Home shows no notices on its first screen, owner\'s choice)';
const CLOSE_WORDS_THAT_ARE_NOT_NOTICES: Record<string, { n: number; why: string }> = {
  'app/dashboard/[eventId]/_components/set-date-nudge.tsx': { n: 2, why: HOME },
  'app/dashboard/[eventId]/_components/papic-ready-nudge.tsx': { n: 2, why: HOME },
  'app/[slug]/_components/copy-my-link.tsx': { n: 1, why: FLOW },
  'app/[slug]/_components/selfie-capture.tsx': { n: 2, why: FLOW },
  'app/[slug]/_components/use-on-profile.tsx': { n: 1, why: FLOW },
  'app/[slug]/pabuya/_components/gift-record-sheet.tsx': { n: 1, why: SHEET },
  'app/_components/chat/blocker-ask-row.tsx': { n: 1, why: FLOW },
  'app/_components/chat/cards/offer-card.tsx': { n: 1, why: FLOW },
  'app/_components/explain-open.tsx': { n: 1, why: TOUR },
  'app/_components/guided-tour-card.tsx': { n: 1, why: TOUR },
  'app/_components/iap/apple-pro-screen.tsx': { n: 1, why: SHEET },
  'app/_components/iap/iap-live-watch-sheet.tsx': { n: 1, why: SHEET },
  'app/_components/iap/iap-unlock-sheet.tsx': { n: 1, why: SHEET },
  'app/_components/memories/memories-photo-viewer.tsx': { n: 1, why: SHEET },
  'app/_components/proposal-maker.tsx': { n: 1, why: FLOW },
  'app/_components/toast/toast-provider.tsx': { n: 2, why: TOAST },
  'app/_components/top-up-settle-sheet.tsx': { n: 1, why: SHEET },
  'app/admin/categories/_components/what-couples-choose.tsx': { n: 2, why: ADMIN },
  'app/admin/chat-flags/page.tsx': { n: 1, why: ADMIN },
  'app/admin/integrity-watch/page.tsx': { n: 1, why: ADMIN },
  'app/admin/moodboard-library/_components/library-editor.tsx': { n: 3, why: ADMIN },
  'app/admin/repost-watch/page.tsx': { n: 1, why: ADMIN },
  'app/admin/ugat/_components/ugat-console.tsx': { n: 2, why: ADMIN },
  'app/admin/user-reports/page.tsx': { n: 1, why: ADMIN },
  'app/dashboard/(account)/life-flash/_components/story-people.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/guests/_components/not-counted-result.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/guests/_components/overlay-primitives.tsx': { n: 1, why: SHEET },
  'app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/launch/_components/details-date-clash.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx': { n: 2, why: FLOW },
  'app/dashboard/[eventId]/monogram/draft-restore.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/schedule/_components/announce-button.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/schedule/_components/ask-supplier-section.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/schedule/_components/chapter-sheets.tsx': { n: 2, why: SHEET },
  'app/dashboard/[eventId]/schedule/_components/moment-sheets.tsx': { n: 1, why: SHEET },
  'app/dashboard/[eventId]/seating/_components/seating-editor.tsx': { n: 6, why: FLOW },
  'app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx': { n: 2, why: FLOW },
  'app/dashboard/[eventId]/studio/mood-board/_components/theme-card.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/vendors/_components/booked-where.tsx': { n: 1, why: FLOW },
  'app/dashboard/[eventId]/vendors/_components/cancel-booking-button.tsx': { n: 2, why: FLOW },
  'app/dashboard/[eventId]/vendors/_components/pending-lock-proposals.tsx': { n: 2, why: FLOW },
  'app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx': { n: 2, why: FLOW },
  'app/dashboard/[eventId]/website/our-story/_components/moment-sheet-studio.tsx': { n: 2, why: SHEET },
  'app/dashboard/[eventId]/website/our-story/_components/moment-sheet.tsx': { n: 1, why: SHEET },
  'app/onboarding/_shared/services-step.tsx': { n: 1, why: FLOW },
  'app/papic/guest/_components/papic-guest-capture.tsx': { n: 2, why: FLOW },
  'app/v/[slug]/_components/service-details-sheet.tsx': { n: 2, why: SHEET },
  'app/vendor-dashboard/clients/[eventId]/_components/supplier-suggest-board.tsx': { n: 1, why: FLOW },
  'app/vendor-dashboard/clients/[eventId]/_components/top-up-carry-over.tsx': { n: 1, why: FLOW },
  'app/vendor-dashboard/clients/[eventId]/cocktail/cocktail-editor.tsx': { n: 2, why: FLOW },
  'app/vendor-dashboard/moodboard-library/_components/stylist-library-editor.tsx': { n: 6, why: FLOW },
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/stage-notes-card.tsx': { n: 1, why: FLOW },
  'app/vendor-dashboard/services/_components/canvas-maker.tsx': { n: 1, why: FLOW },
  'lib/tours.ts': { n: 1, why: TOUR },
};

test('2 · no new hand-drawn close — a notice gets its close word from its kind', () => {
  const found = new Map<string, number>();
  for (const f of FILES) {
    if (SYSTEM.has(f.rel)) continue;
    const n = closeWordsIn(f.src);
    if (n) found.set(f.rel, n);
  }
  const grown = [...found]
    .filter(([rel, n]) => n > (CLOSE_WORDS_THAT_ARE_NOT_NOTICES[rel]?.n ?? 0))
    .map(([rel, n]) => `${rel}  (${n}, listed ${CLOSE_WORDS_THAT_ARE_NOT_NOTICES[rel]?.n ?? 0})`);
  assert.deepEqual(
    grown,
    [],
    `A new hand-drawn "Got it" / "Not now" / "Maybe later" / "Dismiss". If it closes a notice, register a <Notice> — the kind adds the one close word. If it is a choice inside a flow (a sheet's second button), list the file in CLOSE_WORDS_THAT_ARE_NOT_NOTICES with its count and reason:\n  ${grown.join('\n  ')}`,
  );
  const stale = Object.entries(CLOSE_WORDS_THAT_ARE_NOT_NOTICES)
    .filter(([rel, { n }]) => (found.get(rel) ?? 0) < n)
    .map(([rel, { n }]) => `${rel}  (draws ${found.get(rel) ?? 0}, listed ${n})`);
  assert.deepEqual(stale, [], `a listed file draws fewer close words now — lower (or drop) its line:\n  ${stale.join('\n  ')}`);
});

// ── 3 · the inventory renders through the system ────────────────────────────

/**
 * Inventory row → the file that draws it. Tours (#5 #6 #30 #31 #40) are not notices. Home's #12 #13 #14 stay as shipped
 * (controller 14 Nov: the shipped Home shows no notices on its first screen, by the owner's choice). #10 has no notice
 * on main to move; #23 (the Sai Watch rail) is a card of many items, not a banner — both listed on the PR.
 */
const INVENTORY: Record<string, string> = {
  '#1 badge earned': 'app/vendor-dashboard/_components/badge-earned-line.tsx',
  '#2 supplier alerts ask': 'app/vendor-dashboard/_components/push-notification-registrar.tsx',
  '#3 supplier free-window deal': 'app/_components/promo-free-window-banner-vendor.tsx',
  '#4 payout missing': 'app/vendor-dashboard/_components/payout-method-nudge.tsx',
  '#7 website suggests': 'app/vendor-dashboard/shop/_components/suggested-coverage-card.tsx',
  '#8 get verified': 'app/vendor-dashboard/_components/get-verified-line.tsx',
  '#9 pick which stay on': 'app/vendor-dashboard/_components/stay-on-today-line.tsx',
  '#11 who can see this page': 'app/v/[slug]/_components/team-preview-banner.tsx',
  '#15 couple free-window deal': 'app/_components/promo-free-window-banner.tsx',
  '#16 event day mode': 'app/dashboard/[eventId]/_components/day-of-mode/banner.tsx',
  '#17 save the originals': 'app/dashboard/[eventId]/studio/papic/recap/_components/recap-drive-nudge.tsx',
  '#18 plan not saved': 'app/dashboard/_components/secure-account-banner.tsx',
  '#19 co-host welcome': 'app/dashboard/[eventId]/_components/cohost-welcome-notice.tsx',
  '#20 invited to an event': 'app/dashboard/(launcher)/_components/incoming-requests.tsx',
  '#21 guest replies alerts ask': 'app/dashboard/[eventId]/guests/_components/reply-push-ask.tsx',
  '#22 plan with peace of mind': 'app/_components/chat-privacy-notice.tsx',
  '#24 guests see this live': 'app/dashboard/[eventId]/seating/_components/day-of-editing-banner.tsx',
  '#25 date specialist': 'app/dashboard/[eventId]/date-selection/_components/chinese-specialist-nudge.tsx',
  '#26 Event Hub Pro (Maker)': 'app/dashboard/[eventId]/launch/_components/hub-pro-offer.tsx',
  '#27 Event Hub Pro (sheets)': 'app/dashboard/[eventId]/launch/_components/pro-quiet-line.tsx',
  '#28 Event Hub Pro (Our Story)': 'app/dashboard/[eventId]/website/our-story/_components/love-story-pro-line.tsx',
  '#29 free venue shortlist': 'app/dashboard/[eventId]/progress/_components/free-venue-shortlist-offer.tsx',
  '#32 no shared free day': 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
  '#33 guest seat alerts ask': 'app/[slug]/seat/_components/guest-push-prompt.tsx',
  '#34 booth review': 'app/[slug]/_components/scan-review-ask.tsx',
  '#35 use on profile': 'app/[slug]/_components/use-on-profile.tsx',
  '#36 new on your invitation': 'app/[slug]/_components/chapter-notices.tsx',
  '#37 supplier shows photos': 'app/[slug]/_components/supplier-page-notice-line.tsx',
  '#38 coordinator announcement': 'app/[slug]/_components/day-of-announcement.tsx',
  '#39 live now / thank you': 'app/[slug]/_components/day-of-banner.tsx',
  '#41 shoot from the app': 'app/papic/join/[token]/_components/app-install-banner.tsx',
  '#42 not yet verified': 'app/v/[slug]/_components/not-yet-verified-notice.tsx',
  '#43 Apple sign-in secret': 'app/admin/_apple-secret-reminder.tsx',
  '#44 email off': 'app/admin/_email-delivery-strip.tsx',
  '#45 demo mode': 'app/_components/demo-mode-banner-client.tsx',
  '#46 Setnayan was updated': 'app/_components/stale-tab-notice.tsx',
};

test('3 · every notice of the inventory renders through the one system', () => {
  const byRel = new Map(FILES.map((f) => [f.rel, f.src]));
  const off: string[] = [];
  for (const [row, rel] of Object.entries(INVENTORY)) {
    const src = byRel.get(rel);
    assert.ok(src !== undefined, `${row}: ${rel} is gone — re-point this line at where the notice now lives`);
    if (!/<(?:Notice|InlineNotice|LazyInlineNotice)\b/.test(src)) off.push(`${row}  ${rel}`);
  }
  assert.deepEqual(off, [], `these inventory notices no longer render through the one notice system:\n  ${off.join('\n  ')}`);
});
