## 2026-09-03 · refactor(event-hub): the product card and the menu slot are one door

Owner ruling 2026-09-02, verbatim: *"do not use 2. i look at the roles of each. if it is the
same then adjust. Like in papic. when they enter an event, the menu of papic description page
becomes the control center of papic. i think that should be the same for events hub."*

The roles were measured and they were the same. `app/dashboard/[eventId]/website/page.tsx`
declared `metadata.title = 'Event Hub'` and called itself the calm landing for the couple's
public site; the catalog entry `landing-page` is labelled **Event Hub** with the CTA "Open your
Event Hub" and the blurb "One link for your whole event — the run-up page, the day itself, and
the story after", which is the controller's four channels written as prose. EH3 (#5108) shipped
the event-menu row wearing that same word and **flagged the collision for the owner rather than
guessing**. This is that ruling applied.

- `addOnHref('landing-page')` now resolves to `/dashboard/[eventId]/launch` — the Event Hub
  controller — following the `music-creator` / `live-studio-roam` idiom in the same ladder. The
  shape copied is `papic`: one page that is the shop window before the couple owns it and the
  control centre after.
- `/dashboard/[eventId]/website` is a **redirect stub** to the controller, in the shape of
  `website/launch/page.tsx` (retired 2026-07-25). The route is kept, not deleted — the Website
  Pro band, the Papic crew page, guest-columns, the invite step, `/event-page`'s redirect and
  every couple's bookmark still point at it.
- **Every `/website/*` child keeps its route** — editor · editorial · our-story · privacy ·
  hero-photo · colors · dress-code · what-to-bring · widgets · site-chrome · living-hero ·
  photo-moments · our-photos · special-message · stories. They are the controller's doors.
- Exactly one surface declares the name now: the controller's `metadata.title` went
  `'Your Event Hub'` → `'Event Hub'`, and `/website` declares none.

**THE CHIPS WERE RETIRED, DELIBERATELY.** The card carried two deep-link chips (Event page →
`/website/editor`, Editorial → `/website/editorial`) from the 2026-08-14 verdict, on the
reasoning "the hub is the map, and the two chips are the shortcuts". The card's landing is no
longer the map — it is the controller, whose own "set once" strip already carries both of those
destinations by name ("The page itself", "The story"). A chip beside the card would be a second
control for a door visible one tap in: the exact "distinction a couple can see is fake" that the
verdict existed to remove. The ruling's other option — deep-link into a channel the landing does
not select — had nothing left to point at; the controller carries all four public channels and
both editors. The replacement guard pins **reachability**, not absence, so stripping the
controller's strip fails rather than passing quietly.

**The rail would have tied, and that was settled rather than left to list order.** Two rows now
share the controller's href. `activeRailKey` breaks an equal score by list position, so which row
lit would have been an accident of how the shell composes the rail. The Studio row keeps the
`/website` family it still owns via a new optional `RailTool.matchPrefix`; the event-menu row owns
the controller. All four shipped rail answers are unchanged — the couple's experience of the rail
did not move; only where the Studio row's own button goes did.

Guards: `app/dashboard/[eventId]/one-event-hub-door.test.ts` (new — walks every `page.tsx` in the
app, so it can see a surface added next month, not just the files this change touched);
`studio-rows-are-lit.test.ts` gains a one-door assertion against the real builders;
`suite-doorway-guardrails.test.ts`'s chip test is replaced by its reachability successor.

SPEC IMPACT: None. The ruling is a nav/product consolidation, not a schema or SKU change; the
catalog entry, its label, its tier and its SKU mapping are all unchanged.
