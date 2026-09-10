## 2026-09-10 · feat(invite): a Pro invite theme opens with the couple's cinematic reveal

Owner, 2026-09-10: *"background will use the reveal background photo. So our
cinematic reveal is also integrated as one whole concept design."* The invite
link's first door (`/[slug]/invite`) now opens the way the Event Hub opens
when the couple's invite theme is a Pro theme (Capiz today). House, the free
door, never does.

- **One composition.** The six helpers that build the reveal's props (monogram,
  wax, veil, mark SVG, seal config, template) moved verbatim out of
  `site-body.tsx` into `app/[slug]/_lib/reveal-props.ts`; the Event Hub and the
  invite door both import them, so the two cannot open with a different seal,
  colour or template.
- **The couple's opening wins.** A theme only supplies a default (Capiz: the
  sheer veil) when the couple never chose one; a chosen opening, "No Reveal"
  included, is kept.
- **One rule for WHEN.** The Event Hub's condition is now named —
  `cinematicRevealPlays` in `lib/site-body-plan.ts` (behaviour identical; its
  goldens and `the-reveal-reaches-the-invitation.test.ts` are unchanged and
  green) — and the invite door asks it through `lib/invite-reveal.ts` with the
  same inputs `app/[slug]/page.tsx` uses (venue clock, solemn adjustment,
  wedding-only parts). So the invite inherits both owner exclusions: never on
  the day itself or during the story, never for a wake.
- **Ownership is still checked.** `RevealOverlayServer` resolves Event Hub Pro
  itself, so a lapsed unlock shows no reveal.

Guarded by `app/[slug]/invite/the-reveal-opens-the-invite.test.ts` — one home
for the helpers; House never mounts it; the couple's template wins; every
theme default is a shipped mechanic; the invite and the Event Hub agree for
wedding / wake / generic at all four stages at fixed moments (mutation-checked
4/4). `lib/invite-reveal.ts` joins the venue-clock caller list in
`a-finished-event-reads-as-finished.test.ts`.

Known and unchanged: the Event Hub replays its reveal on every load (nothing
records that a guest has seen it), so a guest who arrives by the invite link
meets the opening on door 01 and again when door 03 hands them into the hub.

SPEC IMPACT: None — builds the 2026-09-10 decision already logged with #5403.
