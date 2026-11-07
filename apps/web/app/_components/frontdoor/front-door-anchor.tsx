/**
 * front-door-anchor.tsx — the hero of the signed-out front page.
 *
 * PORTED, NOT REDRAWN, from `prototypes/front_page_2026-11-04.html` (owner-approved 4 Nov 2026; DECISION_LOG
 * "THE THREE MARKETING PAGES GO TO CLOUD BUILD"). It replaces the 25 Oct "Option B" opening (one headline, a
 * before → after strip of grey tiles) with the 28 Oct premium pitch the prototype carries: a turning photo
 * across the whole width, the copy over a white wash, and the headline with the turning word —
 * "Your wedding, beautifully handled on Setnayan." (DECISION_LOG 2026-10-28 "THE FRONT DOOR'S PREMIUM PITCH").
 *
 * ─── WHAT CARRIED OVER FROM OPTION B, word for word ──────────────────────────────────────────────────────
 *   • "Free to start · No guest limit · No credit card · Guests don't sign in";
 *   • "Unlimited cameras · photos use Papic credits." — with NO number on the hero: the free credits are a
 *     first-event-only grant and an amount here reads as per event (owner 2026-10-25). The prototype's ⓘ
 *     names the amounts; this one names the rule and leaves the figures to the plans below
 *     (`the-front-door-tells-the-truth.test.ts` §3);
 *   • the Taglish line "Hindi na kalat sa GC, hindi na naiiwan sa phone ng iba."
 *
 * ─── THE TWO GOOGLE OAUTH GUARDS STILL HOLD (`app/google-can-verify-the-home-page.test.ts`) ─────────────
 *   • "Setnayan" is typed INSIDE the one <h1> (refused 2026-10-22 for a home page whose name did not match);
 *   • a paragraph opens "Setnayan is …" and says what the app does.
 * The Privacy and Terms links left the hero with the prototype; they now sit in the page's own footer
 * (`front-door-landing.tsx`), which the same guard reads.
 *
 * ─── NO SAMPLE OR DEMO BUTTONS (owner, CLOUD_BOARD 5 Nov: "just do not add buttons") ─────────────────────────
 * The prototype led with "Try Maria and Jose's wedding" → /sample. The owner ruled the marketing pages carry no
 * demo or sample buttons — not hidden behind a switch, not added. So the main button is "Set up your event — free"
 * (→ /start, the public type picker — owner 2026-10-25) and "How it works" (→ /features) stays beside it.
 *
 * Signed in, this is not rendered at all (`front-door.tsx`).
 */
import Link from 'next/link';

import { InfoTip } from '@/app/_components/info-tip';
import { HeroStage, HeroWord } from './front-door-hero';
import { HERO_SLIDES } from './front-door-landing-data';

export function FrontDoorAnchor() {
  return (
    <section className="fl-hero" aria-labelledby="fd-opening-h">
      <HeroStage slides={HERO_SLIDES}>
        <div className="fl-hero-copy">
          <p className="fl-eyebrow">Set na &rsquo;yan</p>
          {/*
            THE PAGE'S ONLY <h1>. "Setnayan" is typed in title case — "SETNAYAN" is the spelling Google
            rejected (2026-07-25). The turning word is server markup on first paint (`HeroWord`).
          */}
          <h1 id="fd-opening-h" className="fl-h1">
            Your{' '}
            <span className="fl-nw">
              <HeroWord />,
            </span>{' '}
            beautifully handled <span className="fl-h1-on">on Setnayan.</span>
          </h1>
          <p className="fl-hero-lede">
            <b>Setnayan is the Filipino event-planning app</b> — guests, suppliers, the run of the day and your
            Event Hub in one place, and every photo your guests take, in one album.{' '}
            <i>Hindi na kalat sa GC, hindi na naiiwan sa phone ng iba.</i>
          </p>
          <div className="fl-ctas">
            <Link href="/start" className="fd-btn-terra fd-opening-cta fl-btn">
              Set up your event — free
            </Link>
            <Link href="/features" className="fd-opening-alt">
              How it works
            </Link>
          </div>
          {/*
            "No credit card" is true: sign-up asks for none, and every payment is GCash or bank transfer after
            you apply. "No guest limit" is what /help says (lib/help.ts).
          */}
          <p className="fl-truths">
            <span>Free to start</span>
            <span className="fl-sep" aria-hidden="true">·</span>
            <span>No guest limit</span>
            <span className="fl-sep" aria-hidden="true">·</span>
            <span>No credit card</span>
            <span className="fl-sep" aria-hidden="true">·</span>
            <span>Guests don&rsquo;t sign in</span>
            <span className="fl-sep" aria-hidden="true">·</span>
            <InfoTip
              label="Unlimited cameras · photos use Papic credits."
              ariaLabel="About Papic credits"
              align="start"
              className="fl-truths-papic"
            >
              Every guest&rsquo;s phone can be a camera. Each photo they take into your album uses Papic credits.
              Your first event comes with free credits, Plus and Pro bring more, and you can buy more any time.
            </InfoTip>
          </p>
        </div>
      </HeroStage>
    </section>
  );
}
