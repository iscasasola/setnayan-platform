## 2026-09-23 · fix(profile): a celebration card wears the celebration

Owner, having turned on his own public profile and looked at it: ***"the event cards look non
events"***. Measured on his three real celebrations rather than guessed:

| celebration | hero | std_theme | accent |
|---|---|---|---|
| Indalecio & Claire | none | `botanical` | `#9a244f` |
| Maria & Jose | none | `default` | `#9b7e00` |
| Movie Night | none | — | — |

🔑 **NONE has a hero image, so every card fell to the monogram branch — and every `monogram_color`
is the same default `#C97B4B`.** Three different celebrations rendered as three identical terracotta
discs on white, 85px tall, separated by a hairline, each ending in a `›`. The identity was never
missing: `EVENT_FIELDS` in `lib/public-profile.ts` selected the hero and the monogram columns **and
nothing else**, so the typeface and colour two of the three had already chosen were never read.

`lib/celebration-card-identity.ts` resolves the celebration's own Save-the-Date typeface, via the
shipped `STD_THEMES` table (the class is never re-typed here). **One new column, `std_theme`, and the
count is deliberate.**

🔑 **THE COVER ART NEEDS ZERO NEW COLUMNS, AND THAT IS WHY THE ONE IS WORTH IT.** `eventCardTreatment()`
in `lib/event-card-art.ts` — which already solved this exact complaint for the home cards in August —
derives a stable wash and crop from the `event_id` the select already carries. Executed against his
three real events it gives three distinct treatments. ⚠ **But two of them land on hues 204 and 214**
— ten degrees apart, both reading blue side by side — **and those two are his two WEDDINGS, the pair
that must be distinguishable.** "Distinct" and "distinguishable" are different words. Two blue covers
in different Save-the-Date fonts read as two celebrations; in one font they read as a rendering bug.
That is what the column buys.

`std_film_accent_hex`, `site_bg_color` and `site_button_color` were added, then **removed**: with the
cover carrying colour, an accent edge was a second answer to a question already answered, and every
column on a public read has to pay for itself. A guard asserts all three stay out.

**A default is never COUNTED as a choice.** `hasOwnIdentity` stays false when an event has no hero
and no theme, so "no identity yet" cannot be mistaken for a decision. His "Movie Night" is exactly
that case — a third of his page — and the cover's derived treatment (teal, angle 300°) makes it read
as a deliberate card rather than one that failed to load.

**The chevron is gone.** A `›` says "next item in a settings list", which is precisely what made a
celebration read as a row. The whole card is the link and needs no arrow to say so.

🔒 **THE PRIVACY CHECK CAUGHT TWO COLUMNS I WANTED TO USE.** This select feeds a PUBLIC page through
an admin client. Checked each candidate against `supabase/security/exposure-surface.baseline.txt`:
`std_theme` is `anon=S` — already publicly readable, so rendering it is no new exposure. But `invite_theme` (`capiz`) and
`moodboard_theme_name` (`Cale-Ice`) are **`anon=-`**, and both would have looked good on the card.
**"It renders nicely" is not a reason to publish a private field.** A guard now fails if any of
those, or `story_cover_*`, or `role_palette` reaches that select. The exposure baseline itself is
unchanged and still passes, correctly — it tracks GRANTS, and no grant moved.

⚠ `story_cover_kind` was investigated as a fourth art source and is not one: closed vocabulary
(`hero|capture|vendor_frame|monogram|upload`), **NULL on all 12 events in prod**, and its own column
comment says "nothing reads it yet". Recorded so the next reader does not re-investigate it.

Watched sabotages, each red on its own assertion, every file restored to a verified hash: add
`moodboard_theme_name` to the public select → the privacy case fires, printing the leaked column;
put the chevron back → the card case fires; and (from the earlier colour-carrying cut, kept in the
record) counting a default as a choice, and skipping hex validation, each fired on their own case
before those paths were removed.

⏸ **NOT IN THIS CHANGE, and deliberately:** the account's profile photo in the header. It is
`anon=S` at the grant level, but the only adjacent consent — `share_profile_photo_with_hosts` — is
scoped to *"the couple running an event you have joined"* and defaults to OFF. **A grant is not a
consent**, and no mechanism here asks "did they agree to THIS audience". Held pending the owner's
word; the initials disc stays, which is what 16 of 17 accounts show anyway.

🪤 **AND A FALSE GREEN THAT COST A TYPECHECK — TWICE.** The page's CSS lives in a ~430-line template
literal. A backtick in a comment I added ENDED THE STRING and the file stopped parsing; every
targeted test stayed green because `tsx --test` strips types and the guard reads that file as TEXT.
Only `tsc` saw it. **I then broke the parse a second time while writing the warning about it**, with
a backtick in the warning. A guard now asserts zero backticks and zero `${}` inside that block —
cheap, and invisible to everything else.

SPEC IMPACT: None — no locked decision, SKU or price. This renders identity the couple already chose.
