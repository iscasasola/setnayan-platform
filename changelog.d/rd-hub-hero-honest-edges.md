## 2026-09-24 · fix(event-hub): a wake's masthead is no longer told "You are invited"

`invitationCard` withholds the invitation card for the solemn register so a
funeral keeps its quiet masthead — but that masthead's eyebrow was
`PahinaMasthead`'s default, `'You are invited'`, and none of `site-body.tsx`'s
four mounts passed one. Verified by rendering before the fix: a wake's first
screen read "№ 01 · You are invited" on both the hero-media and text-only
branches. A new pure `mastheadEyebrow(words)` beside `invitationCard`
(`app/[slug]/_lib/invitation-card.ts`) returns `null` for the solemn register —
the masthead then renders the № alone, no new copy — and `'You are invited'`
for every other register, byte-identical. Every mount now resolves it.

Guarded by `app/[slug]/_lib/the-wake-is-not-invited.test.ts`: renders the
masthead for `WAKE_PROFILE` on both branches and asserts no
invit/celebrat/party word reaches the markup (sabotaged once — helper ignoring
`solemn` — and watched red), pins weddings/generic to "You are invited", and
walks `site-body.tsx` so an unwired fifth mount fails.

Also measured, not built: the launcher/poster cover still ignores a hero VIDEO
because no stored still exists for one uploaded via the site-chrome editor (the
Living Hero studio already writes its freeze still to
`landing_page_hero_image_url`, which the launcher reads). Storing one needs a
new column — out of scope here.

SPEC IMPACT: None.
