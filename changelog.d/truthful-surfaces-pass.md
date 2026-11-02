## 2026-08-11 · fix(truth): twelve places the product told someone something untrue

Twelve small corrections in one pass — copy, one catalog map, one grid filter and
one migration of three `is_active` flips. No new surfaces, no new schema, no
renderer, no agree/decline flow, no wall on/off switch. Every claim below was
re-verified against shipped code and the live production database before editing;
two of the brief's own claims did not survive that check and are noted.

**Sold something that does nothing**

1. `PAPIC_ADDON_STORIES` (₱2,000) taken off sale. The guest story maker is
   owner-locked FREE and no code asks whether the add-on was bought. Already
   retired once for this reason (`20270328922621`) and reactivated as collateral
   of the blanket sweep in `20270710619774`. **Owner confirmed 2026-08-11.** Zero
   orders ever; the free feature is untouched.
11. `booth_studio` and `vendor_custom_included_token` switched off — two dead
    vendor rows sitting beside near-identical live ones on the admin pricing
    screen. `vendor_3d_booth` is the live twin. Verified first that the *feature*
    called Booth Studio is gated by an env flag, not by the billing row, and that
    nothing falls back to a hardcoded ₱100 when the token row goes dark.

**Said the wrong thing about what happened**

2. The supplier notification no longer says "You have a new confirmed booking".
   It fires when the COUPLE marks a vendor booked; the vendor has not agreed to
   anything yet. Now "A couple marked you as booked". The stored `type` enum is
   deliberately unchanged — renaming it would be a phantom enum value.
6. "Your stream is not running" removed from the two multi-camera failure
   sentences. Both are reached AFTER the single-camera broadcast is persisted and
   its watch URL written, so the show is on air; only the extra cameras failed to
   join. Now "Your stream is still on air from the camera you started with".
3. The booth-reel form no longer promises a server-side render and an emailed
   link within the hour. It renders in the visitor's own browser on the next
   screen, which is why that screen says to keep the tab open.

**Promised something nothing can deliver**

4. The e-gift preview no longer says "This is what guests see" while the public
   guest route is switched off and guests get a 404. Three states now, not two;
   the flag was already a prop and simply was not consulted.
5. "We'll email you when these vendors are live" → "Thanks — we've noted your
   interest". Nothing can send that mail: the signup table has no admin surface
   and no daily-email job. Both tables are empty, so nobody was left waiting.

**Priced or labelled wrongly**

7. The onboarding livestream card pointed at the retired `PANOOD_SYSTEM`, which
   is `is_active=false`, so the catalog read dropped it and the card rendered
   **₱0** for a ₱2,999 product. Repointed at `LIVE_STUDIO`. Same defect fixed on
   two other keys on 2026-07-21; this key was missed.
9. `LIVE_WALL` "In build" → live. The hold said the WebSocket display surface
   was not built; no WebSocket was needed — the venue route, screen-code claim,
   projection surface, couple controls and guest mirror all ship. It was selling
   at ₱2,500 while the price list called it unfinished.
12. The photo-wall card described a venue projection only. It also mirrors to
    every guest's phone, which is part of what the couple already pays for.

**Duplicated or unlabelled**

8. One livestream tile in the Studio, not two. The retired "Live Studio Cast"
   tile is filtered from the grid when the unified Live Studio is live — both had
   been landing on the same paid page, and the retired one chipped "Free".
   Filtered at the grid's own gate rather than removed from the shared catalog:
   fifteen modules import it, several look that key up, and a test pins it. The
   retired destination's own header had named this exact defect and stopped
   short of it ("the catalog tile that points here is not ours to delete").
10. The guest event hub had no page title, so a guest bookmarking the day-of page
    saved our marketing title. Static title — the event's name sits behind an
    access gate and must not leak into a bookmark on a noindex route.

**Two brief claims that did not survive verification**

- The brief said the booth-reel flow's "ready-email" works. No email exists on
  that path; the renderer hands back a Download button. The new copy describes
  only what was verified.
- The brief pointed item 5 at a second signup surface in create-event. That
  server action has **no UI caller at all** — nothing imports it — so there was
  no second promise to reword.

SPEC IMPACT: Yes — `Pricing.md § 00` and the corpus `CLAUDE.md` SKU section:
`PAPIC_ADDON_STORIES` is off sale (a free feature, never a paid add-on), and
`LIVE_WALL` is live rather than "in build". Applied directly per the standing
2026-06-04 direct-edit authorization.
