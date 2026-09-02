## 2026-09-03 · feat(events): a wedding records BOTH a ceremony and a reception venue

Owner: *"venue is 2. ceremony and reception"* · *"ceremony venue is civil
registrar, church, mosque, garden, etc."* The schema stored ONE. `events.venue_setting`
was already the reception venue in practice — the 3D Seating Lab renders it as the
room guests dine in, and `venueSettingToDirectoryType` maps it onto reception
`venue_directory_type` values only — while nothing in the schema said so, and
`events.ceremony_type` carries the RITE, not a place. There was no ceremony venue
column anywhere.

Migration `20271197508087` adds `events.ceremony_venue_setting` (nullable, no default)
and keeps `venue_setting` as the reception venue. **No rename** — the rename's risk
across 10+ readers was weighed and rejected by the owner; instead both columns now
carry a `COMMENT` saying which is which, because a name that does not say so is how
the two got conflated. Nine values, each reasoned in the migration header:
`church` · `chapel` · `mosque` · `temple` · `civil_registrar` · `garden` · `beach` ·
`ancestral_house` · `hotel_venue`. **No value encodes a faith** — `ceremony_type`
already does, and `inc` therefore gets no `inc_chapel` of its own (`inc` + `chapel`
already resolves to the directory's INC chapel; a dedicated value would make one fact
true in two columns). `garden` and `beach` deliberately appear on both lists: sharing
a word is not sharing a fact.

`civil_registrar` moves to the ceremony list ONLY (owner). It is where you marry,
never where you dine, and `venue-settings.ts` had said so in prose for a month while
the CHECK went on accepting it — so a paid "Make it real" render could have billed a
couple for a banquet inside a registrar's office. **A CHECK cannot be added while a
row violates it**, so the migration runs its `UPDATE` first, unconditionally: the
registrar moves ACROSS to `ceremony_venue_setting` (COALESCE, so a couple who already
answered keeps their own answer) and the reception falls back to `banquet_hall`.
Production held ZERO such rows on 2026-09-03 (`select venue_setting, count(*) from
public.events group by 1`), so the replay can never exercise the case on its own —
`tests/db/two-venues-ceremony-and-reception.db.test.ts` therefore reconstructs the
pre-migration world and asserts the narrowing **raises 23514 without the UPDATE**, so
those two statements cannot be reordered silently.

`buildPrompt` (`lib/reception-scene.ts`) referenced the venue **zero times**, so a
garden wedding and a ballroom wedding produced a byte-identical brief and the couple
paid for whichever room the model felt like. It now takes an optional
`ReceptionVenue` and names the room. 🔑 **`banquet_hall` is never asserted from a bare
read.** Not because of a column default — that was dropped in `20260521080000` — but
because both writers stamp it when the couple never answered (`create-event`'s
`?? 'banquet_hall'`, whose form field *does not exist*; onboarding's `DEFAULT_VENUE`,
commented "the couple refines it later"), while `events_wedding_fields_consistency`
forbids NULL on a wedding row. So on that column "chose a ballroom" and "never said"
are the same bytes. `receptionVenuePhrase()` refuses that one value unless the caller
passes positive evidence, and falls back to the exact generic opening the brief always
had — less specific, never wrong. Omitting the argument reproduces the old output
byte for byte, so no existing call site changes.

The couple can now set the ceremony venue on Personalization
(`details/_components/governed-fields.tsx`), in the same row idiom as the other
governed fields and directly above the reception venue, whose label changes from
"Venue setting" to "Reception venue". It deliberately does **not** run the
booked-vendor conflict preview: migration `20260617000000` established outright that
ceremony venues are filtered on `ceremony_type` and faith and NEVER on a venue
setting, so wiring one in would invent a conflict rule nobody specified — and the
button says "Save" rather than "Check & save" so it cannot claim a check it never ran.
The blank option SAVES, clearing to NULL, because unlike the reception column this one
can hold "haven't decided".

The mood board's inspiration board already had BOTH a `venue` slot labelled "Ceremony
venue" and a `reception_venue` slot — the UI had been distinguishing them while the
data could not. Confirmed; unchanged.

⚠ Removing `civil_registrar` from `VENUE_SETTINGS` also narrows the vendor
compatibility picker, which derives from it. That is correct rather than lossy: the
array is only ever matched against `events.venue_setting`, which can no longer hold
the value, so the tag could never match again. Rows already carrying it are left
alone.

Also refreshed `supabase/security/exposure-surface.baseline.txt`, which was **already
stale before this change**: of its 20 new lines, ONE is this change
(`events.ceremony_venue_setting`, `authenticated=SU`, matching
`moodboard_theme_name`); the other 19 are `moodboard_style_family` (`20271197327520`)
and the whole `moodboard_theme_templates` table and policies (`20271194462267`),
both already merged on this branch and never baselined.

SPEC IMPACT: `DECISION_LOG.md` — new row (2026-09-03) recording that a wedding records
two venues, that `venue_setting` is locked as the RECEPTION venue with no rename, and
that `civil_registrar` is a ceremony venue only.
