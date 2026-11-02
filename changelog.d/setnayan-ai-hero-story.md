## 2026-07-03 · fix(marketing): Setnayan AI story = the hero itself (no takeover, no extra buttons)

Owner 2026-07-03: "we do not want it to jump away from the website. we want that to be the new
background… we only keep the Start Planning Free and learn more from the original hero. what you
sent will be the text on top of the background video." Supersedes the fullscreen takeover from
PR #2652.

- `setnayan-ai-story.tsx` — rewritten as `SetnayanAiHeroStory`: a pure TEXT block (three shipped
  jobs · restraint line · catalog-driven ₱799/₱499 price · note) rendered INSIDE the hero when the
  Suri · Setnayan AI tile is selected. No portal, no modal, no close button, no CTAs of its own.
- `HomeReskin.tsx` — takeover state/mount removed; the Suri tile now behaves exactly like every
  tile (paints its scene; an admin-uploaded Suri background video plays under the story text). The
  original two hero CTAs stay untouched. The nav pop-up's "See the full story →" selects the tile
  + returns to the hero.
- `home-reskin.css` — `.hr-ai-*` styles (glass job cards, price row); short viewports fold the job
  blurbs + quiet line away and narrow viewports stack slim rows, so the hero stays one screen.

Verified in a local preview: dock renders the 5 product tiles; Suri click → story-as-hero with
only the two original CTAs; nav pop-up full-story path lands on the same hero. Radius lint clean.

SPEC IMPACT: None new — refines the 2026-07-03 dock/story decision (DECISION_LOG).
