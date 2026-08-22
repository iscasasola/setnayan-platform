# WHAT IS LEFT — the register, carried into the monorepo

**Written 2026-08-07 for a session on a different account or machine.**

> ## 🛑 READ THIS FIRST, IT IS THE WHOLE POINT
> 
> **A HANDOFF IS NOT EVIDENCE. Verify every line below against shipped code
> and the live database before acting on it.**
> 
> This file exists because that rule was broken repeatedly on 2026-08-05/07 —
> including by the session that wrote it. Details in "How this went wrong"
> at the bottom. Read that section before you trust anything here.

## Why this is in the code repo and not the spec corpus

`~/.claude/.../memory/` **does not travel between accounts or machines.** The
corpus is a second repo you may not have. Everything a fresh session needs to
continue is therefore copied HERE, in the monorepo, on purpose and with
duplication accepted.

Source of truth order, unchanged: **live site → shipped code at `origin/main`
→ live prod DB → this file → anything dated older.**

---

## How the register was built

**87 claims** taken from the spec corpus, the dated handoffs and the memory
index, then **verified against shipped code on `origin/main` and the live
production database** — never against the document that made the claim.
Survivors were handed to a second pass told to REFUTE them. **58 survived.**

Anything that could not be confirmed was dropped rather than carried forward
as a maybe.

⚠ **`[OWNER]` means there is no engineering left.** It needs a signature, a
price, a sentence or a ruling. Building around those does not unblock them.

---

## 1. Armed to go wrong the first time a real customer arrives

*Every one of these is harmless today only because production is still empty — no orders, no photos, no live events. Each one starts costing money, losing a record, or deleting something the moment the first paying customer shows up. They are grouped because they share the same deadline (before launch, not after) and each is a small, self-contained fix — they should be swept in one pass rather than found one at a time by a customer.*

**7 items · 1 need the owner · 6 are engineering**

- **Extra photo cameras can be switched on without paying** *(medium)*
  - A couple who orders extra wedding cameras can turn the shooting credit on for themselves before they have paid a peso, and the payment screen will still show the order as unpaid. Nobody is alerted. No orders exist yet, so nothing has been lost — but it arms the moment the first person buys.
  - <sub>evidence: The camera-credit grant has no caller check, no paid check, and never matches the order to the event; it is still callable by an unauthenticated key and is listed as exploitable in the security baseline. The order row that arms it is written at apply time, before payment. Prod: 0 orders.</sub>
- **A receipt attached to a vendor payment is silently thrown away** *(small)*
  - A couple logs a payment to their florist and attaches the bank-transfer screenshot. The payment saves, the screenshot does not — it vanishes with no error and no way to tell. It has been that way since the end of July.
  - <sub>evidence: The uploader was switched to the private bucket on 2026-07-30; the validator still only accepts the old public paths and drops a non-matching reference to NULL by design. The unit test that should have caught it uses a hand-typed prefix no uploader produces. Prod: 3 payment rows, 0 with a receipt.</sub>
- **The photo-deletion job's own warning label says it is in safe mode; it is not** *(small)*
  - The one piece of code that permanently deletes couples' original photos carries a warning saying it deletes nothing unless switched on. It is switched on. Anyone reading it before touching that area would believe nothing can be deleted. No photos exist in production yet, so nothing has been lost — that is timing, not a safeguard.
  - <sub>evidence: Header claims dry-run-by-default; the actual gate is on-unless-explicitly-disabled, and the inline comment says so. The same comment says 90 days while the constant is 183. Flagged in the decision log 2026-07-20, unchanged on main.</sub>
- **A Google account someone disconnected still has its access key stored** *(small)*
  - Someone pressed Disconnect on their Google account ten days ago and we are still holding the key that opens it. The fix that stops this happening went in the day after they disconnected, and nobody cleaned up the one already there.
  - <sub>evidence: Live prod: the revoked grant (2026-07-26) still holds a 103-char refresh token with the real Google prefix and a 253-char access token. The wipe-on-disconnect code is dated 2026-07-27 and no backfill was run.</sub>
- **Cameras past the fourth are dropped from the broadcast and nobody is told** *(small)*
  - If a host connects more than four cameras, the extra ones silently never make it onto the stream. No warning appears anywhere — the host finds out during the wedding, or not at all.
  - <sub>evidence: The provisioner counts and returns a skipped-over-cap number with zero consumers anywhere. Live default cap is 4; the product ceiling is 12. Latent — prod has 0 channel-pool rows.</sub>
- **The list that decides whether a paying host sees Launch or Buy is empty for the photo service** *(small)*
  - There is an empty slot where the list of things a host can buy for the photo service should be. Nothing reads it yet, so nobody is hurt today — but this is the same empty slot that once showed a host who had already paid a Buy button instead of their control room. Fill it before anything starts using it.
  - <sub>evidence: The add-on stats map leaves the photo entry as an empty array behind a to-do comment; prod holds 5 active photo catalog rows. No caller passes it today.</sub>
- **The face-matching files load from a free public address that throttles under load** **[OWNER]** *(medium)*
  - Every guest phone downloads the face files from a free public address that slows down under heavy use. At a 300-guest wedding that can stall or fail. The suggested fix — our own web address for those files — needs the domain moved to the storage provider, which we deliberately have not done. So it is either accept the limit or make an infrastructure decision.
  - <sub>evidence: Owner actions log records the public storage host (verified HTTP 200) and flags it as rate-limited, recommending a custom domain before a packed live event. The domain sits on a registrar that is not the storage provider's DNS, which the custom-domain route requires.</sub>

## 2. What we have put in writing is not what the product does

*These are all the same defect in different documents: a sentence a guest, a couple, a lawyer or the privacy regulator can read that the product does not honour. They belong together because the fix is one editing pass over the same small set of documents, plus one decision from you about which version of the photo promise is the real one — and because being caught contradicting our own written record is the expensive part, not the engineering.*

