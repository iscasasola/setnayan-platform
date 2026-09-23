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

---

## 2026-09-23 · feat(profile): coming up, and past

Owner: ***"split coming up from past"***, after asking ***"why do we see the 2 upcoming events as
well?"***

🔑 **HIS QUESTION WAS UPSTREAM OF THE LAYOUT.** He was not asking for two headings — he had noticed
that **an invitation and a memory were drawn identically**. Two identical grids under two headings
would satisfy the words and miss the point. So the difference lives at SECTION level: Coming up
leads at full weight; Past is smaller, quieter and set back. The title keeps its ink colour in both
— a memory should be calm, not hard to read.

There was no date filter at all before this: the gate was public-visibility AND the type's `website`
surface, nothing more.

⛔ **THE SPLIT DOES NOT COMPARE DATES.** `isFinishedEvent` in `lib/event-board.ts` is already the
product's answer to "is this over", and it reasons about three things this module would otherwise
re-derive: `archived` (finished whatever the date says), `event_end_date` (a multi-day celebration
is not finished on its first morning — the same value the full-res retention floor reads), and a
NULL date (not finished, so a dateless celebration sits under Coming up, which falls out of the
existing rule rather than being a special case invented here).

⛔ **AND IT DOES NOT DECIDE WHAT "TODAY" IS.** `manilaTodayISO()` does, because these are Philippine
celebrations and a wedding is upcoming until it is over **where it happens**. `lib/event-board.ts`
records a live bug from exactly this: the board's shelf boundary and the countdown on the same card
once reduced "now" with two different clocks and disagreed between Manila 00:00 and 08:00.

**One new column, `event_end_date`** (`anon=S`, already publicly readable). **Zero prod events carry
one today**, so it is behaviour-neutral now and correct the first time somebody sets a range — the
same reasoning `isFinishedEvent`'s own docblock records.

**Order is part of the answer:** Coming up is soonest-first, because the next thing is the useful
thing, and a dateless celebration sorts last since it cannot be next; Past is newest-first, because
a memory is read backwards from now.

**A section renders only when it has cards.** A couple with nothing behind them must never meet an
empty "Past celebrations" heading — that reads as a page that failed rather than a life that has not
happened yet.

**Both sections call ONE card renderer**, extracted in this change. Two copies of the card is how
the split would recreate the very defect it exists to fix, arriving from the other side; a guard
asserts one definition and two call sites.

Three watched sabotages, each red, both files restored to verified hashes. 🔑 **The first is the
instructive one:** replacing `isFinishedEvent` with a direct date comparison **still produces the
right answer for his page** — Movie Night behind, two weddings ahead — while silently breaking
multi-day and archived events. A fixture that happens to pass is why the delegation matters.

⚠ Verified against his real data: **Movie Night (20 Aug 2026) is already past**, so his own profile
exercises the split immediately — one card below, two above.

SPEC IMPACT: None — no locked decision, SKU or price.

---

## 2026-09-23 · feat(profile): which poster a celebration prints

Translating the approved prototype (`build-sessions/prototypes/public_profile_icecasa_FABLE3_2026-09-23.html`,
three owner iterations). `lib/celebration-poster.ts` decides which of the three sheets a celebration
prints — the sheets are his, the CHOICE between them is derivable so a fourth celebration gets the
right one without anybody hand-assigning it.

| sheet | when | what it is |
|---|---|---|
| `letterpress` | no accent | ink on house stock — **plainness as intent**, not a failure |
| `moon` | accent cannot carry a letter | a white disc holds every word, in ink |
| `sheet` | accent can | white type directly on the colour |

🔑 **THE CHOICE IS CONTRAST, NOT TASTE**, and the prototype's own CSS says so: *"Gold cannot carry
text, so the art makes room."* Measured with this repo's `contrastRatio`: wine `#9a244f` carries
white at **7.67** → sheet; gold `#9b7e00` at **3.90** → moon, and it fails on ink too (**4.46**), so
it can hold *neither* — which is exactly why the art gives the words their own white ground. The
threshold is WCAG AA for normal text: a name set on a sheet is reading matter.

