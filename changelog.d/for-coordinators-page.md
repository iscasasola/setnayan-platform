## 2026-11-04 · feat(for-coordinators): the For Coordinators page, ported from the 4 Nov prototype

New public page `/for-coordinators` (`app/(shell)/for-coordinators/`), inside the shared shell and
full-bleed. Sections in the prototype's order: the photo hero (three photos cross-fading, the whole
photo shown from 1024 px wide with its `--dr` push), the free kit, up to twelve problems ("With Setnayan"),
how it works with the couple (four steps, each drawn from the couple's real screen), one login for
every event, and the close. Both calls to action open `/open-shop` — a coordinator is a supplier.

- Shared pieces for the 4 Nov marketing pages, in `app/_components/marketing/`: `photo-hero.tsx`
  (`PhotoHeroSlides`), `problem-scenes.tsx` (`ProblemScenes`) and `photo-page.css`. Motion reuses
  `_pa-motion.tsx` (`LineRevealHeading`, `RevealBand`, `RevealList`).
- Copy follows the code where the prototype did not (owner accepted all of it 2026-11-04): no in-app
  calls (removed 2026-10-28), so the kit is at most nine tools; the show is moved forward by the
  coordinator and the couple; prep-then-release releases to the couple; no "Recommend an add-on" (no screen since 2026-10-02). The demo links (`/sample/coordinator`)
  do not exist, so the scenes link to `/schedule`, `/seat-plan`, `/guest-list` or `#how`, or show only
  their tag.
- Day-of tools are tagged plain "Free", no end date (DECISION_LOG 2026-11-04). No price typed.
- 16 photos copied to `public/marketing/2026-11-04/` under their prototype names.
- Registered: sitemap, robots, `DOORWAY_BLEED_PATHS`, `TOP_LEVEL_SEGMENTS`, the generated reserved-slug
  half, Ugat screens, the port baseline, the sideways-scroll e2e list.
- Migration `20271308786674`: `for-coordinators` added to `business_slug_is_reserved` (the last body,
  word for word, plus the one word) and to `DB_MIRRORED_RESERVED_SLUGS` — owner 2026-11-04, "add it".
  `KNOWN_DB_MINT_GAP` stays empty.
- Four lines show only while their switch is on (owner 2026-11-04): each supplier sees only their rows
  (`coordinator_run_of_show`), announcements (`coordinator_day_of_broadcast`), prepare-then-release
  (`coordinator_prep_release`) and private notes (`NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED`). Read
  live through the features' own gates; an unreadable switch reads OFF. The headings count what is
  shown ("Nine tools" … "Eight tools").
- Guard: `app/(shell)/for-coordinators/for-coordinators-says-what-ships.test.ts`.

SPEC IMPACT: None to the corpus — this ports `prototypes/for_coordinators_2026-11-04.html` (corpus);
the copy differences and the switched lines are the owner's 2026-11-04 answers, recorded in the PR.