**7 items · 1 need the owner · 6 are engineering**

- **We tell guests their photos are kept forever and tell the regulator we delete them after five years — and nothing does either** **[OWNER]** *(medium)*
  - A guest reads two different promises about the same photos on the same product: the page they upload from says the photos are theirs forever, and the privacy page says we delete them five years after the wedding. Neither is enforced today. Whichever one is wrong is a promise made to every couple and every guest.
  - <sub>evidence: Three live guest-site surfaces say kept permanently; the privacy page says purged after 5 years with a 90-day hot window. No media retention job exists among the 16 registered periodic jobs, the retention sweep is chat-text only, and no cold-storage transition exists anywhere.</sub>
- **The privacy notice promises we automatically delete connected TikTok and Google Drive accounts; nothing does** *(small)*
  - We tell people in writing that we throw away their TikTok and Google Drive connections a month after their event, on their own. We don't. The identical sentence was already removed from the YouTube section because it wasn't true — the two sections next to it kept it.
  - <sub>evidence: Both sections still carry the 30-days-after-the-event line; the page's own engineering note (added 2026-07-27 when the YouTube section was rewritten) says never to promise an automation that does not exist. The refresh job refreshes and never deletes.</sub>
- **The compliance pack we hand out is two weeks behind the fixes made to close its gaps** *(small)*
  - If you download the compliance pack today to answer a lawyer or the privacy commission, it is missing everything written in the last two weeks — including the exact paragraphs added to fix the gap. It would look like nothing was done.
  - <sub>evidence: The shipped records-of-processing PDF last changed 2026-07-23; the amendments closing the outstanding gates are dated 2026-07-31 to 2026-08-02 and exist only in the markdown source.</sub>
- **Four rows of the compliance register still say photos are stored in the Philippines** *(small)*
  - We fixed the public page to stop saying photos sit in the Philippines, because they do not. The internal record we would file still says it in four places, including the row about the wedding photos themselves.
  - <sub>evidence: Four rows still read APAC/PH; the 2026-07-31 correction was applied to one row and to the public privacy page only.</sub>
- **The register describes a photo-keeping rule we replaced — three months on paper, six in the product** *(small)*
  - The paper says we keep the big original files for three months; the app keeps them for six. Telling a regulator one number while doing another is the kind of small mismatch that costs credibility.
  - <sub>evidence: Register row states 90 days hot plus a 30-day post-download compression rule; the shipped job implements the owner-locked 6 months from the event's first capture.</sub>
- **A guest who buys shots without an account is not described anywhere in the compliance record** *(small)*
  - A guest at a wedding can buy more shots without ever making an account. Doing that takes their typed name and the payment screenshot they upload. Our written record of what personal data we handle covers customers and suppliers — it never mentions this person at all.
  - <sub>evidence: Drafted as a row on 2026-07-30; the 2026-08-02 pass folded in five other rows but not this one. The payments row still lists data subjects as customers and vendors only.</sub>
- **Face matching is switched on for every event and the sales page still says it does not exist** *(medium)*
  - Photos finding people by face is genuinely running now. The page selling the service still says it only works if someone scans a QR code — written back when the feature really was off. We are hiding a capability we have, and the next person to read that page will keep other screens narrow for a reason that expired.
  - <sub>evidence: Prod: all 5 events are in the face-matching mode, the privacy control is active, and the model files return 200. The public photo page still states the matcher is dormant and offers only ready-to-be-matched.</sub>

## 3. Nothing can move until you sign, or until someone outside replies

*Four items where there is no engineering left at all. Each needs the owner acting as data-protection officer — a signature, a confirmation, or an application to an outside body — and no amount of building advances any of them. Grouped because they can all be cleared in one sitting, and because two of them are already selling to real people while unsigned.*

**4 items · 4 need the owner · 0 are engineering**

- **Guest photography is selling without the privacy paperwork signed** **[OWNER]** *(small)*
  - Guests are already shooting and already buying photo credits, but the written record of what is done with their photos, and the tick-box wording they agree to, has never been signed off by you as data-protection officer. The wording also changed yesterday, so any earlier approval would be out of date anyway.
  - <sub>evidence: Two named gates marked still open in code with a note that the sale went live 2026-07-29 without them; corpus delta still pending DPO. The consent wording was rewritten and merged 2026-08-05.</sub>
- **One live privacy control is running with no recorded approval — the only one of twenty without a signature** **[OWNER]** *(small)*
  - One automatic action can hide a vendor's listing without a person deciding it. Every other privacy-sensitive capability on the internal board has your name and date against it saying you approved switching it on. This one has the approval line blank — which is the exact record the board exists to produce.
  - <sub>evidence: Prod: 20 controls all active; 19 carry approver and date, the anti-fraud one has both NULL and was seeded active on 2026-07-22, never touched. Its own migration notes it fires unguarded on every couple review submit.</sub>
- **The legacy-preservation brief was corrected; nobody can confirm the lawyer received it** **[OWNER]** *(small)*
  - We told a lawyer in writing that keeping a dead relative's memories would be free forever. That is now a paid service that stops when someone stops paying. The corrected document is written and ready — the only open question is whether it actually reached the lawyer, and only you know.
  - <sub>evidence: Brief and its Word mirror both corrected 2026-07-30 23:47 with new priority questions. Live compliance task for routing the packet to external counsel is still not started, and no send is recorded anywhere.</sub>
