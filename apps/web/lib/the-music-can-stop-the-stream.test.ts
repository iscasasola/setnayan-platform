/**
 * the-music-can-stop-the-stream.test.ts — LS7, 2026-09-03.
 *
 * ── THE FACT THIS GUARDS ────────────────────────────────────────────────────
 * YouTube runs Content ID against a LIVE stream in real time
 * (support.google.com/youtube/answer/3367684). On a match it replaces the
 * broadcast with a placeholder image and warns the host to stop; if the content
 * keeps playing the stream is "temporarily interrupted or terminated". And it
 * catches LICENSED music: unless the rights holder has allowlisted that channel,
 * "your live stream can be interrupted even if you've licensed the third-party
 * content".
 *
 * 🔑 WHY THIS NEEDED ITS OWN GUARD RATHER THAN A LINE IN THE EXISTING ONES. The
 * three notices already on the buy sheet all fail BEFORE the day — payment lead
 * time, YouTube's 24-hour activation, the laptop. Late, but survivable. This one
 * fails at the processional, in front of everyone watching from abroad, and the
 * moment does not come back. A Filipino wedding plays licensed music
 * continuously, so it is the default path, not an edge case.
 *
 * ── THE TWO WAYS THIS COPY GOES BACK TO BEING USELESS ───────────────────────
 *   1. It gets shortened to "don't use copyrighted music" — the version every
 *      other product ships and every couple ignores, and which a couple who PAID
 *      for a licence will correctly read as not being about them. So the
 *      licensed-music clause is pinned separately from the interruption itself.
 *   2. It gets written as a disclaimer instead of a precaution. A couple can act
 *      on this — they choose the processional music — so the alternative (live
 *      musicians, royalty-free tracks) is pinned as hard as the risk.
 *
 * ── AND THE HALF THAT IS NOT THE BUYER'S RISK AT ALL ────────────────────────
 * A strike on a SETNAYAN POOL channel lands on a channel that also holds OTHER
 * couples' archives, and YouTube terminates a channel at three strikes with
 * "all your videos will be taken down". One couple's processional can delete
 * another couple's wedding film. `live-studio-roam-provision.ts` has known this
 * since Wave 9 — "isolates concurrency + copyright-strike blast radius" — in a
 * DOCBLOCK nobody on either side of the decision ever read. Both the couple
 * buying the hosted channel and the ADMIN placing an event on one are pinned
 * here, because the admin is the person who actually creates the exposure.
 *
 * Its own file so it cannot conflict with a concurrent PR (same reason
 * `changelog.d/` fragments are per-PR files).
 *
 * Run from apps/web: `pnpm test:unit`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { MUSIC_RIGHTS_NOTICE } from './live-studio-readiness';
import { POOL_CHANNEL_SHARED_STRIKE_NOTICE } from './live-studio-pool-only';

const HERE = dirname(fileURLToPath(import.meta.url));
// STRIPPED. Every assertion below is about code or rendered copy, never about a
// docblock — and a comment that merely TALKS ABOUT the music risk must not be
// able to satisfy a check that the copy reaches a human. That is the exact
// failure mode `strip-comments.ts` exists for.
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const BUY_PAGE = '../app/dashboard/[eventId]/studio/live-studio-control/page.tsx';
const PUBLIC_PAGE = '../app/(shell)/panood/page.tsx';
const ADMIN_BOARD = '../app/admin/live-studio-channels/page.tsx';

/* ── 1 · The notice itself says all four things ───────────────────────────── */

test('⭐ the notice names the MID-STREAM interruption, not a vague policy warning', () => {
  // "You are responsible for the music you play" is a disclaimer. The thing a
  // couple has to understand is that the broadcast STOPS, while it is happening.
  assert.match(
    MUSIC_RIGHTS_NOTICE,
    /cut it off mid-ceremony|stop(s|ped)? (the|your) (stream|broadcast)/i,
    'never says the stream is cut — reads as a policy footnote, not a risk',
  );
  assert.match(
    MUSIC_RIGHTS_NOTICE,
    /processional|first dance/i,
    'never names WHEN it bites, which is what makes it real to a couple',
  );
});

test('⭐ the notice names the LICENSED-MUSIC trap — the half everyone omits', () => {
  // Without this clause the notice is the generic "don't use copyrighted music"
  // line, which the couple who paid for a licence reads and correctly ignores.
  // They are exactly who this exists to protect.
  assert.match(
    MUSIC_RIGHTS_NOTICE,
    /even with music you have PAID to license|even if you.{0,3}ve licensed/i,
    'the licensed-music trap is gone — this is now the version everybody ignores',
  );
  assert.match(
    MUSIC_RIGHTS_NOTICE,
    /allowlist/i,
    'never says WHY a licence does not help, so the claim reads as wrong',
  );
});

