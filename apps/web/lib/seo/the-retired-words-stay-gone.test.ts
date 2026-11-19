/**
 * the-retired-words-stay-gone.test.ts — the "Remove now" list of the one source for search and AI never reaches a
 * search engine or an AI assistant again (owner 20 Nov 2026: "Yes, send it").
 *
 * The source is specs `SETNAYAN_FOR_SEARCH_AND_AI_2026-11-20.md` §11 "Remove from every page now". Each line was
 * wrong or retired on 20 Nov, and each one used to be printed by one of the three things this file reads:
 *   · the rendered `/llms.txt` (lib/llms-txt.ts), fee on and fee off;
 *   · every saved AI answer and its question (lib/seo/ai-answers.ts) — what /llms.txt and the /features FAQPage print;
 *   · `app/layout.tsx` — the site title, description and Organization JSON-LD on every page — COMMENT-STRIPPED with
 *     the shared lexer (lib/strip-comments.ts), because the comments there quote the old words on purpose.
 *
 * SABOTAGE (run once, 20 Nov): put "Pabuya" back into the `what-is` answer in lib/seo/ai-answers.ts → RED; restore → green.
 *
 * Run: cd apps/web && npx tsx --test lib/seo/the-retired-words-stay-gone.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderLlmsTxt, llmsFeatureRoutes } from '../llms-txt';
import { INPUT_FOR_GUARDS } from '../llms-txt-guard-input';
import { BOOKING_FEE } from '../booking-fee';
import { stripComments } from '../strip-comments';
import { aiAnswers, featuresFaqAnswers, SUPPLIER_FREE_BOOKING_LINE } from './ai-answers';
import { ALL_HELP_ARTICLES } from '../help';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '../..');

type Surface = 'llms.txt' | 'ai-answers' | 'layout.tsx' | 'help';
/** The three this PR rewrote. /help is read only for the rows that name it in `alsoOn` (its other retired lines are a
 *  follow-up, listed on PR #8041). */
const PRIMARY: readonly Surface[] = ['llms.txt', 'ai-answers', 'layout.tsx'];

/** §11 "Remove from every page now", one row per line, each with why. */
const REMOVE_NOW: readonly { what: string; pattern: RegExp; why: string; heldOn?: Surface; alsoOn?: readonly Surface[] }[] = [
  {
    what: 'Real Stories',
    pattern: /Real Stories|\/features\/real-stories|\/realstories\b/i,
    why: 'retired with the blog (DECISION_LOG "THE BLOG AND REAL STORIES ARE RETIRED"); the after-the-day story is "Event stories"',
  },
  {
    what: '"50 credits free on your first event"',
    pattern: /50 (?:free )?credits(?: free)? on your first event|50 free on your first event/i,
    why: 'retired in the source §11; plans and packs carry the credits',
    // ⚠ HELD on /llms.txt, not removed — an OWNER QUESTION on the PR. `lib/the-free-pool-is-not-on-every-event.test.ts`
    // requires lib/llms-txt.ts to name the first-event condition ("silence is not honesty here"), and the grant is
    // still live in SQL (`papic_claim_free_pool`, `papic_event_pool_config.free_grant_points`). That guard is not
    // weakened to make room; the test below fails the day the hold is no longer needed, so it cannot rot.
    heldOn: 'llms.txt',
  },
  {
    what: '"a supplier\'s first booking from Setnayan is on us"',
    pattern: /first booking (?:from|through) Setnayan is (?:on us|free)/i,
    why: 'not a rule (DECISION_LOG 2026-11-19 "WEBSITE CONTENT", item 5) — the only free booking is the 19 Nov one',
  },
  {
    what: '"a supplier\'s own clients are always free"',
    pattern: /own clients are always free/i,
    why: `replaced by the 19 Nov wording: "${SUPPLIER_FREE_BOOKING_LINE}"`,
  },
  {
    what: '"no booking commission" on the For Suppliers line',
    pattern: /no booking commission/i,
    why: 'contradicts the booking fee suppliers pay on clients Setnayan brings',
  },
  {
    what: 'Pabuya',
    pattern: /\bPabuya\b/i,
    why: 'the e-gift is named "E-Gifts" on every page (DECISION_LOG 2026-11-19 "WEBSITE CONTENT", item 8)',
  },
  {
    what: '"that\'s all set" as the meaning',
    pattern: /that['’]s all set/i,
    why: 'the meaning of Set na \'yan is "let\'s get that set" (north star, 19 Nov)',
    // /help's "What is Setnayan?" article said it too (lib/help/topics-existing.ts), fixed 20 Nov.
    alsoOn: ['help'],
  },
  {
    what: 'Setnayan AI "in Event Plus"',
    pattern:
      /all three (?:carry|include) Setnayan AI|Setnayan AI comes inside all three|Setnayan AI (?:is )?(?:in|inside|with) Event Plus\b|Event Plus (?:adds|includes|carries|comes with) Setnayan AI/i,
    why: 'Setnayan AI comes with Event Pro and Event Ultra (event plans re-cut, 18 Nov)',
  },
];

function withFee<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  if (value === undefined) delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  else process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
    else process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = prev;
  }
}

