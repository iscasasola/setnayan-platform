## 2026-09-05 · feat(moodboard-gallery): the questionable photo reaches a human, and the refused one reaches its supplier (MB21)

MB11's content screen had two outcomes — clean, or refused at the door. The
owner's rule has three, and the middle one had nowhere to live: a flagged photo
arrived in the admin queue **byte-identical to a spotless one**. And an admin's
only refusal was `retireAsset`, which hid the photo and said nothing, so the
supplier's own editor went on reading *"draft (pending review)"* forever, with
no reason and nothing to fix.

**The rule, as shipped:**

| | Outcome |
|---|---|
| QR code · any URL · any social handle · any email · the vendor's own name, phone or logo | **hard block at upload**, message names what was found |
| unfamiliar name · phone-shaped digit run · logo-ish mark · heavy text | **flag → admin queue** |
| clean | draft → admin approval, as before |

🛑 **"No names" is deliberately NOT a block.** Couples' names on backdrops,
welcome signs, monograms and stage lettering are the design itself in the
`backdrop` and `stage` shelves; blocking them would gut two categories.
`lib/chat-contact-filter.ts` is still not imported here, for the reason its own
docblock records.

- **Migration `20271205821681`** — `screen_findings JSONB`, `rejected_at` and
  `rejection_reason` on `moodboard_library_assets`, the last two paired by
  `moodboard_library_assets_rejection_paired` in the shape
  `rights_warranted_at`/`rights_warranty_version` already established on this
  table. A blank reason is refused too. All three columns are **REVOKED** from
  `anon` and `authenticated` — a new column inherits the table-level grant
  silently, and this table has a PUBLIC read policy, so the inherited grant
  would have published every photo's transcribed text and let a supplier clear
  their own `rejected_at` with one HTTP request (RLS is row-level, never
  value-level). Post-conditions assert MB11's `source_event_id` denial survived
  the re-granted allow-list.
- **`lib/moodboard-screen-findings.ts`** (new, zero imports) — the finding
  vocabulary, its severity map as a `Record` over the full union, the three
  outcomes and both human-facing sentences. It is its own file because both
  MB21 renders are `'use client'` and `lib/moodboard-gallery-upload.ts` reaches
  `lib/supabase/admin.ts` through the taxonomy.
- **Widened blocks + the queue's flags** in `lib/moodboard-gallery-upload.ts`;
  `screenGalleryImage` now returns `outcome` and a ready-to-store `findings`.
  One sentinel line was appended to the vision prompt for the logo-ish mark
  MB11 named as residue — parsed and **stripped** before any text rule reads it.
- **Admin** (`/admin/studio?tab=moodboard-library`, extended, no new page) — a
  `ScreenFindingsPanel` on the photo, `⚑ needs review` in the queue list, and
  reject-with-reason beside Publish. Approving clears both halves of the
  rejection.
- **Vendor** — a `RejectionNotice` in the existing library editor, worded like
  the hard-block messages: *"We couldn't publish this: there's a phone number
  on the sign behind the cake."*

**Guards, each seen RED before it was trusted:** the finding reaches the ADMIN
render (mount and paint pinned separately — deleting the mount left all five
paint tests green); the reason reaches the VENDOR render; a URL/handle/email is
blocked with a message naming it; **a couple's names are flagged, never
blocked** (sabotage: `unfamiliar_name: 'block'` → red); and the text screen
still fails open and visibly as `textScreen: 'unavailable'`, re-pinned because
this session moved code around it.

SPEC IMPACT: Iteration 0010 (Moodboard Library) — the supplier upload screen now
has three outcomes rather than two, and admin review gains a reject-with-reason
action. Applied to the corpus.
