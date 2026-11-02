## 2026-09-25 · fix(event-hub): each theme wears its own fonts

Event Hub Maker Phase 3 shipped nine of the ten themes reading a STAND-IN face
for their heading and/or their labels (`app/globals.css`'s own comments named
each one — "Cinzel stands in for Italiana", "Jost for Poiret One", …). This PR
downloads the real face for every named stand-in and points each theme's CSS
block at it:

- Modern (`galeriya`) heading: Instrument Serif
- Cinderella heading: Italiana
- Luxe (`velvet`) labels: Cormorant SC
- Whimsical heading: Yeseva One · labels: Quicksand
- Regency heading: Prata
- Great Gatsby heading: Limelight · labels: Poiret One
- Cyber Neon heading: Syne · labels: Outfit

Rustic (Fraunces) and Vintage (Playfair Display) already had their spec face —
no change. All ten faces are OFL, downloaded from `raw.githubusercontent.com/google/fonts`
(the `ofl/` folder), converted to woff2 with `fontTools`, and loaded via
`next/font/local` in `app/[slug]/_components/skins/site-skin.tsx` — the guest-page
skin, not the root layout, so a face only nine themed guest pages ever need is
never shipped to marketing/dashboard/admin. `OFL.txt` sits next to every family
under `apps/web/app/_fonts/`. `lint-fonts-are-local.mjs` and
`hub-fonts-are-loaded.test.ts` stay green.

A theme's BODY and script faces (Lora, Kaushan Script, Libre Baskerville,
Crimson Pro, Josefin Sans, Monoton, …) are not wired to a per-theme CSS var —
`globals.css` has no `--font-body` / `--font-script` hook for a theme to
override yet, so there was nothing to point at a face. That is a separate,
future delta, not a stand-in left in place.

The R2 upload of the ten themes' background loops/posters (Phase 3's
`upload-theme-loops-to-r2.ts`, dry-run verified: 18 files, 16.8 MB, exact keys)
could NOT be completed in this session — no working R2 credential is
configured on this machine. The `rclone` remote named `r2` has only
`type`/`provider` set (no endpoint, no access key, no secret); `apps/web/.env*`
in both this worktree and the main checkout carry no `R2_*` variable. Flagged
for the owner rather than guessed at.

SPEC IMPACT: None — the spec's font names (`lib/invite-themes.ts` `fonts.*`)
already stated Instrument Serif / Italiana / Cormorant SC / Yeseva One /
Quicksand / Prata / Limelight / Poiret One / Syne / Outfit; the code now
matches what the corpus already said.
