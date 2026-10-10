## 2026-10-10 · test(hub): the real guest page renders with no database, and is held byte for byte

Test tooling only — no page changes, `site-body.tsx` is not edited.

Nothing on a developer's machine could draw `SiteBody` (`apps/web/app/[slug]/_components/site-body.tsx`): an async
server component of some fifty props that reads the database, imported by one page and rendered by no test. "This
change leaves every guest page as it was" could only be argued. Now it can be shown:

- `apps/web/lib/site-body-fixture.ts` — one invitation as data (the Maker lab's Maria & Jose, 12 December 2026,
  Santuario de San Antonio → Seda Vertis North; a listed guest who has not replied), typed against the component's
  own props, plus a second page with one scene stored to leave by Scrub.
- `apps/web/lib/site-body-fixture-render.ts` — `renderSiteBodyFixture(overrides?)`: the REAL component, called as
  the page calls it. The seam is the database client alone (`lib/supabase/admin.ts` · `lib/supabase/server.ts`,
  replaced through the `Module._load` door the render tests already use) with an empty database behind it, so every
  loader runs its own code and lands on its own default; every read is recorded, a write throws. Pinned for the
  render and nothing else: the clock, the time zone (UTC), the default locale (en-US) and the page's environment
  switches. No byte of the HTML is touched.
- `apps/web/lib/site-body-fixture-render.test.ts` + `site-body-fixture.golden.html` — (1) it is the real guest tree
  and asks the database only for the listed tables; (2) two renders are identical and equal the committed page;
  (3) a page with no Scrub scene draws none of the hand-over's boxes and never mounts the island; (4) a scene
  stored to leave by Scrub is the plain page while Scrub ships dark, and the held pair the day it is switched on;
  (5) nothing in the app imports the tooling.

Found on the way (not changed here): the run of show's times on a guest page are formatted in the SERVER's default
locale (`formatBlockTimeRange`, `toLocaleString(undefined, …)`); and with "Scrub out" switched on by hand, a
Countdown stored to Scrub on the tabbed Invitation has nothing to hand over to (it is alone in its scenes block on
Welcome) while the page still wraps itself in one pair for it.

SPEC IMPACT: None
