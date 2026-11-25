# App Review purchase guide: Setnayan 1.0 (build 9)

Each In-App Purchase in App Store Connect has its own **Review Information › Review Notes** box, next to its review screenshot. The reviewer reads that box while testing the product. This file holds:
- **section A:** the text for each of the 13 boxes, ready to paste;
- **section B:** the same steps as one page, the source of `setnayan-purchase-guide.pdf`, which you attach under App Review Information.

Every label and message below is quoted from the code on `main` (25 Nov). Anchors:
- event plans: `event-services-view.tsx` `EventServicesView`;
- Live Watch: `iap-live-watch-sheet.tsx` `IapLiveWatchSheet`;
- Papic: `iap-papic-sheet.tsx` `IapPapicSheet` / `PapicCreditsAdded`;
- gifts: `gift-store.tsx` `GiftStore`, `apple-gift-cart.tsx` `AppleGiftCartFoot`, `iap-gift-buy.tsx` `IapGiftBuy`;
- shared outcomes: `lib/iap/iap-outcome.ts` `IAP_COPY`;
- Restore: `restore-purchases-row.tsx` `RestorePurchasesRow`.

The paths up to each buy button were walked on setnayan.com as the demo account (25 Nov). What happens after Apple's sheet appears only in the app, so it was read from code, not tapped.

No prices appear here: the app shows Apple's own price on every button.

---

## A · Each product's Review Notes (paste one block into each product)

### `event_plus` · Event Plus
```
Sign in with the demo account. Home > open "Ana & Ben" > Today > Your services > Event services (the last row) > under "Pick a pack" tap "Event Plus" > Pay > confirm in Apple's sheet.
You will see: "Event Plus is on this event. Your receipt comes from Apple." The page refreshes and shows Event Plus as the event's plan.
One event holds one plan, so please buy Event Pro on "Carla & Dan" and Event Ultra on "Ella & Fred".
```

### `event_pro` · Event Pro
```
Sign in with the demo account. Home > open "Carla & Dan" > Today > Your services > Event services (the last row) > under "Pick a pack" tap "Event Pro" > Pay > confirm in Apple's sheet.
You will see: "Event Pro is on this event. Your receipt comes from Apple." The page refreshes and shows Event Pro as the event's plan.
One event holds one plan, so please buy Event Plus on "Ana & Ben" and Event Ultra on "Ella & Fred".
```

### `event_ultra` · Event Ultra
```
Sign in with the demo account. Home > open "Ella & Fred" > Today > Your services > Event services (the last row) > under "Pick a pack" tap "Event Ultra" > Pay > confirm in Apple's sheet.
You will see: "Event Ultra is on this event. Your receipt comes from Apple." The page refreshes and shows Event Ultra as the event's plan. Event Ultra includes Live Watch.
One event holds one plan, so please buy Event Plus on "Ana & Ben" and Event Pro on "Carla & Dan".
```

### `live_watch` · Live Watch
```
Sign in with the demo account. Home > open "Ana & Ben" (or "Carla & Dan") > Today > Your services > Live stream > Activate. In the "Live Watch" sheet, tick the box if one is shown ("I understand, and I already have a YouTube account…") > Add Live Watch > confirm in Apple's sheet.
You will see: "Live Watch is on. For this event, and everyone on it." The Live stream row then reads "On · bought in the app".
Event Ultra includes Live Watch, so please buy it on an event without Event Ultra.
```

### `papic_pack_150` · Papic 150 (same steps for 1000 and 3000)
```
Sign in with the demo account. Home > open any of "Ana & Ben", "Carla & Dan" or "Ella & Fred" > Memories (bottom bar) > Add more (in the Papic block at the top) > in "Add credits", use - / + to choose 150 > Buy 150 credits > confirm in Apple's sheet.
You will see: "150 credits added. On this event now. Guests can start taking photos."
Papic packs are consumable and can be bought again.
```

### `papic_pack_1000` · Papic 1000
```
Sign in with the demo account. Home > open any of "Ana & Ben", "Carla & Dan" or "Ella & Fred" > Memories (bottom bar) > Add more (in the Papic block at the top) > in "Add credits", use - / + to choose 1,000 > Buy 1,000 credits > confirm in Apple's sheet.
You will see: "1,000 credits added. On this event now. Guests can start taking photos."
Papic packs are consumable and can be bought again.
```