- **Child-safety image matching: the code is written and parked, waiting on an outside provider** **[OWNER]** *(small)*
  - We can already block photos that look explicit. We cannot yet recognise a photo already confirmed as child abuse material — that needs an outside organisation to accept us, and they have not replied in three days. Nothing in the product is waiting on engineering.
  - <sub>evidence: The hook PR is open as a draft (last updated 2026-08-02); the decision is enrol and sign, then merge. Provider verification email never arrived, fallback contact form unanswered as of 2026-08-02. The explicit-content filter is live and is a different control.</sub>

## 4. Security: one lock deep, and watching instead of blocking

*Four items that share a shape — the protection was designed and then left one step short of finished. Nothing is leaking today, but in each case there is no second layer behind the first, so a single mistake becomes an incident rather than a near-miss. They are grouped because they are all settled by the same person in the same sweep, and because two of them are a single switch.*

**4 items · 0 need the owner · 4 are engineering**

- **Internal figures are readable by outsiders because summary views skip the usual rules** *(small)*
  - Any signed-in person — including a competitor's supplier account — can read how many vendors are stuck waiting for approval, how many signed up last week, and how slowly support replies. Separately, anyone at all can work out how many of a vendor's finished jobs were written off as fake.
  - <sub>evidence: Prod: the bottleneck summary is SELECT-able by any authenticated role; the unfiltered completed-events count is SELECT-able anonymously beside the deliberately filtered public one, so the difference is computable. Materialized views are not covered by row-level security, which is why the table-level</sub>
- **More than half the database still hands out a read permission nothing uses** *(large)*
  - More than half the database leaves a door unlocked that nothing needs open. One correctly written rule inside each table is the only thing keeping strangers out — there is no second lock behind it. Nothing is leaking today; the risk is that one mistake in one rule becomes a leak instead of a near-miss.
  - <sub>evidence: Prod 2026-08-05: 382 public tables, 306 grant anonymous SELECT, 212 with no policy admitting it (down from 243 on 2026-08-01). Anon also holds TRUNCATE on 308 tables, authenticated on 345, and row-level rules are never consulted for TRUNCATE. Anonymous sign-in is enabled. Do not mass-revoke.</sub>
- **The browser protection is measuring only, and the measurements go nowhere** *(medium)*
  - If someone ever injected a script into a page, the site would currently watch it happen rather than stop it. The plan was to watch for a while and then switch protection on — but nothing keeps a record anyone can read, so that switch-on moment never arrives by itself.
  - <sub>evidence: The report-only header ships; the enforced one covers framing only. The report endpoint ends at a console warning — no table, no error tracker — despite a comment claiming otherwise.</sub>
- **Compromised-password checking is switched off on sign-up** *(small)*
  - People can sign up with a password already known to be stolen and posted publicly, and nothing warns them. It is one switch in the database console.
  - <sub>evidence: Supabase security advisor, 2026-08-05: leaked-password protection not enabled. Dashboard toggle, not a code change.</sub>

## 5. Half-built: the app reads a setting nobody can set

*Ten items with one identical cause — the reading half shipped and works, and the screen where a person types the value was never built. That is why they look like bugs to a user but are not: nothing is broken, the number is simply always the default nobody chose. They belong together because the missing piece is the same piece each time (a form field), one person can add several in a sitting, and the first two of them are why a couple can browse for suppliers and see nothing.*

**10 items · 2 need the owner · 8 are engineering**

- **✅ **SHIPPED as its own card — My Shop → Business Profile → "Weddings you're a fit for". DO NOT REBUILD** (verified 2026-08-19: a dedicated server action writes both `compatible_venue_settings` and `compatible_ceremony_types`). ~~A supplier cannot say which kinds of venue or ceremony they serve** *(medium)*
  - Every business on the site is stuck saying it only serves ballrooms, gardens and heritage houses — a value nobody chose and nobody can change. A couple whose reception is at a beach, a resort, a tent, a city hall, or a restaurant gets an EMPTY list of suppliers. Nothing errors; the page just looks like no supplier exists. Five of the eight venue choices a couple can pick land there.
  - <sub>evidence: The writer sits inside a save function with zero call sites (its own docblock calls it the untouched escape hatch); the live inline editor's field list has 10 entries and excludes it. Five readers depend on it. Prod: both vendors carry the identical column default. No database function writes it.</sub>
- **✅ **BOTH HAVE WRITERS — do not build a second form** (verified 2026-08-19: capacity via the vendor's own My Shop editor under the `venue_size` field key, per the owner's 2026-08-07 ruling; venue kind via the fit card above). 🔑 **An empty column is not a missing mechanism — grep for the WRITER.** ~~Nobody can enter a venue's guest capacity or venue kind** *(medium)*
  - Head count and venue kind never narrow anything. A couple planning for 500 guests is shown venues that seat 80, and a couple who said church is shown anything at all. The matching is written and working — it just has no numbers to work with, because there is no box anywhere for a venue to type them in.
  - <sub>evidence: Two recommendation paths read capacity and venue type; the only writer anywhere is the demo seed script. The admin venues screen writes a different directory table. Prod: all three columns NULL on both vendor rows.</sub>
- **No avatar maker exists for anyone — guests, couples or suppliers** *(large)*
  - Everyone in the 3D room is a randomly-coloured stranger. A guest, couple or supplier cannot make the little figure look like them, so nobody recognises themselves or anyone else when they walk the venue — which is most of the reason to walk it. The parts were finished weeks ago and are sitting unused; only the screen where a person picks their look is missing.
  - <sub>evidence: The config module calls the maker and its sanitizer future; the avatar column has zero writers. The figure component is imported by nothing outside its own file. Prod: 39 guests, 0 avatars. Six prototypes and a rig spec already exist from 2026-07-19.</sub>
