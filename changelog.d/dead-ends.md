## 2026-09-30 · fix(dead-ends): four dead ends get a way out — Messages, Thank-You Video, two unreachable pages, and the Papic guest pages

A read-only audit found four places where a couple or a guest could get stuck. Each one was checked on `origin/main` before it was fixed.

**1 · Messages: start a conversation with someone on your team.** "Start a new thread" asked for the supplier's email (`startThreadByVendorEmail`). Shops stopped showing their email on 2026-09-10, so couples had no way to know it. The box is now **one PickMenu of the suppliers on Your Team**. Picking one opens that supplier's conversation through the shipped `contactShortlistVendor` → `startServiceInquiry` path, the same one the bench's Inquire and the budget card's Message use. It adds no new way to open a thread.
- Only Setnayan shops are listed. A supplier the couple typed in by hand has no shop to message.
- Each shop is listed once, even if it covers two services.
- Names are anonymity-safe: `resolveVendorDisplayName`, like the bench and the thread list. `lib/messages-team-picker.ts` holds these rules and has direct tests.
- If the team can't be read, the page says so. It does not read as an empty team.
- The email lookup is kept for one case only: the budget card's Message link for a hand-typed supplier (`?prefill_vendor_email=`). There it shows as a single "Look for … on Setnayan" button.

**2 · Thank-You Video: make it free, pay at "Save to my phone".** For a couple who hadn't bought it, the page said "Add it from your Studio" and "Back to Studio". But `/studio` redirects to Our Services, whose Thank-You Video link opens this same page. That loop had no way to buy. Now:
- The couple makes and watches the film for free. The preview player hides its download control.
- "Save to my phone · ₱X" opens the shipped `InlineCheckoutDrawer` in place. The price comes from `platform_retail_catalog_v2` through `formatV2Sku`.
- A submitted order shows "being confirmed". A SKU that isn't on sale says so.
- The unowned page opens with the `StudioBuyHero` (name, promise and price). The owned page keeps the masthead.
- This is the same shape as Patiktok's pay-to-save (#6161).

**3 · Unreachable pages, decided one by one.**
- **Memories (`/alaala`)** had no link to it. It now opens from **Galleries → "More from your day"**. Galleries is the Gallery card's home on Our Services, and Memories shows the stories guests left about their photos.
- **Photo Delivery (`/studio/photo-delivery`)** was linked only from Memories, and its catalogue group `utility` is filtered off Our Services. It now opens from the same Galleries section, using its catalogue words. Its back link now returns to Galleries.
- **Paprint (`/studio/supplies-marketplace`)** had no link to it. It was a cart over mock products with checkout permanently off, and it called itself both "Paprint" and "Setnayan Supplies". **Retired:** the page, its cart and its mock data are deleted. An old link now redirects to Our Services through `studio/[addon]`, so it never 404s. The catalogue entry stays (coming soon, `utility`), and `lib/supplies/` keeps the pricing work for when Paprint becomes real.
- **`studio/[addon]` is now a redirector only.** Its placeholder cards showed couples developer notes such as "Cloudflare Stream Live SFU → YouTube RTMP relay" and "FFmpeg pipeline". All but one were already shadowed by their own folders. The one that could render, `/studio/orders`, showed a spec note, and it now redirects to the real Orders page. `IterationPlaceholder` (`_components/placeholder.tsx`) had no other caller and is deleted, along with the redirector's `loading.tsx`.

**4 · Papic guest pages have a way back.**
- `/papic/pool` and `/papic/decorate` link **"Back to my photos"** (`/papic/me/<token>`, from the session, exactly as `/papic/guest` does).
- Their signed-out screens now have a button, "Back to Setnayan", the same fallback `/papic/guest` uses.
- The decorator's "accept the photo terms on the camera page" message now has an **"Open the camera page"** link to `/papic/guest`.

**Guards:** new `lib/every-dead-end-has-a-way-out.test.ts` (7 tests). Each fix was broken once on purpose and turned the guard red:
- an email box put back on Messages
- a hidden shop's real name shown in the picker
- a free download added to the unpaid film
- the Memories doorway removed
- the Paprint redirect removed
- a signed-out door with its button removed. This first walked through a tag-count check, so the guard now reads each door's body.
- the `/papic/me` link removed
- the terms link pointed elsewhere

Other files updated:
- `the-badge-has-a-deadline.test.ts`: bill line for the picker's name-reveal read.
- `port-control-baseline.json` and `no-card.baseline.txt`: regenerated. The only changes are the deliberate removals above.

**Left to #6153:** nothing in the event menu was touched. #6153 moves Galleries under the Our Services Gallery card, and both new doorways sit on the Galleries page itself, so they fit its menu as-is.

SPEC IMPACT: None. These are reachability fixes on shipped surfaces, and the Paprint retirement only removes a page whose catalogue entry was already "coming soon". Owner call flagged in the PR: whether Paprint's catalogue entry and `lib/supplies/` should also go.