test('⭐ the notice is a PRECAUTION — it names what to play instead', () => {
  // Copy that states a risk without an action is legal cover. The couple picks
  // the processional music; this is a decision they can still make.
  assert.match(
    MUSIC_RIGHTS_NOTICE,
    /live musicians/i,
    'no alternative offered — the notice teaches nobody anything',
  );
  assert.match(
    MUSIC_RIGHTS_NOTICE,
    /royalty-free/i,
    'no alternative offered for recorded music',
  );
});

test('⭐ the notice covers the RECORDING too, which fails on a different clock', () => {
  // Content ID also runs over the archive, so a stream that survived the day can
  // still be claimed afterwards. /panood promises "you can keep the recording";
  // this is the caveat on that promise.
  assert.match(
    MUSIC_RIGHTS_NOTICE,
    /recording can still be claimed or muted/i,
    'a surviving stream still loses its archive, and nobody is told',
  );
});

/* ── 2 · It reaches the buy sheet, in the array, by name ──────────────────── */

test('⭐ the buy sheet receives the notice BEFORE the money moves', () => {
  // A constant nobody renders is not a warning. Matched through the whole array
  // shape rather than a substring: that is what stops a future edit dropping one
  // of the other three while this one still passes.
  const page = src(BUY_PAGE);
  assert.match(
    page,
    /notice: \[LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE, ENCODER_BUY_NOTICE, MUSIC_RIGHTS_NOTICE\]/,
    'the fourth pre-purchase fact never reaches the buy sheet',
  );
  assert.match(
    page,
    /from '@\/lib\/live-studio-readiness'/,
    'not imported from the shared module — a second copy will drift',
  );
});

/* ── 3 · The public page answers it ───────────────────────────────────────── */

test('⭐ /panood answers the music question, with the failure AND the fix', () => {
  // Same rule as the notice: naming the risk without naming what to play instead
  // is a disclaimer. A couple reads this page while deciding whether to buy.
  const page = src(PUBLIC_PAGE);
  assert.match(page, /What about the music\?/, 'the public page never raises it at all');
  const faq = page.slice(page.indexOf('What about the music?'));
  const answer = faq.slice(0, faq.indexOf('},'));
  assert.match(
    answer,
    /stop it altogether|cut/i,
    'the answer never says the stream stops — the whole point of asking',
  );
  assert.match(
    answer,
    /paid to license/i,
    'the answer omits the licensed-music trap',
  );
  assert.match(
    answer,
    /live musicians|royalty-free/i,
    'the answer names no alternative, so it teaches nobody anything',
  );
});

/* ── 4 · The pool-channel shared risk, on BOTH surfaces ───────────────────── */

test('⭐ the shared-strike sentence names the OTHER couples and the termination', () => {
  // The risk of a pool channel is not the buyer's — it is every other couple's.
  // Both halves are load-bearing: "shared" alone sounds like bandwidth.
  assert.match(
    POOL_CHANNEL_SHARED_STRIKE_NOTICE,
    /other couples/i,
    'never says whose weddings are also on the channel',
  );
  assert.match(
    POOL_CHANNEL_SHARED_STRIKE_NOTICE,
    /three strikes/i,
    'never states YouTube’s actual threshold',
  );
  assert.match(
    POOL_CHANNEL_SHARED_STRIKE_NOTICE,
    /takes down every video|all your videos/i,
    'never states the consequence — one couple can delete another couple’s film',
  );
});

test('⭐ the hosted-channel BUYER is told before they add it', () => {
  // Inside the add-on section, not the footnote: this is the one thing about the
  // option a buyer cannot work out for themselves.
  const page = src(BUY_PAGE);
  assert.match(
    page,
    /POOL_CHANNEL_SHARED_STRIKE_NOTICE/,
    'the hosted-channel add-on never states the shared-strike risk',
  );
  const upsell = page.slice(page.indexOf('function HostedChannelUpsell'));
  assert.match(
    upsell,
    /POOL_CHANNEL_SHARED_STRIKE_NOTICE/,
    'the sentence is on the page but NOT in the add-on section a buyer reads',
  );
});

test('⭐ the ADMIN placing an event on a shared channel is told too', () => {
  // The admin creates the exposure — this is the person who needs it most, and
  // the person the Wave 9 docblock has been silently keeping it from.
  assert.match(
    src(ADMIN_BOARD),
    /POOL_CHANNEL_SHARED_STRIKE_NOTICE/,
    'the channel-pool board never states what reuse costs',
  );
});

test('⭐ both surfaces use the SAME constant, so they cannot tell different stories', () => {
  // Same reason ENCODER_NOTICE and poolOnlyConnectNotice() are constants: two
  // inline copies of one fact is exactly how the buyer and the admin end up
  // believing different things about the same channel.
  for (const rel of [BUY_PAGE, ADMIN_BOARD]) {
    assert.match(
      src(rel),
      /from '@\/lib\/live-studio-pool-only'/,
      `${rel} does not import the shared constant — it holds its own copy`,
    );
  }
});