- **✅ **SHIPPED — PR #4360, merged 2026-08-11. DO NOT REBUILD** (verified 2026-08-19: the couple's Live Wall card writes `live_photo_wall_visibility`, and three guest surfaces gate on the fused `guestWallMirrorActive()`). ~~The couple has no control over the photo wall guests see on their phones** *(medium)*
  - The record says every wedding is set to show only photos of people who were tagged, and the wall on guests' phones ignores that and shows the full screened feed. There is also no way to turn the wall off. A couple who wants the wall quieter, or off, cannot ask for it, and the setting the record says they have is not the one they get.
  - <sub>evidence: The visibility column ships with three options and a comment naming it the guest phone-card toggle; grep of the whole app returns zero occurrences — no reader, no writer. Prod: all 5 events sit at tagged-only while the guest wall renders the projector's screened feed.</sub>
- **The Live Photo Wall section on the couple's own website can never have photos in it** *(small)*
  - A couple who paid for the Live Wall gets a section on their wedding website that can never show anything, because there is no screen where anyone picks the photos for it. The wall on the projector at the venue works — this is the copy of it on the website, and it is permanently blank.
  - <sub>evidence: The section renders only when the photo array is non-empty and the SKU is owned. Nothing writes the array — no dashboard screen, no database function. Prod: 0 of 5 events have one.</sub>
- **The couple's pin-my-site-to-this-phase control exists only in the database** **[OWNER]** *(small)*
  - A couple can never pin their website to a phase — it always follows the clock. That matters because of the open question about when a wedding counts as live: an evening reception never falls inside the live window, and this is the escape hatch designed for exactly that and then never built.
  - <sub>evidence: Two columns added with a comment saying the couple pins one phase; zero occurrences of either name anywhere in the app or in any database function. Prod: 0 of 5 events are anything but automatic.</sub>
- **The founder perk cannot be given to anybody** **[OWNER]** *(small)*
  - The unlimited-categories perk promised to founding businesses is coded and working, and there is no way to mark anyone as a founder — so no business has ever received it, and none can.
  - <sub>evidence: Two service paths lift caps to unlimited on the founder marker. No writer exists in the app, in scripts, or in any database function. Prod: 0 of 2 vendors marked.</sub>
- **Vendors are told they can set how many date-holds they take, and cannot** *(small)*
  - A busy supplier is permanently limited to three couples holding the same date, and there is no screen where they can raise or lower it, even though the rule was written assuming they could.
  - <sub>evidence: Code states vendors can configure it (default 3, range 1-20) and enforces it. No writer in the app, in scripts, or in any database function. Prod: both vendors on the default.</sub>
- **A vendor's own captures are visible to them only during the wedding day itself** *(small)*
  - The photographer can look back at what they shot while the reception is still going, and then the view disappears at midnight. The next morning, when they actually want to check a shot landed, the door is shut — even though the photos are still theirs and the rules already allow them to look.
  - <sub>evidence: The page redirects unless the booked date equals today in Manila, and the strip is mounted inside that same page. The read policy already permits the vendor on any date, so this is a screen limit, not a permission limit.</sub>
- **The check built to catch this exact problem only looks at two things somebody remembered to list** *(small)*
  - The safety net added after the last two of these only looks at the two that were already found. Everything in this group slipped past it while it was green. It needs to check the whole database instead of a list someone types by hand.
  - <sub>evidence: The test hard-codes an array of exactly two switches and never enumerates the schema. Its writer detector only matches a literal inline update, so a column written through a built patch object also reads as unwritten.</sub>

## 6. Livestreaming: built in full, never once used, and still showing the retired version

*One product, ten loose ends, and they interlock — the same person in the same code, and most of them are only settled by running one fake event end to end. Two are waiting on Google, three are decisions only you can make, and the rest is retiring the old screens that still sell the version you stopped selling. Doing them piecemeal means running the rehearsal more than once.*

**10 items · 3 need the owner · 7 are engineering**

- **Nobody has ever streamed anything — the whole path is unproven** *(medium)*
  - Every part of livestreaming has been built but no wedding has ever actually gone out. Before the first paying couple, someone has to run a full fake event start to finish. Budget for the one-time 24-hour wait Google imposes before a brand-new channel's first stream.
  - <sub>evidence: Live prod as superuser (so an empty read is genuinely empty): channel pool, channel grants, roam streams and broadcasts all 0 rows; 0 orders platform-wide. Setup HAS been exercised — 1 zone, 16 camera operators, one real connect-and-revoke round trip on 2026-07-25/26.</sub>
- **Two Live Studio cards sit side by side and one sells a product that was retired** *(medium)*
  - A couple opening their Studio sees live streaming offered twice — one card says it is free with a single camera, the other sells it for ₱2,999. Tapping the free one drops them into an older setup screen for the version of the product you stopped selling. They can go through that whole flow and never see what they actually bought.
  - <sub>evidence: The old entry is not removed when the new one is added, and the Studio filter never checks whether the SKU is active. Prod catalog: new SKU active at ₱2,999, old one inactive at ₱2,500. Confirmed on the live pricing page. The old card's button leads to a setup screen with no guard.</sub>
- **The old camera screen still promises 3 free cameras and tells a paying couple they are on the free plan** *(small)*
  - Anyone who kept a link or bookmark to the old camera page is still told they get three cameras free, and someone who paid the ₱2,999 is told there they are on the free plan. This is the exact page the wrong three-cameras belief came from.
  - <sub>evidence: Page renders the free-camera count with no guard redirect; its tier resolver checks only the two retired SKUs, both inactive in prod. Reachable by direct URL or stale bookmark only — no live path links to it.</sub>
- **The unplug-my-YouTube-account button exists only on the old screen** *(small)*
  - Nobody is stuck right now — a host can still unlink their YouTube account. But the only button that does it lives on the old screen, so retiring that screen would leave people with no way to disconnect.
  - <sub>evidence: The disconnect endpoint is posted from exactly one place, on the legacy setup page, which has no guard so it still works. The current setup sheet has no disconnect, stream-key reveal or copy-watch-URL. Prod shows one real grant-then-revoke round trip.</sub>
