## 2026-07-25 · fix(home): add a visible "What is Setnayan?" purpose block — clears the two Google OAuth brand-verification failures + pre-answers the sensitive-scope review

Google rejected the OAuth brand verification for the Live Studio YouTube integration on exactly two counts:

1. *"Your home page does not explain the purpose of your app."*
2. *"The app name **Setnayan** configured for your OAuth consent screen does not match the app name on your home page."*

Both are true, and both are the same root cause: **the homepage's only concrete description of the product lives in machine-readable surfaces.** `app/page.tsx` carries an excellent purpose statement — but only in `<title>`/`description` metadata and the `SoftwareApplication` JSON-LD `description` + `featureList`. The rendered body copy is editorial by design ("Keep your memories. Plan your moments.", the manifesto, the 5-pillar dock) — it evokes, it never explains. Machine-readable metadata does not satisfy a human reviewer's check. And the app name: the visible wordmark renders **SETNAYAN** (all-caps, via `_components/brand-marks.tsx` / `SetnayanMark`), so the literal title-case string `Setnayan` the consent screen is registered under appeared nowhere as prose above the manifesto.

**Fix — one compact `#what-is-setnayan` section between `.hr-close` and the footer** (`_components/home/HomeReskin.tsx`), deliberately literal where the rest of the page is poetic. Three things in it are load-bearing:

- the literal **title-case "Setnayan"** as body prose (name-match check),
- a plain-language description of what the app does — free planning floor (guest list · seating chart · budget · verified vendors at 0% commission · live event page) then the optional paid upgrades (purpose check),
- an explicit statement that **Live Studio creates the couple's own YouTube live broadcast and streams the ceremony to it.**

That third point is pre-emptive: brand verification is followed by **sensitive-scope** verification, where the reviewer asks *why does this app need YouTube access?* The homepage never visibly mentioned livestreaming to YouTube (again — JSON-LD only), so that review would have failed for the same reason. Answering it now costs one clause.

Copy claims are pinned to what the free tier actually includes (the `hr-pricing` section's own claim + the JSON-LD `featureList`) — notably **RSVP is NOT described as free**, since it is a paid SKU per `Pricing.md § 00.D`. No prices are stated, so this block can't drift against the catalog.

**Hero untouched.** The cinematic gate, the dock, the hero copy and CTAs are byte-identical — the block sits below the close, where a reviewer scrolling the page lands.

Two supporting details:

- **The block is a scroll-snap stop.** `html.hr-snap` is `scroll-snap-type: y mandatory`; a section without a `scroll-snap-align` is not a snap target, so the scroller would have stepped straight from `.hr-close` (`align: start`) to the footer (`align: end`), skating past the new block. `.hr-about` takes `scroll-snap-align: start` so the scroll actually stops on it. Compact (`min-height: 62vh`) — it's a statement, not another 100dvh beat.
- **In-content hash deep links now survive the gate.** The homepage scroll-locks `<html>` (`hr-gate-closed`) on mount, which undoes the browser's own hash jump — so `/#what-is-setnayan` would have stranded a visitor on the hero with the anchor unreachable, making the new section un-linkable. A mount-only effect opens the gate and scrolls to the target, scoped to ids inside `#hr-content` (a `#hr-hero` or stray hash still leaves the gate closed as designed). This is what lets the owner hand `https://www.setnayan.com/#what-is-setnayan` to a reviewer directly.

**Second pass — audited against Google's published App Homepage checklist, not just the two rejection strings.** That checklist requires seven things; two more were unmet:

- **"Explain with transparency the purpose for which your app requests user data."** Describing the Live Studio *feature* is not the same as explaining the *data request*. Added a second paragraph — "Why Setnayan asks for YouTube access" — stating that Live Studio is opt-in, that the couple connects their own YouTube account, and what that connection is used for (schedule / start / end / stream their own event's broadcast). Deliberately phrased as what Setnayan **does** with the access rather than a promise about what it won't touch: the granted scopes are `auth/youtube` + `auth/youtube.upload` (`lib/panood-youtube.ts`), which are broad, and a narrower claim on the homepage than the scopes support would be untrue.
- **"Include a link to your privacy policy."** The homepage's only privacy link was `<Link href="/privacy">Privacy</Link>` in `ReskinFooter` — at the very bottom of `#hr-content`, i.e. behind the scroll gate, with no privacy link anywhere on the gate itself. The new disclosure paragraph now carries its own `/privacy` link, underlined against the site-wide `.home-reskin a { text-decoration: none }` so it reads unmistakably as a link. ⚠ **This URL must keep matching the privacy-policy link configured on the OAuth consent screen** — `https://www.setnayan.com/privacy` (verified live, 200).

**The gate now releases on a scroll gesture (owner-approved 2026-07-25).** `html.hr-gate-closed { overflow: hidden }` meant a wheel/swipe on the hero did *nothing* — anyone who scrolled instead of clicking "Learn more" hit a dead end, which is how **two** of Google's seven homepage requirements (the purpose copy and the privacy link) ended up unreachable without interaction. A `wheel` / `touchmove` / `PageDown`-`ArrowDown`-`End` listener now routes through the **same `openGate()`** the button already uses, so the reveal and smooth scroll are identical and nothing about the design changes — the cinematic screen still loads first. Guards: downward intent only (scrolling up at the top stays a no-op); vertical dominance required on touch so a horizontal swipe across the pillar dock doesn't trip it; and inert while any overlay is open, since the overlays scroll their own bodies (`overflow-y:auto`) and a wheel inside one must not blow the gate open behind it. Space is excluded from the key handler because it activates a focused button and the hero CTAs are buttons.

Verified in-browser: wheel-down opens the gate and the page becomes genuinely scrollable (`overflow: visible`, scroll position sticks); wheel-up does not open it; a horizontal dock swipe does not open it; a vertical swipe does; and with the Prices overlay open a wheel leaves the gate shut. The pre-existing "Learn more" button was measured on the same harness and behaves identically, confirming the new path is faithful to it.

Still owner-action, no code: verifying `setnayan.com` in Google Search Console under the same Google account that owns the Cloud project (Google checks domain ownership separately), and reviewing whether `auth/youtube.upload` is actually needed — Google's "Requesting Minimum Scopes" guidance is a separate review axis, and if Live Studio only creates/manages broadcasts and streams over RTMP, the upload scope may be droppable.

SPEC IMPACT: None — no SKU, price, schema, or locked-decision change. Descriptive copy only; the claims restate the existing homepage JSON-LD `featureList` and `Pricing.md § 00` free tier.
