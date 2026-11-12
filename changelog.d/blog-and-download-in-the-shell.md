## 2026-11-12 · fix(shell): every public page wears the shared shell — the old glass nav renders nowhere

Owner: *"these are on old shells"* (www.setnayan.com/blog and /download), then
*"check around the whole website"* → *"Yes, move them"*. Seven public pages still
wore the older glass nav + reskin footer, so a press from any other public page
swapped the whole header.

- move `page.tsx` for `/blog`, `/download`, `/creators`, `/our-story`,
  `/monogram`, `/tl/about` and `/waitlist` into `app/(shell)/` (URLs unchanged);
  their sections / motion / studio files stay in their old folders, and
  `/blog/[slug]` stays where it is with its own reading masthead
- `NAV_ROUTES` in `site-chrome.tsx` is now EMPTY on purpose — the glass nav
  renders on no route; `FOOTER_ONLY_PREFIXES` (`/blog/<article>`,
  `/help/<article>`, `/tour`) still get the reskin footer
- all seven join `DOORWAY_BLEED_PATHS` (each caps its own content); null
  `loading.tsx` like every shelled page; per-page `revalidate` / `force-static`
  removed — the shell layout sets force-dynamic for the group
- `/waitlist`'s outer `<div>` becomes its `<main>` (the shell renders a div for
  the doorway variant; every page owns its own main)
- five NAV_ROUTES guards used a "stable member" as their non-vacuity control; with
  the set empty they now probe the parser on a one-member declaration instead,
  and the doorway guard asserts the set stays empty
- guard: `app/(shell)/old-shell-pages-wear-the-shell.test.ts` (sabotage: put
  `/blog` back in NAV_ROUTES → red); path updates in tests and baselines;
  regenerate port-control, design-rules and Ugat screens baselines
- the port-control scanner (`scripts/port-controls.mjs`) read only a route's own
  folder, so a page moved into a route group silently dropped the sections it
  left behind (/creators lost `/realstories`, `/signup` and 19 blocks; /for-suppliers
  had the same gap since 2026-11-04). It now also reads the same path with the
  `(group)` segment removed — own files + private folders, never child routes, and
  only while that folder serves no page of its own. All eight moved pages keep
  every control they had on main; /features, /help, /panood, /papic and
  /realstories regain files they had lost. Held by a new case in
  `port-guard-reach.test.ts` (fails without the fix)

Not changed: the reading pages `/blog/[slug]`, `/help/[slug]` and `/tour` keep
their own top banner plus the reskin footer.

SPEC IMPACT: None
