## 2026-09-28 · fix(rsvp): the RSVP page wears the Event Hub — no blank step, the couple's logo, the hub's background

The owner, on his own event's RSVP page, reported three defects. All three fixed here.

1. **"Step 8 of 9" was blank.** On the RSVP page the Terms tick + Send sat in a
   `data-rsvp-step` *inside* the last step, so "Ask one question at a time" counted
   it twice and showed the outer box with the inner one hidden. The inner marker is
   gone (Terms + Send, plus the keep offer when present, are ONE step), and the
   walker (`rsvp-one-at-a-time.tsx`) now counts only outermost steps as a belt. A
   render-level guard (`the-rsvp-page-follows-the-maker.test.ts` § 9) renders the
   card in seven shapes — the RSVP page, the Event Hub's own card, locked, with the
   selfie, and the "only what is missing" form — and fails on any step inside a step.
   The Event Hub's card had no nesting; nothing else changed there.

2. **The logo did not adapt.** The door crest came from `resolveMonogram`, which only
   knows initials; the Event Hub hero draws the couple's Maker logo. One call,
   `heroMarkSvg` (lib/hero-monogram-data.ts), is now what BOTH ask — the hero loader
   (`loadMedia`) and the doors (`doorMarkFor` in `load-invite-look.ts`) — through the
   read-time gate (`resolveEventMonogramSvg`) and the hero's own inert renderer
   (`BespokeMonogramMark`, which gains an exact `px` size). Initials only when there
   is no logo. Draft-aware on the Maker's RSVP canvas (the draft overlay already
   carries `monogram_custom_svg`). ⚠ **This reaches the Invitation and Enter doors
   too** — they share `loadInviteLook`, so their seals (Capiz · Luxe · Rustic) now
   show the logo as well; Galeriya draws no seal. Every door selects the new
   `INVITE_MARK_COLUMNS`.

3. **The background now follows the Event Hub.** The RSVP page wears the Event Hub's
   own look — the SAME `GuestLookScope` + `lookScopeProps` the guest-tree layout wears
   (cached, no extra read), re-resolved from the draft on the Maker's canvas exactly as
   the Event Hub canvas does — and its Main background, through ONE helper
   (`app/[slug]/_lib/main-ground-layer.tsx`) extracted from `site-body.tsx` so the
   Event Hub and the RSVP cannot disagree. A new `hubDoorSkin` paints nothing behind
   the card (no capiz lattice), keeps the card a card on the page's paper (so it stays
   legible over a photo, an ombré or a dark colour), and carries no door `action`, so
   Send and Next wear the Event Hub's own button colour instead of the door's
   terracotta. Only `/invite/reply` changed; the other doors keep their compositions.

Guards changed, with reasons: `lib/page-ground.test.ts` now reads the Main-background
gate from the shared helper and requires both pages to ask it (the property — resolved
behind the tier gate, mounted once — is unchanged); `select-column-scan.test.ts` T21
counts doors by FILE, since each door's select now interpolates two lists.

New: `app/[slug]/invite/the-door-wears-the-hub.test.ts`.

SPEC IMPACT: None — implements the owner rulings already on record (DECISION_LOG
2026-09-26 "RSVP IS ONE EXTRA PAGE INSIDE THE EVENT HUB … same theme", 2026-09-27
"GUEST SCREENS INHERIT THE THEME").