- **No printable sheet for handing cameras to helpers on the current screen** *(medium)*
  - On the day, the host can only hand a camera to a helper by showing them a code on their own laptop screen, one at a time. There is no sheet they can print beforehand and hand around.
  - <sub>evidence: No print route exists under the current control tree; the only print pack sits on the legacy room behind the guard redirect. Partial mitigation: the current controller does render a per-camera join code on screen. Prod has 16 camera operators, so seats do get handed out.</sub>
- **A dead feedback screen nobody can leave feedback on** *(small)*
  - A leftover page showing an empty list of reviews for a feature nobody can review. Pure clutter.
  - <sub>evidence: Prod: the reviews table has 0 rows, ever, and no write surface exists anywhere. Note before deleting: the add-on stats module still reads the table, so the table and its stats prop must stay.</sub>
- **Do wedding recordings stay on the channel forever, or get wiped when the channel is reused?** **[OWNER]** *(small)*
  - When you reuse a streaming channel for the next wedding, does the previous couple's recording get deleted? The code currently keeps everything forever and refuses to delete. Two of your own written specs say to wipe it. Deleting a wedding cannot be undone, so this needs your word before anyone touches it.
  - <sub>evidence: The recordings module states the conflict outright and deliberately omits the delete call, because nothing records whether a broadcast carried video. Correction to the earlier handoff: the code has already chosen keep-forever. Two specs say wipe, one promises indefinite retention.</sub>
- **On a Setnayan-owned channel the couple gets a watch link, not a file** **[OWNER]** *(medium)*
  - After the wedding, the couple gets a private link to watch the recording — they do not get a video file they can keep. Whether that is enough, or whether someone has to hand them the actual file, is your call and no code has been written for the second option.
  - <sub>evidence: Implements the spec as written: YouTube auto-archives to an unlisted video and the app resolves a watch URL. The spec explicitly ruled out a parallel stored copy for V1 to avoid paying to store what YouTube holds free. No re-upload or admin hand-off path exists.</sub>
- **Nobody has ruled on whether YouTube's terms allow hosting paying customers' weddings on our own channels** **[OWNER]** *(small)*
  - The whole plan of streaming weddings from Setnayan's own YouTube channels rests on an assumption nobody has checked with YouTube. If it turns out not to be allowed, the penalty is losing streaming for every event at once, not one. Worth an hour of reading the terms, or a question to counsel, before the first paying wedding.
  - <sub>evidence: Recorded unanswered since 2026-07-25 and never resolved in the decision log. Letting a user stream to their own channel is unambiguously fine; pooling many paying customers onto channels we own is a different shape. The owner-locked pool model depends entirely on this.</sub>
- **The zero-cost YouTube route is still blocked by the Google account suspension** *(small)*
  - The free path to putting weddings on Setnayan's own YouTube channels is still waiting on Google to un-suspend the account. Nothing on our side can move it. Everything else on this list can be finished while it waits.
  - <sub>evidence: The organisation was created then suspended before the admin console was reached, so the one open question — is YouTube available to that kind of account — is unanswered, not answered no. Appeal case 73857927; its verification record must stay live. No resolution recorded and no related code has lan</sub>

## 7. Shipped, but the person who needs it cannot reach it

*Six features that work correctly and are invisible or half-open to exactly the person they were built for. Nothing here is broken and nothing needs designing from scratch — each is a missing button, a missing link, or a list that quietly leaves someone out. Grouped because they are all last-metre work, all small, and each one currently makes a finished feature look like it was never built.*

**8 items · 1 need the owner · 7 are engineering**

- **The couple's own coordinator has no button to message the emcee — only a booked supplier does** *(small)*
  - You defined the coordinator as the couple's own delegate — the person they promote. That person is allowed to send the emcee a note and has nowhere to press. Only a coordinator who is also a paid supplier gets the screen. So on a wedding where the couple's aunt is running the floor, the channel that shipped today is invisible to the one person who needs it.
  - <sub>evidence: The send box is mounted in exactly one place, inside the supplier dashboard. The prod policy already permits a promoted delegate with schedule edit rights, so this is a missing screen, not a missing permission. Matters more because the money-consent control is active, which suppresses the automatic </sub>
- **The emcee is not offered as a recipient when they were booked inside a bundle** *(small)*
  - If the host was hired as part of a bundle — say the band who also emcees — the coordinator's message box will simply not list them, and it will look like the wedding has no host. No error, no explanation; the name is just absent. Failure is safe, but the feature quietly does nothing on exactly the bookings you described.
  - <sub>evidence: The fetcher passes no service categories with an in-file comment admitting the per-service read is missing and that a miss means the send box does not offer them. The resolver already accepts categories. Owner stated 2026-08-01 that a stylist and an emcee can sit in one service.</sub>
- **A supplier can only send the coordinator six canned buttons — never a sentence** *(medium)*
  - On the night, a band or photographer can tell the coordinator one of six things. They cannot say give us two minutes before the last song, or the cake is melting near the lights. Since everyone reaches the host through the coordinator, this is the doorway that whole model depends on — and today it only opens six inches.
  - <sub>evidence: The whole vocabulary is six presets; the server resolves the body from the key so no free text can be posted. Prod: the inbox control is active, so the buttons are live and the sentence is the only missing part.</sub>
- **The host still cannot see who is holding which camera** *(small)*
  - On the day, the couple can see that four cameras are taken but not by whom, and cannot see which of their friends is about to run out of shots. The naming bug on the free camera is fixed and top-ups work; this last piece — a person against a camera against a number — is what is missing.
  - <sub>evidence: The crew page renders only Claimed/Open per camera, no holder name and no shots-left. Balances and reload exist, but on a different card that shows shots remaining per camera.</sub>
