/**
 * front-door-anchor.tsx — the five-second answer, for a stranger only.
 *
 * REPLACES `front-door-opening.tsx` (deleted) and `front-door-story.tsx`
 * (deleted) — 2026-09-03, this session, at the owner's direction across a
 * long conversation. Recorded here rather than assumed, because the file it
 * replaces was itself a deliberate, reasoned answer to a real objection (see
 * below), and a reversal of a reasoned decision needs its own reasoning, not
 * a silent overwrite.
 *
 * ─── WHAT THIS REPLACES, AND WHY ──────────────────────────────────────────
 * The retired opening was a full hero (headline + a paragraph making the
 * claim, framed by a two-part "group chat" narrative section) — itself a
 * deliberate answer to *"doesn't it feel like just a youtube rip off?"*: a
 * bare content feed with nothing above it reads as a feed, and a company
 * with no customers cannot borrow proof the way an established brand can.
 *
 * That reasoning does not disappear here — the counter-finding is that a
 * FULL narrative hero solves a stranger's "what is this" problem at the cost
 * of two other things this page needs at once: a visible marketplace (this
 * product's liquidity — its self-reported survival metric — needs real
 * supply seen, not buried under paragraphs) and a legible content feed
 * (comparable products' proof-by-recognition move only works once, then
 * becomes friction for a returning reader). Researched directly this
 * session: a first-time visitor needs the five-second answer, not the case
 * for it — recognition can be one sentence, not a scene.
 *
 * So: ONE headline (still the page's one visible `<h1>` — the OAuth-brand
 * rule that forced a visible heading here in the first place has not
 * changed), three short claims instead of a paragraph, one CTA. No essay, no
 * illustrated group-chat mockup, no second narrative section.
 *
 * ─── SIGNED-OUT ONLY ───────────────────────────────────────────────────────
 * Owner-confirmed this session: a signed-in visitor landing back on `/`
 * already knows what Setnayan is — showing them a stranger's pitch again is
 * the wrong sentence for that reader. The caller (`front-door.tsx`) renders
 * this only when `!account.signedIn`; a signed-in visitor gets no heading
 * prop at all and falls back to the shell's screen-reader-only `<h1>`,
 * exactly like every other converted app surface.
 *
 * ─── THE BRAND NAME STAYS VISIBLE ─────────────────────────────────────────
 * Google's app-verification review failed once (2026-07-25) partly because
 * the homepage did not obviously say what the app is or that it is called
 * Setnayan. The eyebrow carries the name in visible text, same as the
 * retired opening did — see `home-brand-name.test.ts`, which pins the SHELL
 * wordmark independently and is unaffected by this file either way, but the
 * belt-and-suspenders habit is worth keeping on the one page a reviewer is
 * sent to.
 *
 * ─── OPTION B, WITH THE HONESTY FIX (owner 2026-10-25) ───────────────────
 * Approved from `prototypes/ceremo_deltas_2026-10-25/01_front_door.html`
 * (Option B), corrected by the owner before it shipped: *"don't they pay for
 * papic?"* · *"unlimited camera but papic credits is used"* · *"free 50
 * credits is only on their first event"* · *"DO NOT INVENT … we want to tell
 * the truth"*. So:
 *   • the headline says photos land in ONE ALBUM, never that they are kept
 *     free or never lost ("never lose a photo" / "Keep every photo" are gone);
 *   • the small line under the chips says cameras are unlimited and photos
 *     use Papic credits — with NO number, because the free credits are a
 *     first-event-only grant and an amount here would be read as per event;
 *   • the strip's labels carry no invented counts.
 * The purpose paragraph still opens "Setnayan is …" — Google's OAuth review
 * (2026-10-22) needs it, and `google-can-verify-the-home-page.test.ts` holds it.
 * Pinned by `the-front-door-tells-the-truth.test.ts`.
 *
 * ─── THE PREMIUM PITCH (owner 2026-10-28) ─────────────────────────────────
 * Owner, looking at Option B live: *"I don't feel the urge to be part of it"*,
 * then *"I want the cleanest most premium pitch our website can have"* and
 * *"we have so many events that we can cater"*. Approved from
 * `prototypes/front-door-pitch-2026-10-28.html` ("set na yan"). So the
 * Option-B layout (bullet row, drawn before/after tiles) gives way to four
 * quiet beats — a turning photo hero (`front-door-pitch-hero.tsx`), the album,
 * one place, and the close — with the buttons in the owner's words:
 * *"I-set ang event mo"* and *"i-set na natin yan … the more complete version
 * of set na yan"*.
 *
 * Everything the earlier rulings above protect is kept, by name:
 *   • "Setnayan" inside the one <h1>, and a <p> opening "Setnayan is …"
 *     (Google OAuth, 2026-10-22);
 *   • "Unlimited cameras · photos use Papic credits." with NO number, and no
 *     overpromise — the album card says photos are ADDED, never how many;
 *   • the main button `.fd-opening-cta` → `/start`, terracotta; "How it works"
 *     → `/features` (2026-10-25);
 *   • Privacy Policy · Terms of Service on the page itself.
 *   • The print line says prints CAN match the Event Hub — printing in your
 *     own look is Pro (`lib/print-pieces.ts` `printAccess`), so it is never
 *     promised as free.
 */
