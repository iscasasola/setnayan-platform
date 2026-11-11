## 2026-11-12 · fix(shell): /blog and /download wear the shared shell

Owner: *"these are on old shells"* — www.setnayan.com/blog and /download still
wore the older glass nav + reskin footer, so a press from any other public page
swapped the whole header.

- move `app/blog/page.tsx` and `app/download/page.tsx` into `app/(shell)/` (URLs
  unchanged); the story cards stay in `app/blog/_components/`, the download motion
  in `app/download/`, and `/blog/[slug]` stays where it is with its own reading
  masthead
- drop both from `NAV_ROUTES` so the glass nav is not drawn on top of the bar;
  add both to `DOORWAY_BLEED_PATHS` (each caps its own sections; the articles
  cover is edge-to-edge); null `loading.tsx` like every shelled page
- remove each page's `revalidate = 3600` — the shell layout sets force-dynamic
  for the group
- the three NAV_ROUTES parser checks named `/download` as their "stable member";
  repointed to `/our-story` / `/waitlist`
- guard: `app/(shell)/blog-and-download-wear-the-shell.test.ts` (sabotage: put
  `/blog` back in NAV_ROUTES → red); path updates in six tests and three
  baselines; regenerate port-control and Ugat screens baselines

Still on the old header after this (not changed here): `/creators`, `/our-story`,
`/monogram`, `/tl/about`, `/waitlist`, and the reading pages `/blog/[slug]`,
`/help/[slug]`, `/tour`.

SPEC IMPACT: None
