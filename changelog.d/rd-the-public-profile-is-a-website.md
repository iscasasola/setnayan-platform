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

---

## 2026-09-23 · feat(profile): the account's own face, and a switch that says what it publishes

Owner, selecting the initials disc: ***"use the profile photo of the account"***. The shipped page
had no avatar at all — the disc he pointed at was in the prototype — so this adds one: the photo
when there is one, the initials when there is not. **16 of 17 accounts have no photo**, so the disc
is the common case and the photo is the enhancement, not the other way round.

⚖ **THE CONSENT QUESTION WAS ASKED AND ANSWERED BEFORE ANYTHING WAS BUILT.** `profile_photo_url` is
`anon=S`, so the database would have allowed this silently. But the only adjacent consent —
`share_profile_photo_with_hosts` — is scoped to *"the couple running an event you have joined"*,
opt-in, defaulting to OFF (owner 2026-09-20). **A grant is not a consent**, and no mechanism in this
repo asks "did they agree to THIS audience". Put to the owner directly; his words: ***"yes, turning
it on is the consent"***. So the photo is gated on `public_profile_enabled` and nothing else — and
an owner PREVIEW of a switched-off profile deliberately shows no photo, because the consent is the
switch and the switch is off.

🔑 **AND THE SWITCH NOW SAYS SO.** Its help text promised *"lists only celebrations you've made
public"* and said nothing about a face. Under this ruling that sentence is **part of the consent**,
not a description of it, so it now reads *"shows your name, your profile photo and the celebrations
you've made public."* Somebody turning it on to share a wedding list should not discover afterwards
that it published their photo.

⛔ **TWO CONSENTS ABOUT ONE PHOTO STAY TWO.** `share_profile_photo_with_hosts` is not read, not
written and not folded in — its file is untouched. A guard asserts **zero** references to it in the
public path (comments stripped) and that the toggle's text still names the photo. The failure it
prevents is one column doing two jobs: the moment the public path reads the hosts flag, the narrower
consent silently starts meaning something wider than the person agreed to.

**The stored value is not an `<img src>`** — it is `r2://bucket/key`. It goes through the app's own
`displayUrlForStoredAsset` (which fails closed for a non-public bucket, so a private ref yields null
and the initials show), and the RESULT then goes through `renderableImageSrc`, the same guard the
event hero uses, because this is a public page.

Two watched sabotages, each red, both files restored to verified hashes: fold the hosts consent into
the public select → the two-consents guard fires, printing the reference count; revert the toggle
wording → it fires on the text.

🪤 **The new guard failed against correct code on its first run.** It anchored on the first
`/u/${currentSlug}` in the profile page — which is an unrelated `publicProfileUrl` line — and so
measured the wrong string. Re-anchored on `help={`. A guard anchored on the first match faces the
wrong cell.

🪤 **And my sabotage backups keyed on `basename`**, so `app/u/[userSlug]/page.tsx` and
`app/dashboard/(account)/profile/page.tsx` shared one backup slot. Nothing was lost here — checked
rather than assumed — but it is the same shape as the mutation run that once overwrote a guest list
with a booth. Key on the full path.

SPEC IMPACT: None in code terms, but the ruling is recorded — public profile ON is consent to publish
the account photo (owner 2026-09-23), distinct from the hosts consent of 2026-09-20.