- **On the onboarding screen the AI planner card is a dead end** **[OWNER]** *(small)*
  - A new host reads about the AI planner, sees the price, then gets a sentence telling them to look for it later instead of a button. The only reason is that the event does not exist yet at that moment. Your call whether it should link on to the next screen or stay as a note.
  - <sub>evidence: The card renders a link only when a destination is supplied; nothing anywhere supplies one, so every host sees the fallback sentence.</sub>
- **A supplier keeps a deleted celebration's booking and cannot see it** *(medium · added 2026-08-22)*
  - When a couple removes their event, the supplier's booking is deliberately preserved — the record survives, detached, carrying what kind of celebration it was and when, so their completed-events count and their reviews stay whole. **But their client list is built entirely from the event, so a preserved booking has no row and no page to open.** They keep the number and lose the client. The survival is real; the way to look at it is missing.
  - <sub>evidence: verified 2026-08-22 by reading prod. The BEFORE DELETE trigger detaches the booking and stamps `event_type_at_delete` / `event_date_at_delete`; the completed-events view LEFT JOINs events and COALESCEs those snapshots, so counts survive. The clients surface keys every row and every link on `event_id`, so a detached row is unreachable. Prod: 45 bookings, 0 detached — nobody has hit it yet.</sub>
- **A supplier's own private notes die with the couple's event, contradicting our own erasure rule** *(small · added 2026-08-22)*
  - The notes a shop writes about a client — *chase the down-payment on the 15th* — are classified in our erasure module as the **shop's** data: they survive even a full account deletion, with only the staff author's name removed. But they are wired to vanish the moment the couple deletes the event. **The same note survives one deletion and not the other.**
  - <sub>evidence: `vendor_client_notes.event_id` is NOT NULL ON DELETE CASCADE (read from prod). `lib/erasure/coverage.ts` says of that table: "The note belongs to the vendor business and is read by it; only the staff author's identity goes." ⚠ Fix the row above FIRST — detaching a note with no client page to read it on is a survival nobody can reach. Prod: 0 notes.</sub>
- **The we-couldn't-load-this fix was built and no screen uses it** *(medium)*
  - When a screen fails to load someone's information, it still tells them there is nothing there. A guest saw an invitation that looked abandoned; a couple saw no requests yet over three real pending requests. The shared fix for that was finished three days ago and is sitting unused.
  - <sub>evidence: The six state components exist on main; the only import of that folder anywhere is its own changelog fragment. Zero screens use it. Three of the worst cases were fixed by hand instead on 2026-08-04.</sub>

## 8. The public site: three calls only you can make

*Three items about what the outside world sees and what we charge for it. None is blocked by engineering — each is waiting on a number, a sentence, or a scope decision that is yours by definition. Grouped because they are the same conversation and can be settled in one pass over the marketing site.*

**3 items · 3 need the owner · 0 are engineering**

- **The Filipino front-page words you approved were never put on the site, and no stream owns them** **[OWNER]** *(small)*
  - You approved new front-page wording on 31 July. It never went on the site, and because the homepage is deliberately outside the redesign, no piece of work is responsible for putting it there. Decide whether it ships on its own or gets dropped.
  - <sub>evidence: The homepage still renders the old line. The approved replacement is section 5 of the 2026-07-31 design brief. The design programme explicitly excludes the homepage, and the index flags the resulting scope gap as an open owner decision.</sub>
- **Five service pages were rebuilt to the new design and nobody can find them** **[OWNER]** *(small)*
  - Five pages that explain and sell your services — 3D plan, event website, Patiktok, Live Studio, animated monogram — plus the memories page can only be reached by typing the address or arriving from Google. Nothing on your own site points to them. Either they need a way in, or you should decide they are being replaced by the homepage stories.
  - <sub>evidence: The footer links eleven destinations, none of them these; the top nav has one link. Three of them are linked only from inside the memories page, which itself has zero inbound links. Two have no inbound link at all.</sub>
- **The was-₱X comparison prices on the photo service were removed and never replaced** **[OWNER]** *(small)*
  - The photo pages show what things cost but never show what a couple would otherwise pay a professional. That was deliberate — the old figures were made up against dead products. If you want a comparison back, you have to give the number; nobody else can invent it.
  - <sub>evidence: Build spec section 5 records the old ₱75k/₱32k anchors as removed because they were sized against products that no longer exist. The live page shows the real ladder with no comparison figure.</sub>

## 9. The redesign stopped after the colours

*The largest block of remaining work and the slowest-burning. Every screen got the new palette and nothing else — the shapes, the states and the layouts were drawn but never applied. These belong together because they are one programme with one shared kit, they are all gated on you looking at the prototypes once, and the order matters: the screens people use daily first, the internal console last but with the biggest single payoff.*

**7 items · 0 need the owner · 7 are engineering**

- **The couple's own dashboard has not been touched by the redesign** *(large)*
  - The guest list, vendor comparison, budget and gallery screens the paying couple opens every day still look like the old build. They got the new colours and nothing else.
  - <sub>evidence: No shared roster, ledger, comparison or gallery components exist anywhere; the only archetype kit on main is the marketing doorway. The three named offenders are unchanged by any design commit.</sub>
- **The vendor's dashboard has not been touched by the redesign** *(large)*
  - The screens vendors work in every day are unchanged. Since vendors pay to stay, this is the surface that decides whether they renew.
  - <sub>evidence: No shared kit exists for it. The vendor dashboard prototype still carries the old gold and obsidian palette — it is not among the 8 of 23 prototype files containing the locked call-to-action colour.</sub>