⛔ **THE FIX IS NEVER A DIFFERENT GOLD.** His accent is the colour he chose for his own
Save-the-Date film; a poster that "solves" contrast by nudging the hue has taken his decision away
from him. A sabotage that darkens gold to pass is one of the three below, and it fires.

**A theme earns its ornament only on a coloured sheet.** Sprigs and capiz panes are white at low
opacity — on house stock they would be invisible, and a credit line naming art nobody can see is
worse than no credit. So a themed-but-plain celebration prints plain and says nothing it cannot show.

**Two more columns, deliberately: `std_film_accent_hex` and `invite_theme`.** The earlier "one column"
call was wrong for this design — the posters are BUILT on the accent, and `capiz` is what draws
Indalecio & Claire's panes. ⚠ **`invite_theme` is `anon=-`, unlike the other two, and that was
checked rather than waved through:** it is already selected by `app/[slug]/_lib/hub-look.ts` and the
public recap and pabuya pages, so it is already rendered on the couple's own public site. The grant
governs direct PostgREST reads, not secrecy — adding it here exposes nothing a visitor cannot see by
opening the celebration itself. The exposure freeze was re-run deliberately for both and passes.

Three watched sabotages, each red, file restored to a verified hash. 🔑 **The first repeats a pattern
worth naming:** hard-coding `#9b7e00 → moon` instead of measuring **still produces the right answer
for all three of his events**, and breaks the moment a pale colour appears. Right-for-his-data is not
right.

⏭ **STILL TO TRANSLATE:** the markup and CSS of the three sheets themselves (frame, sash, moon,
capiz panes, sprigs, playbill ornaments, `cqw` sizing). This change is the decision layer only.

SPEC IMPACT: None.

---

## 2026-09-23 · feat(profile): the past shelf stops at a screenful

Approved: a first screenful of past celebrations, then one control — **"Show all 14"**.

`pastShelf()` caps at **6** — two full rows at the two-column breakpoint, so the cap lands on a row
edge rather than mid-row at either width; a number that cuts a row in half looks like a rendering
fault rather than a deliberate stop. The label states the **total**, not the remainder: "Show all 14"
is a promise about the shelf, where "Show 8 more" asks the reader to do arithmetic to learn the same
thing.

⛔ **NOT A PAGINATOR** — no new state, no route, no second query. The split already sorts Past
newest-first, so a plain cap always keeps the celebrations that matter most.

⛔ **AND THE POSTERS DO NOT SHRINK AS THE LIST GROWS.** Making each memory smaller to fit more of
them turns a wall of celebrations back into the list of rows this redesign exists to remove.

It degrades at both ends with no special case: at 1 there is no control (his page today), at exactly
6 there is still none because nothing is hidden, at 7 it appears, and at 40 there is still exactly
one.

### Two corrections the guards caught, both deliberate reversals

🪤 **A CONTRAST FIGURE MEANS NOTHING WITHOUT THE COLOUR IT IS AGAINST.** Two sessions computed "gold
on ink" and got 4.46 and 3.66 — **both right**, against `--sn-ink-900` #1B1A17 and `--m-ink` #2C2A29
respectively. The one that governs is the ink the poster actually sets type in: **3.66**. The
conclusion is unchanged and firmer — gold carries neither white (3.90) nor ink — but 4.46 reads as
"nearly passing" and 3.66 does not. The comment now names the ink and the test pins it.

🔒 **`std_film_accent_hex` came back, and the guard caught the reversal.** It was dropped when the
cover art carried the colour; the approved poster design makes the accent **the sheet itself**. A
column that stopped paying for itself started again when the design changed. `site_bg_color` and
`site_button_color` never came back.

🔑 **And `invite_theme` left the banned list with its reason attached.** It is `anon=-`, exactly like
`moodboard_theme_name` — the marker that got that one refused. The difference: `invite_theme` is
already rendered on the couple's own public site, so a visitor can see it by opening the celebration.
**Same marker, opposite answers — the grant governs direct reads, not secrecy.** The guard now
asserts the justification itself: if `hub-look.ts` ever stops reading `invite_theme`, it stops being
public information and this select is no longer entitled to it.

SPEC IMPACT: None.
