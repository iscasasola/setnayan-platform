## 2026-11-19 · feat(onboarding): supplier onboarding — Door C (coordinator) + "Trusted partners" + two fixes

Part 3 of 3 of the approved supplier onboarding (DECISION_LOG 2026-11-19 "COORDINATOR ONBOARDING (Door C) APPROVED +
'TRUSTED PARTNERS'"). Stacked on part 1.

- **Door C** (`/open-shop?as=coordinator`): Coordination pre-picked — the first coordination service, ONE dropdown of
  `COORDINATOR_TRADE_SERVICES`' leaves ("Not a coordinator? Search all services" keeps the full picker) — then the
  shared screens; the first card is drafted on their page (a price to approve).
- **"Invite shops you trust"** — new `/open-shop/invite`, where the coordinator's shop opens: their own `/i/<slug>`
  QR on the shipped `QrCard` (Share), "Only invite those you trust.", then Done → where the first card's way lands.
- A shop that scans it gets the **blue invite door** (`/i/<slug>` wears `data-supplier-look`), then Door B.
- **"Trusted partners"** everywhere the coordinator-to-shop tie and the shop-page section are named: the shop page
  section (was "Trusted by"), Shop › Trusted partners (was Partnerships), the add / invite words ("each other's trusted
  partners", was "preferred supplier"), the claim doors' and `/i`'s lines. The DB is unchanged; the "Trusted by"
  BADGE (clients who came back) is a different thing and keeps its name.
- **Fix:** all four `/for-coordinators` buttons carry `?as=coordinator` (the test that pins them updated).
- **Fix:** the invite perks no longer promise "marketplace listing" / "Marketplace exposure" (an unverified Free shop
  is found by its own link and QR) — on `/i`, the couple's link and the team invite doors.

SPEC IMPACT: None new — implements the 2026-11-19 DECISION_LOG row as written. New route `/open-shop/invite` needs a
FEATURE_REGISTER row in the corpus (flagged).

### Review fixes (19–20 Nov, drawing `36jmQMWrANcgd2HxihAUw5`)
- **Email-way coordinator reaches the invite:** `becomeVendor` wraps EVERY landing in `viaInvite` — the session path, a refused first card, and the Email way's confirm link (`afterConfirm`) — so a coordinator always passes through "Invite shops you trust".
- **PC4 Your page:** on Door C step 4 is their page — the shop's name and main service · city, the first card on it, the empty Trusted partners section ("Shops you invite show here."), "setnayan.com/<slug> · goes live when you open", and Approve page.
- **PC6:** Done names the Page and the Invite link (next, then in Shop › Partnerships); step names Start · Account · Shop · Page · Done.
- **PC7 the /i door:** "<shop> invited you" · "You'll show on their page as a trusted partner." · the shop card · "Joining makes you partners at once" · "Free. Tools for your own clients." · I already have a shop · Create my free shop → Door B.
- **Reverted:** the Shop › "Partnerships" tab keeps its shipped word (title, masthead, Shop tile). "Trusted partners" stays for the tie and the page section, as ruled.
SPEC IMPACT: None — builds the approved 19 Nov drawing.

## 2026-11-20 · fix(onboarding): Door C takes Door B's first-card truth; PC1 Picked row; Later on the invite

- Door B's fix is merged in. The coordinator's first card goes through the shipped switch. Every landing (live, draft, refused, Edit) still passes through `/open-shop/invite`.
- PC4: the page link no longer says "goes live when you open". It now says "your card shows here once it's live".
- PC1: a "What you do · Coordination · ✓ Picked" row above the coordination dropdown.
- PC7: "Later" beside Done on the invite screen. Both go where the first card lands.
- PC7 (owner 20 Nov): the `/i/<slug>` card names the inviter's main service ("Lia Events · Coordination"). `readInviter` now reads `services` and `serviceLabelOf` gives the admin-managed name.
- Tests: `lib/supplier-onboarding.test.ts` 13, and test 10's landing count is now 3.

SPEC IMPACT: None.

- PC7 shop card → rows on white (owner 20 Nov, option a): a frame only on what you press; clears the template ratchet for vendor/claim/[token].
- Lab: `/dev/open-shop-lab?screen=invite` draws the /i invite door on a fixture inviter (for the §4 light/dark shots).
