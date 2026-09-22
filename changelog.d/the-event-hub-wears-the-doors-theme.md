## 2026-09-22 · feat(event-hub): the pages behind the door wear the couple's theme

Owner: *"wedding websites looks gorgeous and ours just looks like plan website"*,
then — correcting a wrong answer of mine — ***"we have event hub themes"***.

**He was right, and the correction is the most useful thing in this entry.**
`lib/invite-themes.ts` has carried five since 2026-09-10 — **House** free plus
**Capiz · Velvet · Galeriya · Abaca** on Event Hub Pro, his own words: *"elegant,
classy, sophisticated, rugged, and generic… Generic is the Free. The other 4 will
be the Event Hub Pro service."* **Four paid and one free**, exactly as he
remembered it. A first pass here reported no theme system existed and began
building a second one; that was measured against a checkout **2,521 commits
behind `origin/main`**, where the invite themes had not landed yet. The invented
`site_theme` column, its vocabulary and its picker were **discarded before any
commit**. Nothing of it ships.

**The real gap was narrower and better defined:** `invite_theme` was read by
exactly three files, all under `app/[slug]/invite/`. The door was themed;
everything behind it — save-the-date, RSVP, event, editorial, recap, pabuya —
was still the one Clean-Editorial look. Owner ruling, this date: the pages wear
the theme the couple already picked. **One choice, one picker, one purchase.**

**What shipped**

- `app/[slug]/_lib/hub-look.ts` — the theme resolution, lifted out of
  `load-invite-look.ts` so both surfaces share it. The gate is not simple (a Pro
  theme needs the unlock live *now* **and** a celebration type that carries the
  Save-the-Date film, and either can lapse after the couple saved), and two
  copies would mean House on the door and Capiz on the page, each passing its own
  suite. The expensive reads still run only for a Pro theme.
- The four themes' **material** moved out of the door's `.module.css` files into
  one attribute-scoped block in `globals.css`, keyed on
  `[data-invite-theme='x'], [data-hub-theme='x']`. It had to: the site cannot
  import a door stylesheet (`themes-stay-skins.test.ts` — no theme may reach the
  shared chunk), so an attribute block neither surface owns is the only place one
  definition can sit. `DoorShell` now stamps `data-invite-theme` from a new
  `DoorSkin.themeId`, which is **load-bearing** — without it every `var(--cz-*)`
  in a skin resolves to nothing and the door renders unpainted.
- `app/[slug]/_components/skins/` — the site's own grounds, in the site's chunk,
  plus the themes' **own faces**: Bodoni Moda over Jost for Velvet, Schibsted
  Grotesk for Galeriya, Alfa Slab One over Oswald for Abaca. Capiz brings none by
  design; its door sets the seal in the house Cormorant.
- Each material mapped onto the page's existing tokens — paper, plate, metal,
  and the twelve `pahina-*` ornament switches (grain, printed frame, rule
  length), which are now themed with **today's values as their fallbacks**, so
  a House event computes byte-identically to before.

**⚖ Owner decisions, both asked and answered this date**

- On an event with a spatial RSVP backdrop **and** a theme: the **backdrop wins
  where it applies**. The couple picked that scene deliberately and per-phase; a
  theme arriving later must not overwrite it. The theme's ground shows on every
  phase without one.
- Reach: **every guest page**, not the main phases first. A couple whose
  invitation is Capiz and whose recap is Clean-Editorial reads that as a broken
  theme, not as a page nobody got to.

**Four real defects, found by looking and by the guards — every one renders as
success**

1. 🔴 **`bg-cream` painted straight over the ground.** The shell's `<main>` is
   opaque and the ground is a fixed layer beneath it. The attribute stamped, the
   material resolved, every token correct — and a couple who paid for Velvet got
   a white page. Found on a screen, not by a test. Now guarded on both branches.
2. 🪤 **A shipped guard keyed on BASENAME.** `themes-stay-skins.test.ts` matched
   theme stylesheets by filename, and the site's new `capiz.module.css` is
   deliberately named after the theme it paints — so it reported every correct
   file as importing the door's. Re-keyed on the **full path**, and its property
   widened to the real one: a theme's stylesheet is imported only from its own
   surface's folder.
3. 🪤 **Three guards pinned to a location that legitimately moved** — the kraft
   contrast measurement, the weddings-only fence, and the column list. All three
   re-anchored to where the fact now lives; none relaxed.
4. 🪤 **My own guard convicted its own prose**, twice, before it convicted any
   code — the editor row's comment says `pro: true` while explaining why the row
   must not carry it. Both now read comment-stripped source.

**Measured, not guessed.** Three ground decisions were sized against the 4.5:1
floor rather than by eye, and two of them changed the design: Capiz's milk band
runs 0.82→0.62 instead of the door's 0.70→0.40 (the door's thinnest band holds
ink at **2.65:1** over a black photo — fine there, where no body text sits on it,
not fine on a page); **Abaca's ground carries no photo at all**, because a black
photo multiplied into kraft at any useful opacity puts ink at **3.27:1** on the
gradient's lower pull; and Velvet gained a flat 30% scrim, because its velvet is
mixed from the couple's own accent and a pale accent leaves the ground at
**3.00:1** — the scrim takes the worst case to **5.13:1** and is invisible on any
ordinary dark accent.

**Guards:** `app/[slug]/_components/skins/the-site-wears-the-doors-theme.test.ts`
— 9 assertions, **7 sabotages, every one proven to land and every one caught**
(two of the seven initially reported "caught" on an edit that had silently
matched nothing; they were re-run with the occurrence count printed).

SPEC IMPACT: `Design_Premium_Guest_Site_2026-07-25` — the guest site gains the
theme axis it did not have, sourced from the invite themes rather than invented.
Applied to the corpus in this commit.
