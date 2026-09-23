# My Shop — the four remaining fixes, as plans

Written 2026-09-23 while builds are stopped. **Nothing here has been built.**
Every measurement cited was taken before the stop; where a plan needs a number
nobody has, it says so as a question rather than going to get it.

⚠ **A plan is not evidence.** Re-run each "confirm first" line before building —
the tree will have moved.

---

## #5 · The venue question is asked of caterers

**Symptom (owner):** *"Why does it ask me what kind of venue I am when I am a
catering service."*

**Delta.** `VenueTypeCard` mounts in `shop/page.tsx` inside the `profilePanel`
fragment of the `d1` "Your shop" section. Gate the mount on the shop's coverage
including the venue category. The fact already exists — `vendor_coverages` /
`bucketForVendor`. **A gate, not new state; no migration, no column.**

**Must not touch.** The card itself, its action, or `vendor_profiles.venue_type`.
A venue shop's experience is unchanged.

🪤 **The trap, already paid for.** A grep finds the mount LINE, not its enclosing
JSX — `[[a-block-in-the-jsx-is-not-a-block-that-renders]]`. **Confirmed
ungated on 2026-09-23** by scanning every `? (` and `&& (` between the
`profilePanel` opener and the mount, not by reading the one line. Re-confirm that
way, not by eye.

**Open question:** none. Owner ruled; the mechanism exists.

---

## #6 · Two writers for one website

**Symptom.** `PublicLineCard`'s "Your website" writes `vendor_profiles.website`.
The verification Documents step's social block writes the `social_media` doc's
JSON, and its FIRST slot is labelled **"Website"** (`SOCIAL_PLATFORMS[0]`,
`lib/vendor-verification.ts`). `docs-body.tsx` contains **zero** references to
`vendor_profiles.website`. Deep search reads `profile.website`, so a supplier who
fills the Documents one **is invisible to search while looking at a filled box
labelled Website.**

**Owner ruling (verbatim, relayed):** *"this is where they place the social media
links of their shop."* → the **verification card is the home**; `PublicLineCard`'s
field is the duplicate.

🛑 **The constraint that outranks the shape of the fix.** The social block is part
of a submission an admin REVIEWS. His ruling says which field suppliers should
fill; **it is not a decision to publish unreviewed data.** So the public column
may take its value from the verification one **only once reviewed — never on
write.** If a design cannot avoid an unreviewed value reaching `/v/[slug]` or deep
search, **stop and ask him.** That is a new question, not a build decision.

**Must not touch.** `docs-body.tsx`'s other nine platforms; the review workflow.

**Open question:** does the public column update at review time, or does the
Documents slot simply stop being called "Website"? The second is a copy change
and cannot leak. **Recommend asking before building.**

---

## #4 · Two Save buttons among eleven neighbours that save themselves

**Symptom (owner):** *"Why add save buttons?"*

**Measured 2026-09-23 — scope is the PROFILE PANEL, not the page:**

| saves on change/close | has its own Save |
|---|---|
| `ProfileChecklistEditor` (8 rows) · `VenueTypeCard` · `PublicLineCard` · `VisibilityCard` — **11** | `VenueMatchCard` · the business-start-date form — **2** |

**Delta.** Bring those two onto the panel's behaviour.

🛑 **Must not touch — and this is the whole risk.** `autoreply-card` (3 Saves) and
`docs-body` (2) are **different panels with multi-field forms and stay exactly as
they are.** Page-wide the split is 8 vs 7, which is arguable either way; the
panel-scoped 11 vs 2 is what makes this a defect. **A page-wide "make it
consistent" would strip Save off two correct surfaces.**

**Open question:** none for the mechanism. ⚠ If the date form's Save goes, its
server action must still report failure — already fixed on
`rd/the-shop-says-when-it-could-not-load`, do not undo it.

---

## #2 · EST 2002 vs Business start date 10/01/2012

**Symptom (owner):** two fields, one fact, disagreeing on his own shop.

**Measured 2026-09-23 (prod, select only):**
`shops 3 · has_year 2 · has_date 1 · has_both 1 · both_and_disagree 1`
**Every row that can disagree does — and it is his.** A backfill is one row, so
cost is not the issue; **direction is.**

🛑 **THE TRAP, AND IT KILLED THE ORIGINAL BRIEF.** The brief was *"make the date
the truth and derive the year from it."* **Do not build that.**
`in_business_since_year` is a **verified** column: writing it through
`updateVendorProfileField` sets `runYearExperienceReset`, which clears
`experience_verified_at` / `experience_verified_by` when the year changes — an
admin checked it against a DTI document. `updateBusinessStartDate` has no such
coupling. **Deriving the year from the date hands a supplier a second door onto a
verified fact with no lock on it**: edit the date, the year moves, the badge
survives. `in_business_since_year` is read by `/api/v1/vendor/profile`, the public
`/v/[slug]` page and the admin verify queue.

**Delta (controller's ruling, 2026-09-23):** the **verified column is
authoritative by construction**. One fact, the year wins, the date stops being a
second unguarded door.

**Open question — HIS, and unanswered:** *is his real start 2002 or 2012?* If 2012
and the verified 2002 is simply wrong, this enshrines the error on his public
page. **One word. It does not block the build; it blocks the backfill.**

---

## 🛑 Off limits — #7 is an APPROVAL

Owner, verbatim, on the *Where else you show up (optional)* card: **"this is
nice."** Leave it exactly as it is. *"Fix it all"* does not revoke a specific
approval given in the same walk. **The approved card is allowed to be
inconsistent** — and a page-wide tidy is precisely what endangers it.

**Five things a page-wide framing would have damaged on this page, all caught:**
#7's card · `autoreply-card`'s Saves · `docs-body`'s Saves · the six *logged*
soft-probes · `card-record-section`'s deliberate zero-suppression.
🔑 **Audit and fix per PANEL, and name the panel in every finding.**
