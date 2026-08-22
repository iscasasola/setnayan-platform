/**
 * front-door-opening.tsx — the first thing a stranger reads at `/`.
 *
 * 🔴 WHY THIS EXISTS. The front door had NO VISIBLE HEADLINE. Its `<h1>` was
 * `fd-sr-only` — present for screen readers and for search, invisible to a
 * person — so the page opened on a filter bar and a grid of cards. That is
 * YouTube's shape, and the owner said so: *"doesn't it feel like just a youtube
 * rip off?"* A feed with nothing above it IS a feed. YouTube can open that way
 * because everyone already knows what YouTube is. We cannot.
 *
 * ─── THE ARGUMENT, AND WHY IT IS THIS ONE ────────────────────────────────
 * We have almost no customers, so we cannot borrow proof — no testimonials, no
 * counts, no ratings. What we CAN do is point at proof the reader already owns.
 * Every Filipino who has been to a wedding has a group chat that went quiet and
 * a set of photos they never received. The claim is verified from their own
 * memory in about two seconds, which is the only kind of proof a company with
 * no customers can honestly offer.
 *
 * It is also the one claim that is ours. Planning tools are matchable. "Every
 * photo from every phone, in one album, kept for life" is not.
 *
 * ⚠ NO PRESSURE, DELIBERATELY. The frame is PAST tense and about other people's
 * weddings — it never threatens the reader's own day, never counts down, never
 * asks "don't you want to remember it?". Recognition, not fear. If a later edit
 * turns this toward what the reader stands to lose, it has left the brief.
 *
 * 🔑 AND IT CARRIES THE BRAND NAME ON PURPOSE. Google's app-verification review
 * failed once because this page did not obviously say what the app is or that
 * it is called Setnayan. The purpose sentence names it in the first paragraph,
 * above the fold, in prose a person actually reads — not as a meta tag.
 */
import Link from 'next/link';

export function FrontDoorOpening() {
  return (
    <section className="fd-opening" aria-labelledby="fd-opening-h">
      <p className="fd-opening-kick">SETNAYAN</p>
      {/*
        THE PAGE'S ONLY <h1>. It replaces the shell's screen-reader-only one
        rather than joining it — two would break the "exactly one <h1> per page"
        rule the doorway work closed on 2026-08-13.
      */}
      <h1 id="fd-opening-h" className="fd-opening-h1">
        The best photo of the night is on somebody else’s phone.
      </h1>
      <p className="fd-opening-lede">
        It always is. A few make it to the group chat, the group chat goes quiet,
        and within a year the only album left is the photographer’s.{' '}
        <b>Setnayan</b> gives your celebration one link — the save-the-date, the
        RSVP, the day itself — and gathers every photo, from every phone, into
        one album you keep for life.
      </p>
      <div className="fd-opening-acts">
        {/*
          ⚠ `/onboarding` ALONE IS A 404 — there is no page.tsx at that path,
          only `[type]`, `simple` and `wedding` beneath it. Verified live. Every
          other create door in the app uses `/onboarding/wedding`, so this one
          does too rather than inventing a bare path that does not resolve. A
          link that goes nowhere is the one thing this page forbids.
        */}
        <Link href="/onboarding/wedding?from=home" className="fd-btn-gold fd-opening-cta">
          Start your celebration — free
        </Link>
        <Link href="/alaala" className="fd-opening-alt">
          How the album works
        </Link>
      </div>
      <p className="fd-opening-fine">
        <i>Set na ’yan</i> — that’s all set. Free to plan, and no commission on
        your suppliers, ever.
      </p>
    </section>
  );
}