import Image from 'next/image';
import Link from 'next/link';
import { FrontDoorPitchHero } from './front-door-pitch-hero';

export function FrontDoorAnchor() {
  return (
    <section className="fd-opening fd-pitch" aria-labelledby="fd-opening-h">
      <FrontDoorPitchHero>
        {/*
          THE PURPOSE, IN ONE SENTENCE A REVIEWER CAN QUOTE (Google, 2026-10-22).
          No claim that photos are free — the Papic line below says what they use.
        */}
        <p className="fd-opening-lede">
          Setnayan is one place for your guests and RSVPs, your suppliers and the
          Event Hub your guests open — and every photo they take, in one album.
        </p>
        <div className="fd-opening-acts">
          {/*
            🧭 ANY EVENT, SO THE DOOR ASKS WHICH ONE — BEFORE SIGN-UP (2026-10-25):
            `/start` is the shipped create-event grid on a public page.
            🎨 `.fd-btn-terra` wears `--m-mulberry`, the house main-button token.
          */}
          <Link href="/start" className="fd-btn-terra fd-opening-cta">
            I-set ang event mo — free
          </Link>
          <Link href="/features" className="fd-opening-alt">
            How it works
          </Link>
        </div>
      </FrontDoorPitchHero>

      {/* ── THE ALBUM ── the one promise no planner makes. */}
      <div className="fd-pitch-band fd-pitch-split">
        <div>
          <p className="fd-pitch-kicker">The album</p>
          <h2 className="fd-pitch-h2">
            Every photo. <em>Even the ones you never saw.</em>
          </h2>
          <p className="fd-pitch-sub">
            Your guests take pictures on their own phones. They all land in one
            album — and each guest gets the ones they&rsquo;re in.
          </p>
          <p className="fd-opening-papic">Unlimited cameras &middot; photos use Papic credits.</p>
        </div>
        <div className="fd-pitch-album" aria-hidden="true">
          <div className="fd-pitch-photo">
            <Image src="/event-types/reunion.webp" alt="" fill sizes="(min-width: 1024px) 18vw, 33vw" />
          </div>
          <div className="fd-pitch-photo">
            <Image src="/realstories/maria-juan-g1.jpg" alt="" fill sizes="(min-width: 1024px) 18vw, 33vw" />
          </div>
          <div className="fd-pitch-photo">
            <Image src="/event-types/birthday.webp" alt="" fill sizes="(min-width: 1024px) 18vw, 33vw" />
          </div>
          {/* An illustration of the notice, never a count: no number here may read as a real figure. */}
          <div className="fd-pitch-toast">
            <span className="fd-pitch-toast-dot">S</span>
            <span>
              <b>Tita Baby</b> added new photos
              <small>You&rsquo;re in some of them</small>
            </span>
          </div>
        </div>
      </div>

      {/* ── ONE PLACE ── what you no longer do, in three lines. */}
      <div className="fd-pitch-band fd-pitch-ivory">
        <p className="fd-pitch-kicker">One place</p>
        <h2 className="fd-pitch-h2">No more ten group chats.</h2>
        <ol className="fd-pitch-rows">
          <li>
            <span className="fd-pitch-n">i.</span>
            <h3>Your guests, sorted.</h3>
            <p>Invite on Messenger, Viber or WhatsApp. RSVPs fill your list, and the seat plan keeps up.</p>
          </li>
          <li>
            <span className="fd-pitch-n">ii.</span>
            <h3>Your suppliers, compared.</h3>
            <p>Suppliers for every kind of event. Ask, compare and book — no commission on your suppliers, ever.</p>
          </li>
          <li>
            <span className="fd-pitch-n">iii.</span>
            <h3>Your day, in one look.</h3>
            <p>One Event Hub your guests open, and prints — invitations to place cards — that can match it.</p>
          </li>
        </ol>
      </div>

      {/* ── THE CLOSE ── the button says go; the line says done. */}
      <div className="fd-pitch-band fd-pitch-close">
        <h2 className="fd-pitch-h2">
          Set na &rsquo;yan. <em>Let&rsquo;s set that.</em>
        </h2>
        <Link href="/start" className="fd-btn-terra fd-pitch-cta2">
          I-set na natin &rsquo;yan
        </Link>
        <p className="fd-pitch-fine">Free to plan &middot; No guest limit &middot; Guests don&rsquo;t sign in</p>
        {/*
          THE TWO POLICIES, ON THE HOME PAGE ITSELF (Google, 2026-10-22).
        */}
        <p className="fd-opening-legal">
          <Link href="/privacy">Privacy Policy</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/terms">Terms of Service</Link>
        </p>
      </div>
    </section>
  );
}
