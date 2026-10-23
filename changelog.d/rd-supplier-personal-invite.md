## 2026-10-23 · feat(supplier-invite): the personal invite — a plan free until a day, 100 photos to keep, a QR card and a message

Owner 2026-10-23 (prototype `prototypes/supplier_personal_invite_2026-10-23.html`, approved): the admin's invite to one
supplier can offer a plan (Solo · Pro · Ultra) free until a day and, optionally, 100 portfolio photos instead of the
every-plan 50. Ruling the same day: **the 100 are kept after the offer ends**. Built as the delta over the shipped
admin invite and claim flow.

- **Admin form (A2 · A3)** — `invite-vendor-form.tsx` gains **The offer**: plan (one dropdown, catalogue prices),
  "Free until" (date), "Give 100 portfolio photos" (switch, off); the category is a dropdown of the real categories.
  The result keeps the link + Copy and adds the **invite card** (one SVG — the shipped QR drawing with the Setnayan
  mark, the name, the offer pill, the link in words; "Download the card") and the **message to send** (text to copy:
  the offer, the plan prices read from `vendor_billing_catalog`, "Your first booking from Setnayan is on us.", the
  launch-offer sentence only while `launchOfferIsOpen`, the link). No email, no automated send.
- **Migration `20271286262047_the_personal_invite_carries_its_offer`** — `vendor_invites.offer_tier · offer_until ·
  offer_photo_allowance` (+ CHECKs: paid plan only, a plan always has an end, Setnayan's invites only);
  `vendor_profiles.portfolio_photo_allowance` (shop reads it, never writes it — guard trigger; `vendor_profiles_self`
  rebuilt); `claim_ready_the_invited_shop(user, token)`.
- **🐛 Fixed on the way: an admin invite never reached its staged shop.** The vendor sign-up opens an empty shop first,
  so finalize's "already has a shop" branch won and the shop the admin filled was orphaned — the supplier arrived
  nameless (the couple-link twin was fixed 2026-10-19). The new RPC hands the staged row over, or fills the empty
  shop's blanks from it and drops it; seats the admin; applies the offer as an admin comp (`tier_state` ·
  `tier_expires_at` · `tier_source = 'admin_comp'`, one `vendor_tier_set` audit row "Personal invite <id>") only when it
  raises the shop and only while its day is ahead; raises the photo allowance (never lowers it).
- **🐛 Fixed on the way: a Solo plan never lapsed.** Migration `20271286893359_a_solo_plan_lapses_too` adds `'solo'`
  to `sweep_vendor_tier_expiry`'s lapse list (it predated Solo and named only pro · enterprise · custom), so an expired
  Solo — paid or given — now returns to verified/free on the next dashboard visit, credit rule unchanged. Found by the
  new db test ("Solo free until <day>" never ended). Prod, measured read-only 2026-10-23: 2 Solo shops, both admin
  comps, ₱0 credit; one already past its day — the only row it changes.
- **Exposure baseline** — the four new columns are added to `supabase/security/exposure-surface.baseline.txt`
  deliberately: they inherit `vendor_invites`' table-level grants, but an offer only lives on a `source = 'admin'` row,
  which only `vendor_invites_admin_write_all` admits (the couple policies need a `vendor_id` the admin CHECK forbids).
  Proven by the db test "only an admin writes a Setnayan invite" (red under a sabotage open policy).
- **Door (B1)** — `TeamInviteDoor`: "Your invite · Your shop is ready, <name>." + **Your offer** rows.
- **Landing (B4)** — the claim lands on Shop › Your details; staged rows read "from your invite".
- **Today (B6 · C2)** — "Add to the inspiration library" is a counted first step for trades that supply a part
  (every shop, never by plan); a plan Setnayan gave is the Shop line ("Pro · free until 31 Jan 2027 · from
  Setnayan"), and in its last week a door row "Your free Pro ends 31 Jan".
- **Your plan (C1 · C3)** — the gift replaces the price on the answer line; the picker says ₱0 until the day with no
  Pay; a new **Portfolio photos** row; after the gift, "your Pro gift ended …".
- **Photo cap** — `portfolioPhotoCap(tier, allowance)` + `portfolioOverCapMessage(cap)` at every site that read 50.
- Labs: `/dev/personal-invite-lab` (A2 · A3 · B1), `/dev/supplier-lab?s=details&invited=1`, `?easy=…&gift=…`,
  `/dev/supplier-plan-lab?s=plan&gift=running|ended&photos=100`.

SPEC IMPACT: corpus `DECISION_LOG.md` row 2026-10-23 "THE PERSONAL INVITE'S 100 PHOTOS ARE KEPT" (owner ruling
recorded) and the approved prototype committed at `prototypes/supplier_personal_invite_2026-10-23.html`.
