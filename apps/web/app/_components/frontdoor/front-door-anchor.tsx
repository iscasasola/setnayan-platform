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
 */
import Link from 'next/link';

export function FrontDoorAnchor() {
  return (
    <section className="fd-opening" aria-labelledby="fd-opening-h">
      {/*
        THE PAGE'S ONLY <h1> — see the shell's `heading` prop note.

        🔑 THE NAME IS INSIDE THE <h1>, AND IT IS TYPED "Setnayan" (2026-10-22).
        Google refused OAuth brand verification a second time — "the app name
        'Setnayan' … does not match the app name on your home page". The
        capitals come from `text-transform` on `.fd-opening-kick`, so the
        heading reads "Setnayan: Plan any event free…" to a crawler. Guarded by
        app/google-can-verify-the-home-page.test.ts.
      */}
      <h1 id="fd-opening-h" className="fd-opening-h1">
        <span className="fd-opening-kick">Setnayan</span>
        <span className="sr-only">: </span>
        Plan any event free. Every photo in one album.
      </h1>
      {/*
        THE PURPOSE, IN ONE SENTENCE A REVIEWER CAN QUOTE (Google, 2026-10-22),
        then the pain in the words our guests use. No claim that photos are free.
      */}
      <p className="fd-opening-lede">
        Setnayan is one place for your guest list, RSVPs, budget, suppliers and
        the Event Hub your guests open — for any event.{' '}
        <i>Hindi na kalat sa GC, hindi na naiiwan sa phone ng iba.</i>
      </p>
      {/*
        "No credit card" is true: sign-up asks for none, and every payment is
        GCash or bank transfer after you apply. "No guest limit" is what
        /help says (lib/help.ts).
      */}
      <ul className="fd-opening-trust">
        <li>Free to start</li>
        <li>No guest limit</li>
        <li>No credit card</li>
        <li>Guests don&rsquo;t sign in</li>
      </ul>
      <p className="fd-opening-papic">Unlimited cameras &middot; photos use Papic credits.</p>
      <div className="fd-opening-acts">
        {/*
          🧭 ANY EVENT, SO THE DOOR ASKS WHICH ONE — BEFORE SIGN-UP (owner
          2026-10-25). This went to `/onboarding/wedding` alone while the
          headline said "any event". `/start` is the shipped create-event grid
          on a public page; each type goes straight to its own
          `/onboarding/<type>`, and each onboarding asks for the account where
          it always has. A signed-in visitor is sent on to the full picker.

          🎨 TERRACOTTA, NOT THIS PAGE'S GOLD (owner 2026-10-25: "If for event
          hub then use the event's color but for setnayan use our template").
          `.fd-btn-terra` wears `--m-mulberry`, the house main-button token.
        */}
        <Link href="/start" className="fd-btn-terra fd-opening-cta">
          Start your event — free
        </Link>
        {/* "How it works" → the Features hub (owner 2026-10-25); /our-story is a
            manifesto with no steps. */}
        <Link href="/features" className="fd-opening-alt">
          How it works
        </Link>
      </div>
      {/*
        BEFORE → AFTER (Option B). Drawn tiles, aria-hidden — an illustration,
        not a count: no number here may read as a real figure.
      */}
      <div className="fd-opening-ba">
        <div>
          <p className="fd-opening-ba-lab">Before</p>
          <div className="fd-opening-scatter" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <p className="fd-opening-ba-line">Guest photos scattered across phones and group chats.</p>
        </div>
        <span className="fd-opening-ba-arrow" aria-hidden="true">
          &rarr;
        </span>
        <div>
          <p className="fd-opening-ba-lab">After</p>
          <div className="fd-opening-album" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <p className="fd-opening-ba-line">
            <b>One album</b> the whole event fills, from the first toast.
          </p>
        </div>
      </div>
      <p className="fd-opening-fine">
        <i>Set na &rsquo;yan</i> — that&rsquo;s all set. Free to plan, and no
        commission on your suppliers, ever.
      </p>
      {/*
        THE TWO POLICIES, ON THE HOME PAGE ITSELF (2026-10-22). Google's
        homepage requirement is a visible link to the privacy policy; Terms
        sits beside it.
      */}
      <p className="fd-opening-legal">
        <Link href="/privacy">Privacy Policy</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/terms">Terms of Service</Link>
      </p>
    </section>
  );
}