- **The admin console redesign — the single biggest win — has not started** *(large)*
  - Your team's own screens are still ninety-odd hand-built tables. Nobody outside the company sees this, so it is genuinely last — but it is also the one place where one piece of work fixes almost a hundred screens.
  - <sub>evidence: The admin components folder holds only nav, KPI card and mobile-landing files — no shared console table. 34 of the app's 48 files containing a raw table live under admin. The gap pass assigns about 95 of 107 admin routes to one archetype.</sub>
- **The first screens anyone ever sees — sign in, sign up, invite — have no design at all** *(small)*
  - Every single person — couple, vendor, guest — passes through these screens before anything else, and they are the only ones nobody has drawn. Small job, highest traffic in the product.
  - <sub>evidence: Listed in the gap pass as one of five surfaces with no design. Verified on main: 9 routes across login, signup, password reset, claim and the four-step join flow.</sub>
- **Four more surfaces still have no design: the photo service's public pages, the marketplace, the tour, and the quiz questions** *(large)*
  - The place people shop for suppliers, the walkthrough that shows the product off, the deepest part of the photo service, and the questions your onboarding quiz actually asks — none of these have been designed, only built.
  - <sub>evidence: Named in the gap pass. Verified on main: 3 explore routes, 5 tour routes, an 11-route public photo sub-tree (the deepest public branch), and an onboarding wizard whose persona-quiz questions, order and reveal are unwritten.</sub>
- **The features page is the one page two approved documents disagree about** *(medium)*
  - One of your main marketing pages is stuck because two approved documents say it should be two different shapes. It stays as-is until someone picks one.
  - <sub>evidence: The gap pass assigns it the comparison shape; the decision log records it as the only route whose archetype assignment is contradicted between two approved sources. 1,699 lines with a Tagalog twin sharing one body component. Neither ported; last touch was a rename.</sub>
- **The older drawings still show the retired colours, so anyone building from them builds the wrong thing** *(medium)*
  - Half the drawings in the folder still show the colours you retired. A builder who opens the wrong one recreates the old look and it passes review because the drawing said so.
  - <sub>evidence: Of 23 prototype files only 8 contain the locked call-to-action colour (5 archetypes plus 3 sketches from 3-4 Aug). Seven older prototypes still carry the old gold. Also: the contract and index both claim 28 pre-existing prototypes; there are 23 files, 18 predating the archetypes.</sub>
---

## Owner decisions already made — do NOT re-ask these

Asked and answered 2026-08-05/07. Re-asking a settled decision is its own defect
in this project.

| Decision | Ruling |
|---|---|
| **Photo retention** | **Five years is true.** The privacy notice is correct; any guest-facing copy saying "kept forever" is the thing to fix. |
| **Livestream delivery** | **A watch link is enough** — the couple does not get a file. ⚠ Must be said plainly BEFORE purchase: the recording lives on our channel. |
| **3D venue looks** | **Design proper rooms for all three.** Restaurant + heritage + civic ✅ SHIPPED 2026-08-06. |
| **Heritage** | **Split into two choices the couple picks** — old stone church *and* ancestral-house courtyard. ⏭ Today there is only one heritage look. NOT built. |
| **Civil registrar** | **A small plain municipal room.** ✅ shipped and matches the ruling exactly. |
| **Coordinator + couple photos** | **Ask the couple once**, no default either way. ⏭ NOT built. |
| **Restaurants as venues** | **Yes**, and usable by every event type — dates, hangouts, travel. ✅ shipped. |
| **Venue room sizes** | **Vendors set them so couples fill the real space.** ✅ shipped. |
| **Vendor ↔ wedding match** | **The vendor decides** whether they suit a wedding reception. ⏭ The control does not exist — see the register. |
| **Event name** | 🔒 **Permanent, forever.** No rename flow; do not build one. Every printed link must resolve for ever. |

### A decision someone made FOR the owner, flagged in code

`destination` → the **beach** shell in the 3D walk. The reasoning is written into
`venue-decor.tsx`: "destination" means *away from home*, not a room shape, but a
Philippine destination resort is overwhelmingly beachfront. **Reversible in one
line if the owner disagrees.** He has not been asked.

---

## Verifying anything: the accounts and the traps

**Five prod test accounts:** `testnayan1@test.com` … `testnayan5@test.com`,
password `12345`, all confirmed. `/open-shop` turns a customer into a vendor by
itself.

🚨 **NEVER test a paywall or entitlement on the owner account.** It is
`is_internal = TRUE`, which makes **every** SKU gate pass. A paywall looks
broken-open when it is fine. That is the entire reason those accounts exist.

🚨 **THE MARKETPLACE IS EMPTY AND THAT IS A SETTING, NOT A BUG.** Explore lists
only vendors whose `public_visibility = 'verified'`. Both prod vendors are
`hidden` (the column default), so `/explore` says "no vendors" today. A
create-a-service → find-it-as-a-customer test dies at the last step unless the
shop is switched to visible in admin first. ⚠ `verification_state` and
`public_visibility` are DIFFERENT columns; only the second one lists a shop.

**Prod is pre-launch-empty** — no real guests, no orders. Nothing complains. The
only detector for most of the register is deliberate looking.

---

## Traps that have each cost real time

- 🪤 **CI runs in UTC — the one clock where the date bugs cancel out.** Run date
  logic under `Asia/Manila` AND a zone west of Greenwich. Compare venue-to-venue,
  never local-to-venue.
- 🪤 **`schema_migrations` lies.** Verify DDL against the catalog
  (`pg_get_functiondef`, `pg_constraint`), never the migration file.
- 🪤 **A migration timestamped below the applied head merges green and creates
  nothing.** The applied head has been HIGHER than the newest file in the repo.
  Query it first.
- 🪤 **`npm run build` cannot run locally** (~7 GB heap → SIGTERM). CI is the only
  detector for an RSC break. A crashed `tsc`'s error count is meaningless.
