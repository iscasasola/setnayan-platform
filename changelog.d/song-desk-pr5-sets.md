## 2026-07-30 · feat(vendor): sets — a band thinks in sets, not in a flat list

Song Desk **PR 5**, the last item in `Song_Desk_BUILD_ORDER_2026-07-27.md`. Owner, verbatim 2026-07-27: *"the band can set 1/2/3/4/5/6 sets, and name the x number of songs per set"* · *"they can place songs per set. they can choose."*

### Both blocking answers DELETED work rather than adding it

- **Requests are always-on, not a mode** ⇒ there is no "only during the sets I choose", so **a set has no relationship to the request window at all**.
- **An accepted request is not filed into a set** ⇒ **no `from_request_id`** on the join, no set-picker in the accept flow. The prototype's "from a request" chip is a display affordance on the accepted list, not membership.

### 🚨 The one constraint that makes sets worth building

A set is anchored to `playlist_slot_type` — **the same eleven values the couple's playlist uses**, never a second vocabulary. The contract's warning *is* the design: if the band's sets say "After Party" while the host's picks say `open_floor`, the two lists can never be compared, "which destroys the entire point".

That anchor is the only reason the desk can say **"They asked for Through the Years at dinner — not in this set yet."** `name` stays the band's own label ("Slow burn", "Last call") and is never parsed or matched on. `grand_entrance` earns its keep immediately: a PH band's Set 1 usually *is* the entrance.

⚠ **The simplification, stated:** one slot per set. A real "Set 3 · Party" may straddle the tail of dinner and all of the open floor. Chosen because comparability is the point and an unanchored set can be compared to nothing — `slot_type` is therefore `NOT NULL`. If a set should span moments that is a `vendor_event_set_slots` join later, **not a nullable column now**, because a nullable anchor lets the comparison silently go missing — the exact failure the constraint exists to prevent.

### The schema decisions worth reading

- **1–6 enforced in the database** (`CHECK (position BETWEEN 1 AND 6)` + `UNIQUE (event_id, vendor_profile_id, position)`). The app is one of several possible writers, and this is the kind of rule that decays into "mostly six".
- **The join FKs `songs`, NOT `vendor_songs`.** A composite FK would look tidier but would **CASCADE-delete a placed set song the moment a band tidied their repertoire mid-event** — losing the setlist they are playing from. So "you may only place what you play" is enforced at the door (`addSongToVendorEventSet`) and never retroactively.
- **`UNIQUE (set_id, song_id)`** — twice in one set is always a mistake; twice in the *night* (two sets) is legitimate and stays allowed.
- **Gap-100 positions**, the same idiom as `event_playlist_picks.sort_order`, and deliberately not unique so a reorder cannot fail on a transient collision.
- **No `created_by_user_id` on either table.** A set belongs to the *business*, not to whichever crew member typed it — and adding a subject column would have demanded an erasure/export decision for data that is not about a person. Both RA 10173 guardrails stayed silent, which is the confirmation.
- **Audience: `current_vendor_profile_ids()` + day-of grantees**, the same helpers as every other song-desk surface. ⚠ Note the rank — that helper is owner ∪ team members **at admin rank or above**, matching every other per-booking vendor config; if a junior member should edit setlists the fix is that helper's floor, not a special case here.
- ⏭ **The HOST cannot read these.** A set is a working document; a band drafting "Set 4" should not have the couple watching every keystroke, and nothing in the brief asks for it. Showing the couple a *finished* setlist is a plausible next feature and an owner call.

### The UI

Last on the desk and **collapsed by default**: on the night the actionable things are the requests inbox and the gaps, so a band mid-set should not scroll past six expanded sets to reach a pending request. Create/rename/delete a set, place songs from the repertoire, remove them. **Nothing suggests anything** — "no auto-fill, no recommender" is explicit, so there is no fill button and no ordering hint.

`nextSetPosition` returns the lowest **free** number rather than max+1, so deleting Set 3 of 4 and adding again refills the gap — nobody should renumber their own night by hand.

### Tests

New `lib/vendor-sets.test.ts` — **18 tests**. Full `test:db:ci` **640**, `test:unit` **5515**, lint + `dup-rule` + `entitlement-gates` + `migration:check` clean.

**Both mechanisms verified killable:** making the crossing slot-blind (the contract's nightmare — every set answering for every moment) turns **2** red, and dropping the resolved-id pass turns **1** red. Baseline: **17** added facts, all from the two new tables, every column at `anon=-`.

SPEC IMPACT: **PR 5 built — the Song Desk build order is complete.** Recorded in `Song_Desk_BUILD_ORDER_2026-07-27.md` + `DECISION_LOG.md`.
