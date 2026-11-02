## 2026-08-14 · feat(suite): five doors for one product become one "Your Website" card

Website Adjustment Session 2. Closes the last open item of
`Event_Studio_Replot_Council_Verdict_2026-07-17.md` — **owner sign-off #2,
2026-08-14: _"yes. same as the menu on admin and shop."_** Sign-off #1 was given
on 2026-07-17 and its Tab-1 refile has been blocked behind #2 ever since; both
ship here.

### Verified already shipped — nothing rebuilt (RULE 0)

- **The unified website editor** (`Design_Unified_Website_Editor_2026-07-25/`).
  Untouched. This change moves DOORWAYS only.
- **`/studio/event` and `/studio/editorial` already redirect** into the editor
  (`studio/[addon]/page.tsx`). **No route is removed by this PR**, so the "301
  every retired doorway / nothing may 404" requirement needed no new redirect —
  the cards are retired, the routes are not.
- **`addOnHref('landing-page')` already resolves to the `/website` hub**, which
  already links the editor, Our Story, the invitation, privacy and Editorial.
  Retiring the part-cards therefore costs no reachability.
- **The retirement mechanism already existed**: `studioGroup: 'utility'` is how
  photo-delivery was retired on 2026-07-22 — card leaves both hubs, entry and
  every deep link stay alive. Reused, not invented (a flag flip beats new
  schema).

### What a person gets

One card that says **Your Website**, with **Event page** and **Editorial** as
chips inside it, instead of five cards that were all the same product. Save the
Date and RSVP keep their own rows — each owns its own SKU / its own guest-tool
job, and chipping them would be a miniaturized re-dupe of the defect being
fixed. Every old link still works.

Planning tools also stop being filed as identity: **Mood Board · Seat Plan ·
Indoor Blueprint** move out of *Branding* into the plan section (verdict §2
defect 5). Branding is now honestly pure identity — monogram · custom QR ·
Pakanta. Section labels and the owner-locked 4-section count are untouched.

### Two corrections to the brief, both measured

1. **The brief said five website doorways and named five. There are six** — it
   omitted `event`. Six is what makes its own "the four parts become chips"
   line coherent: 1 umbrella + 1 paid upgrade + 4 parts.
2. **The brief said all four parts become chips. The verdict says exactly two**
   (Event page · Editorial), with Save the Date and RSVP keeping standalone
   rows, and gives the reason. The verdict is the dated design authority and the
   brief itself says to read it, so the verdict is what shipped.

### A defect this change introduced and then removed

`appStoreDetailHref` carried a `landing-page` special case sending the card to
`/website/editor`. With the card renamed and chipped, the card and its own first
chip would have landed on the **identical page** — a distinction a couple can
see is fake. The special case is deleted; `opensDirect` already routes the card
to the `/website` hub. Card → the hub, chip → the editor, chip → the editorial
editor: three distinct destinations.

### One thing surfaced, deliberately not changed

The Editorial doorway is `tier: 'free'` and its CTA reads *"Edit your
editorial"*, but editorial **editing has been a Website PRO perk since
2026-07-22**, so `/website/editorial` renders a PRO lock for a free couple. That
predates this PR and is a pricing/SKU call, not an engineering one — surfaced,
not touched.

### Guards (all five mutation-proved, occurrence counts printed before → after)

`suite-doorway-guardrails.test.ts` gains four tests, and its free-layer list is
updated as the conscious diff it is designed to force:

- the website section is exactly one doorway + the two parts that own their job;
- a retired part-card keeps its entry, its group and a working doorway (deleting
  the entry is what strands raw slugs on the ~33 surfaces reading this catalog);
- the chips are MOUNTED, are two, resolve, differ from each other **and from the
  card's own href**;
- the Tab-1 refile holds and Branding stays pure identity.

Mutation run: five sabotages, every one landed (counts moved) and every one
turned the suite red; baseline and restored both green. A sixth sabotage
restoring the `landing-page` special case proves the card-collision assertion —
rev 1 of that guard compared the chips only to each other and would have passed
while the card and chip 1 pointed at the same page. Rev 1 of the harness itself
was wrong twice: it counted `key: 'seating',` (which the mutation never touches)
and cried "did not land" on a sabotage that had, and its chip mutation edited a
COMMENT containing the path rather than the href.

Verified: typecheck 0 errors · 8012/8012 unit tests · all 24 `lint-*.mjs` +
`next lint` clean. `pnpm build` cannot run on this machine; CI is the build
claim.

SPEC IMPACT: `Event_Studio_Replot_Council_Verdict_2026-07-17.md` — §7 ship-order
steps 2 and 3 are now SHIPPED; §2 defect 1's chip list is annotated (the phase
routes it assumed became retired redirects on 2026-07-25); §9's "delete the
indoor-blueprint entry" is marked SUPERSEDED by owner 2026-07-23 (Indoor
Blueprint is free, not removed) and was NOT executed. `DECISION_LOG.md` row
2026-08-14.