### `papic_pack_3000` · Papic 3000
```
Sign in with the demo account. Home > open any of "Ana & Ben", "Carla & Dan" or "Ella & Fred" > Memories (bottom bar) > Add more (in the Papic block at the top) > in "Add credits", use - / + to choose 3,000 > Buy 3,000 credits > confirm in Apple's sheet.
You will see: "3,000 credits added. On this event now. Guests can start taking photos."
Papic packs are consumable and can be bought again.
```

### The six gifts (one block each; change only the two names in quotes)

| Product | Group | Row |
|---|---|---|
| `gift_papic_pack_150` | Papic | Papic 150 |
| `gift_papic_pack_1000` | Papic | Papic 1000 |
| `gift_papic_pack_3000` | Papic | Papic 3000 |
| `gift_event_plus` | Event | Event Plus |
| `gift_event_pro` | Event | Event Pro |
| `gift_event_ultra` | Event | Event Ultra |

Example for `gift_papic_pack_150`:
```
A supplier buys gifts to give to a client's event. The demo account runs the supplier shop "Review Shop".
Home > Shop (in the row of round icons under the name) > Open shop dashboard > Shop (bottom bar) > Promote > under "Your gifts", Buy more > under "Papic", press + on "Papic 150" > at the bottom, press that line's Buy > confirm in Apple's sheet.
You will see on that line: "Added to your gifts. Give them on a quote or when you agree to a booking."
Each line is its own Apple payment. + sets the quantity from 1 to 10, and Apple's sheet shows the quantity.
```

---

## B · The one-page guide (the PDF to attach)

**Setnayan 1.0: how to buy each In-App Purchase**

**Before you start**
- Sign in with the demo account (email and password, not Google).
- The demo account hosts three events: "Ana & Ben", "Carla & Dan" and "Ella & Fred". It also runs the supplier shop "Review Shop".
- Purchases appear only to an event's host, and only in the iOS app.
- One event holds one plan. Please buy Event Plus on "Ana & Ben", Event Pro on "Carla & Dan" and Event Ultra on "Ella & Fred".
- Home may also list events the account only helps with. Those offer no purchases.

**1 · Event plans: Event Plus, Event Pro, Event Ultra**
1. Home > open the event > Today > Your services > Event services (the last row).
2. Under "Pick a pack", tap the plan, then Pay.
3. Confirm in Apple's sheet.
- **Done when:** "Event Pro is on this event. Your receipt comes from Apple." (with the plan's name). The page then shows the plan and offers no other plan for that event.

**2 · Live Watch**
1. On "Ana & Ben" or "Carla & Dan": Today > Your services > Live stream > Activate.
2. Tick the box if one is shown, then Add Live Watch.
3. Confirm in Apple's sheet.
- **Done when:** "Live Watch is on." The Live stream row reads "On · bought in the app".
- Event Ultra includes Live Watch.

**3 · Papic photo credits: 150, 1,000, 3,000**
1. On any of the three events: Memories (bottom bar) > Add more, in the Papic block.
2. Use - / + to choose the pack, then press Buy.
3. Confirm in Apple's sheet.
- **Done when:** "150 credits added" (or 1,000 or 3,000).
- Packs can be bought again.

**4 · Supplier gifts: Papic 150 / 1000 / 3000 and Event Plus / Pro / Ultra**
1. Home > Shop (round icons under the name) > Open shop dashboard > Shop (bottom bar) > Promote > under "Your gifts", Buy more.
2. Press + on a gift. Each line is its own Apple payment, with a quantity from 1 to 10.
3. Press that line's Buy and confirm in Apple's sheet.
- **Done when:** that line reads "Added to your gifts."

**Restore purchases**
- Home > the gear beside the name > Profile & settings > Restore purchases > Restore.
- It shows "Restored" and the items, or "Nothing to restore — anything you bought is already on your event."
- Papic credits are kept on the event, so they never need restoring.

**If you cancel Apple's sheet**
- The app says "Nothing was charged." and offers Try again.
- If a purchase is still pending, the app says "Switching it on…", and Restore purchases finishes it without a second charge.

---

## Still to confirm on the device (owner's TestFlight walk, step 8)
- **Each success line** above appears after Apple's sheet. It is read from code; nobody has tapped it on a device.
- **After a gift buy:** does the "Available" count under Your gifts go up when the store closes? It depends on the page reloading (`revalidateOn`); the cart itself does not set it.
- **Restore purchases row** on Profile & settings. It is drawn only in the app.
