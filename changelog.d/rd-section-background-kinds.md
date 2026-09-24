## 2026-09-23 · feat(event-hub): a section's ground can be a photo, a snippet, or a colour

**RULE 0 FIRST, AND IT HALVED THE BUILD.** The brief was "per-section backgrounds — one new
JSONB column per `invitation_widgets` row, so it runs the exposure freeze." Per-section
backgrounds already shipped: `HubSectionCanvas` has carried `media` (a public-bucket ref),
`focal` (1–9) and `during` since earlier today, with a picker in `sections-panel.tsx` and a
render in `hub-canvas-frame.tsx`.

🛑 **AND IT NEEDS NO COLUMN.** It lives in `invitation_widgets.config_json`, which exists — the
contract file's own docblock says so in capitals. A second column would have been a second,
competing home for one fact (rule 8's trap), passing its own tests while disagreeing.

🔑 **The brief ran the right command and drew the conclusion backwards.**
`git grep "ALTER TABLE public.invitation_widgets"` returns 21 hits and only ever adds `audience`
and `mode` — **no ALTER adds a background because none is needed, not because one is missing.**
An absence read as a gap.

**So the real build was: teach the existing field three kinds instead of one.** No migration, no
exposure freeze, no Ugat node.

## The fence, which is the whole risk

`config_json` is COUPLE-WRITABLE. That is why `media` has always been held to the public bucket
by `hubMediaRef`. Adding a kind adds two ways to get that wrong, pulling opposite ways:

- **a snippet is a ref like any other**, so it passes the SAME allow-list and the same ownership
  set — one field, one fence. Giving video its own ref field would be a second door, and the
  second door is the one nobody checks. Its source is the couple's own
  `landing_page_hero_video_r2_key`, added to `ownRefs` so a hand-crafted POST cannot borrow one.
- **a colour is not a reference at all.** It has its own field and its own shape (`#rrggbb`), so
  there is no way to hand the colour branch an `r2://` and have it stored.

Both directions are sabotage-proven: a snippet naming `setnayan-thread-files` is refused **and
loses its kind** (a kind surviving its media is evidence to a later reader that the ref was once
valid); a colour carrying any `r2://` or `https://` string is dropped.

## The rule for rows that predate the discriminator

🔑 **An absent `kind` MEANS PHOTO, and that is a rule rather than a fallback.** Every
`config_json` in production holds `media` with no kind beside it — such a row could not be
anything else, since `media` has only ever accepted a `hubMediaRef`. `resolveHubBackground` is
the single place that says so, so no reader has to wonder whether absent means "photo" or means
"half-written".

## 🪤 A rule of mine that ran and did nothing

The first draft carried a reduced-motion media query setting the snippet video's CSS
animation-play-state to paused. Valid CSS, matches correctly, **does nothing** — that property
governs CSS animations, and a video playing its own timeline is not one. It would have read in
review as "reduced motion is covered" while moving wallpaper kept playing for exactly the guests
who asked it not to.

⛔ **The rule is deleted rather than left in looking right**, and the gap is stated at the block:
pausing a video needs script, the page already drops `.pahina-js` under reduced motion, and that
fix is a MOUNT — which `ugat-both-ends` exists to make visible. Not smuggled in. **This is the
one open item on Build 1.**

⚠ The comment DESCRIBES the broken rule instead of quoting it, because a source guard grepping
this stylesheet would otherwise match the literal text sitting in the comment explaining its
removal — convicting the documentation of the fix.

## One more difference that is easy to miss

A `<video>` is a replaced element: it carries **no generated content**, so the photo's own
`.hub-canvas-media::after` scrim silently does nothing over footage. The parent draws it instead,
or the couple's words sit unreadable over bright video. Guarded.

**Guards** — `a-background-kind-cannot-smuggle-a-ref.test.ts` (6) and
`each-background-kind-reaches-the-page.test.ts` (5). **Eight sabotages, all firing:** colour
accepts anything · a snippet kind survives a refused ref · an empty background resolves to a
frame · a legacy row reads as a snippet · a snippet also emits `background-image` · every kind
claims the photo class · the video loses its scrim · the video gets a property it ignores.

SPEC IMPACT: None.