- 🪤 **Green CI means it compiles, not that anyone can reach it.** Every bug in
  the "half-built" group was green throughout.
- 🪤 **An empty read and a denied read are the same value.** Prove the reader was
  permitted before concluding anything about permissions.
- 🪤 **A check that fires on correct code teaches people to delete the check.**
  Two guards written this week reported false positives on their first run; both
  were narrowed before shipping.
- 🚨 **Agents clobber a shared checkout.** Branch, then `git worktree add`, then
  work. Prune each worktree the moment its PR merges — they are 1–2 GB each and a
  full disk makes every command fail, including the `rm` needed to recover.
- 🪤 **The corpus `DECISION_LOG.md` is NOT the one in this repo.** Write the
  corpus path absolutely; relying on the shell's directory put rows in the wrong
  repo twice in one session, once directly on `main`.

---

## How this went wrong — read before trusting any list, including this one

**On 2026-08-05/07 the session that produced this register also, four times,
told the owner something that was not true.** Each was caught by a one-word
question from him, never by CI.

1. **A list of "remaining" items handed over unverified.** Of seven: three were
   already fixed (two by that session's own PRs, hours earlier), one described a
   feature as broken that is simply not built, two were settled decisions. **One
   was real.**
2. **A sweep for unsettable columns** reported 12; spot-checking four found a
   false positive. It was not shipped as a guard because of it.
3. **"Payments and tax have never been looked at."** Both are **shipped**. The
   build tracker says so in one line that had not been read.
4. **A feature declared complete that was not** — twice in one PR: a reader with
   no caller, then an action with no form, in the change whose own description
   claimed all halves shipped together.

🔑 **The shape every time: rigor aimed outward, never at my own conclusion.**
The register's items each carry evidence; the sentences summarising them did
not. **Absence of recent evidence was read as evidence of absence.**

**So: before saying "X was never looked at", read `App_Build_Status.md` for X.**
It answers "did the code ship" in one line per iteration — 67 shipped · 23
partial · 3 flagged · **zero blocked**, and ≥6 of the partials are explicit
V1.5/Phase-2 deferrals already ruled on. ⚠ It was last reconciled **2026-06-29**,
so it is evidence of what SHIPPED, never of what is currently broken.

---

## 9b. Two facts the auto-loaded `CLAUDE.md` still states that are no longer true

*Checked 2026-08-22 against `origin/main` and the live database. Both sit in the
ACTIVE block every session reads first, which is the worst place for a stale
claim — a session acts on it before it reads anything else.*

- **"🔴 THE VENDOR CANNOT ANSWER" is FALSE.** A supplier asked to agree to a
  deletion now has real Agree and Decline forms on their dashboard's "What's new"
  feed. <sub>Traced end to end: `vendorAgreeToDeletion` / `vendorDeclineDeletion`
  → `answerDeletionRequest` → the `vendor_answer_event_deletion` RPC, rendered
  inside `<form action={…}>` in `overview-sections.tsx`. Not a prop passed and
  never drawn — an actual form.</sub>
- **Its production numbers are stale.** It says 5 events · 2 vendors · 0 photos.
  Measured 2026-08-22: **5 events · 5 story pages (0 published) · 14 Papic photos
  · 45 supplier bookings · 1 published chapter attached to no event.** Still true:
  **0 orders ever** and nothing sold.

⚠ **The owner also could not have this written for him automatically** — see the
access note in group 10: the corpus was unreadable from that session, so
`CLAUDE.md` there could not be edited.

---

## 10. One story per day — the board pointed at the wrong product

**Opened 2026-08-22.** Contract:
[`WHATS_NEXT_One_Story_Per_Day_2026-08-22.md`](WHATS_NEXT_One_Story_Per_Day_2026-08-22.md)
— read it before touching the story, the editorial, or the Storyteller.

The owner read My Events and asked *"isn't that the editorial. the story?"* He
was right, and it was not a naming clash: **the board was measuring, and opening,
a different product.** A couple could publish her wedding's story page, see *"Your
story is live"*, return to the board and find the same wedding under *"Untold —
no story written yet"* with a button that opened a **blank page** asking her to
write the day again from memory.

Six PRs shipped (#4687 · #4660 · #4690 · #4696 · #4712 · #4715). What is left is
mostly **`[OWNER]`**:

- **`[OWNER]`** what the couple's dashboard calls it — "Story" collides **six**
  ways, and eight sites must move together or a screen names one thing twice.
- **`[OWNER]`** "Editorial PRO" — a paid SKU's display name, ~24 user-visible
  occurrences, one decision or none.
- **`[OWNER]`** does the love story yield the word? If yes, the first one is
  trivial.
- **`[OWNER]` 🔴 the free/paid split may be inverted** — the blank page is free,
  while naming the moments and ordering the sections on the story we already
  wrote for her are sold as Event Hub PRO.
- **Engineering:** the plain editor · the three audiences · **three doorway rows
  that render nowhere, with two guards passing on strings inside them** · gold
  eyebrows at **3.48:1** on the story page (7 sites — a whole-component call).

---

## Where to start

**Group 1, "armed to go wrong the first time a real customer arrives."** Seven
items, all small, each harmless today only because production is empty. Extra
cameras switch on without paying; a vendor's receipt is silently discarded; a
deletion job whose own label says safe-mode is not.

**Then group 2** — what is written down versus what the product does. A guest and
a regulator can both read those sentences today.

**Then one rehearsal livestream end to end.** Nobody has ever streamed anything.
It settles ten interlocking items at once and cannot be settled any other way.

**Group 10 is different — it is mostly yours, not engineering's.** Four rulings
sit in front of the story work, and one of them (the free/paid split) may be
backwards in a way that costs money on the first real customer. Deciding them
takes an afternoon and unblocks the rest.
