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
 */
import Link from 'next/link';

export function FrontDoorAnchor() {
  return (
    <section className="fd-opening" aria-labelledby="fd-opening-h">
      <p className="fd-opening-kick">SETNAYAN</p>
      {/* THE PAGE'S ONLY <h1> — see the shell's `heading` prop note. */}
      <h1 id="fd-opening-h" className="fd-opening-h1">
        Plan your Filipino event free — and never lose a photo.
      </h1>
      <ul className="fd-opening-claims">
        <li>Every celebration, planned in one place</li>
        <li>Every guest&rsquo;s photo, kept in one album</li>
        <li>Verified suppliers &middot; 0% commission</li>
      </ul>
      <div className="fd-opening-acts">
        {/*
          ⚠ SAME HREF THE RETIRED OPENING USED. `/onboarding` alone is a
          404 — there is no page.tsx at that path, only `[type]`, `simple`
          and `wedding` beneath it. Every other create door in the app uses
          `/onboarding/wedding`, so this one does too.

          🔴 NOT YET TYPE-AWARE. `/onboarding/[type]` — the generic,
          non-wedding flow — is dark behind `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED`
          today, so this button is honestly wedding-first even though the
          page's own claim above is now "any Filipino event". Flagged, not
          silently fixed: turning this into a real type-aware door is a
          product decision (does the flag go live? does this button branch
          before or after?) that needs the owner, not a guess made here.
        */}
        <Link href="/onboarding/wedding?from=home" className="fd-btn-gold fd-opening-cta">
          Start your celebration — free
        </Link>
        {/*
          `/our-story`, NOT `/alaala`. The retired opening's secondary link
          went to the album mechanism specifically ("How the album works").
          This page's claim is broader now, so the secondary link goes to
          the actual mission/manifesto page — the owner's own "Living
          Memories" philosophy — rather than one pillar's explainer.
        */}
        <Link href="/our-story" className="fd-opening-alt">
          How it works
        </Link>
      </div>
      <p className="fd-opening-fine">
        <i>Set na &rsquo;yan</i> — that&rsquo;s all set. Free to plan, and no
        commission on your suppliers, ever.
      </p>
    </section>
  );
}