/** Every reading of each surface — fee on (rate read and unread, launch offer open) and fee off. */
function surfaces(): Record<Surface, string> {
  const llms = [
    withFee('true', () => renderLlmsTxt({ ...INPUT_FOR_GUARDS, bookingFee: BOOKING_FEE, launchOfferCap: 1000 })),
    withFee('true', () => renderLlmsTxt(INPUT_FOR_GUARDS)),
    withFee(undefined, () => renderLlmsTxt(INPUT_FOR_GUARDS)),
  ].join('\n');
  const answers = [
    ...withFee('true', () => aiAnswers({ bookingFee: BOOKING_FEE })),
    ...withFee('true', () => aiAnswers({ bookingFee: null })),
    ...withFee(undefined, () => aiAnswers({ bookingFee: null })),
  ]
    .map((a) => `${a.question}\n${a.answer}`)
    .concat(withFee('true', () => featuresFaqAnswers()).map((f) => `${f.q}\n${f.a}`))
    .join('\n');
  const layout = stripComments(readFileSync(join(WEB, 'app/layout.tsx'), 'utf8'));
  // /help as it is served: every public article's title and bodies (the web body and the in-app one).
  const help = ALL_HELP_ARTICLES.map(({ article }) => Object.values(article).filter((v) => typeof v === 'string').join('\n')).join('\n');
  return { 'llms.txt': llms, 'ai-answers': answers, 'layout.tsx': layout, help };
}

test('no "Remove now" line of the source reaches llms.txt, the saved AI answers or the site-wide metadata', () => {
  const found: string[] = [];
  const all = surfaces();
  assert.match(all.help, /let's get that set/, 'precondition: the /help reader found the "What is Setnayan?" article');
  for (const [where, text] of Object.entries(all) as [Surface, string][]) {
    for (const r of REMOVE_NOW) {
      if (!PRIMARY.includes(where) && !r.alsoOn?.includes(where)) continue;
      if (r.heldOn === where) continue;
      const m = r.pattern.exec(text);
      if (m) found.push(`${where}: ${r.what} — matched ${JSON.stringify(m[0])} — ${r.why}`);
    }
  }
  assert.deepEqual(found, [], 'a retired line is back:\n  ' + found.join('\n  '));
});

test('a held line is still held for its reason — delete the hold the day the owner rules', () => {
  const s = surfaces();
  for (const r of REMOVE_NOW.filter((x) => x.heldOn)) {
    assert.match(
      s[r.heldOn!],
      r.pattern,
      `${r.what} is gone from ${r.heldOn} — the hold is no longer needed: delete its heldOn so the guard covers it there too`,
    );
  }
});

test('the patterns are live — each one catches the words it was written for', () => {
  const samples = [
    'read our Real Stories',
    '50 credits free on your first event',
    "a supplier's first booking from Setnayan is on us",
    "a supplier's own clients are always free",
    'no listing fee, no booking commission',
    'give through Pabuya',
    'Set na \'yan — "that\'s all set"',
    'Event Plus, Event Pro or Event Ultra — all three carry Setnayan AI',
  ];
  for (const r of REMOVE_NOW) {
    assert.ok(samples.some((t) => r.pattern.test(t)), `no sample trips ${r.pattern} — a pattern that catches nothing is decoration`);
  }
});

test('what replaced them is said: the 19 Nov free booking, "let\'s get that set", and no Real Stories page linked', () => {
  const llms = withFee('true', () => renderLlmsTxt({ ...INPUT_FOR_GUARDS, bookingFee: BOOKING_FEE }));
  assert.ok(llms.includes(SUPPLIER_FREE_BOOKING_LINE), 'llms.txt lost the 19 Nov free-booking sentence');
  assert.match(llms, /let's get that set/, 'llms.txt no longer gives the meaning of Set na \'yan');
  assert.match(llms, /Plan it[\s\S]*Live it[\s\S]*Keep it/, 'llms.txt is no longer grouped Plan it · Live it · Keep it');
  assert.ok(!llmsFeatureRoutes().some((r) => /real-stories/.test(r)), 'llms.txt links the retired Real Stories page');
  const commission = withFee('true', () => aiAnswers({ bookingFee: BOOKING_FEE }).find((a) => a.id === 'commission')!.answer);
  assert.ok(commission.includes(SUPPLIER_FREE_BOOKING_LINE), 'the commission answer lost the 19 Nov free-booking sentence');
  const layout = stripComments(readFileSync(join(WEB, 'app/layout.tsx'), 'utf8'));
  assert.match(layout, /let's get that set/, 'the Organization JSON-LD no longer gives the meaning of Set na \'yan');
});

test('the internal "where rivals are ahead" list and rival prices never ship', () => {
  const llms = withFee('true', () => renderLlmsTxt({ ...INPUT_FOR_GUARDS, bookingFee: BOOKING_FEE }));
  assert.doesNotMatch(llms, /where rivals are ahead|Eventchy|Bridalpod|PhotoShare\.ph|\bKuha\b/i, 'llms.txt prints the internal rivals list');
  assert.doesNotMatch(llms, /₱1,495|₱14,193|₱63,500/, 'llms.txt quotes a typed market figure');
});
