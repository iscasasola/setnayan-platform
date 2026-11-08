## 2026-11-08 · chore(train): train 2A — the clean, finished PRs in one branch (merge after train 1)

Owner, 8 Nov: *"Make these go live now."* One merge commit per PR (`git merge --no-ff`); generated maps and baselines regenerated once on the merged tree. Each carried PR keeps its own `changelog.d/` fragment.

- #7361 one email at sign-up — Supabase's confirm email is the welcome (owner pasted the template, 8 Nov)
- #7358 "The day's program" — the Schedule row says who decides what guests see of the day
- #7388 Ceremony essentials is a real category (migration)
- #7380 approving a supplier who joined from your link takes their contact corrections
- #7376 an unchecked "in business since" year reads as the year alone
- #7364 grand event-type and category photos
- #7356 the seat plan opens for guest booths, performers and AV production (migration)
- #7230 a sponsor's Remove is the card's swipe, with Undo
- #7229 the budget's rows delete by their swipe, with Undo
- #6989 docs: the event menu reorganisation plan (one docs file)
- #6407 display-only map of what each kind of supplier can see (train: lists #7356's three new seat-plan categories)
- #7308 demo shop Setnayan Productions; suppliers read "Hub" (train: two scanner lines that landed on main after it say "the guests’ page")
- #7328 /for-suppliers draws the owner-approved 6 Nov page (carries #7263's shell move, which it was built on)
- #7269 /for-coordinators, built from the 6 Nov approved prototype (base: #7263's branch)
- #7385 Inquire opens one pop-up; "Plan with Setnayan" retired on shop pages (stacked on #7382, so it carries #7382: Back from a shop goes where you came from)

SPEC IMPACT: None from the train itself. Carried PRs' own lines stand (see each fragment): #7361 DECISION_LOG 2026-11-07 "ONE EMAIL AT SIGN-UP" — the corpus template note "`signup_door` does NOT exist in the metadata today" is out of date (it is passed: couple · supplier) · #7308 suppliers read "Hub", reversing the 2026-08-28 "Event Hub" room name (owner to confirm) · #7358 `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 12 "The day's program" → BUILT · #7388 DECISION_LOG "Ceremony essentials" (2026-11-07) · #7380 DECISION_LOG 2026-11-07 approve-takes-corrections rows · #7376 DECISION_LOG 2026-11-07 "AN UNCHECKED YEAR IS THE YEAR ALONE" · #7356 `03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md` § 7 (seat plan reaches Booths, performers, AV).
