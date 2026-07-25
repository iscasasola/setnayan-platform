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

⚠ **Owner note — this change alone may not be sufficient, and the reason is behavioral, not copy.** The homepage is a **no-scroll cinematic gate**: `html.hr-gate-closed { overflow: hidden }` holds the viewport until the visitor clicks "Learn more" or a dock tile. A reviewer who loads `setnayan.com`, tries to scroll, and sees nothing move will not reach this section (or the manifesto, which already says "Setnayan is where the memories of every event in your life are kept"). The section IS in the server-rendered HTML, so text-extraction passes see it — but a human reviewer may not. Two options, owner's call, both out of scope here: (a) submit `https://www.setnayan.com/#what-is-setnayan` as the home-page URL / justification link in the Google console, or (b) let the gate release on the first scroll gesture instead of requiring a click. Also still owner-action and unrelated to code: verifying `setnayan.com` in Google Search Console under the same Google account that owns the Cloud project.

SPEC IMPACT: None — no SKU, price, schema, or locked-decision change. Descriptive copy only; the claims restate the existing homepage JSON-LD `featureList` and `Pricing.md § 00` free tier.
