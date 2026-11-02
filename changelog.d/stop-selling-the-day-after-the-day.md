## 2026-08-21 · feat(suite): once the celebration is over, the services that ARE the day stop being sold

**Owner decision, 2026-08-21.** Asked what should happen to Live Studio, Papic cameras and Custom QR once an event has finished, he chose: *"stop offering them"* — the card still shows what it was, and the buy path closes.

## The gate is a NEW predicate, and that is the whole design

🚨 **The obvious fix is the harm.** The natural move is to thread the phase into `addOnOfferedForEvent`, the shared event-type gate. Its result is the sole parent of the Suite's `active` list — **the services the couple has already PAID FOR**. Doing that would have deleted a paid Live Studio from their own shelf the morning after their wedding.

So there are two predicates now, and they answer different questions:

- **OFFERED** — does this event type have such a thing at all? *Unchanged.*
- **SELLABLE NOW** — is the buy path open? *Only the buy path may read it.*

A test asserts `addOnOfferedForEvent` never learns the phase.

## What closes, and what does not

**Closes:** Papic (both), Live Studio (both entries), Patiktok, Custom QR per guest, the Save-the-Date openings, the indoor blueprint, the event page.

**Stays open:** the editorial maker, the thank-you film, Event Hub Pro, Pakanta, the animated monogram, handing the gallery to Drive, the event website, Setnayan AI — and **photo preservation**, which is by definition an after-the-event purchase.

⚠ **THE SOURCE MATERIAL HAD TWO PAPIC SKUs SWAPPED**, and an implementer editing by the cited line number would have closed **Keep Full-Res** — inverting the retention promise. Everything here is flagged **by key string**, never by line, and the test names both directions.

## Closed where a POST lands, not only where a button is

`submitOrderAction` is POST-able with any serviceKey — its action id ships in the client bundle of every drawer mount — so a gate in a page component closes the button and not the door. **One refusal there covers all fourteen drawer surfaces**, plus a stale tab and a back-button. It sits **before** the charge resolvers, because a filter inside one is the documented bypass that keeps the tamperable client price.

🔑 **And four Papic purchases mint orders without ever touching that action.** A gate only in the shared checkout would have been a button-not-a-door fix. All four now refuse.

⚠ **The gate asks the lifecycle resolver, never the capture window.** Papic's window FAILS OPEN when a couple never set bounds — most events — so a gate built on it would simply not exist for them.

## The card stays on the page

Dropping a closed card would also delete it from the Suite's **search index**, so a couple typing "papic" the morning after would be told it does not exist. Closed services are **re-shaped**: dimmed, unclickable, with a small grey **"Event over"** pill where the price was — the shape the Suite already uses for a card that cannot be opened.

⚠ The pill rung sits **strictly after** the owned rungs. Above them, a paid Live Studio would turn grey the morning after — the exact regression this PR exists to avoid. A test pins the order.

## An owner keeps their tool

On the `/studio/about/<key>` deep link the ownership redirect now runs **first**. Closing above it would hand a 404 to somebody for a service they bought. The ruling was about **offering**, never about taking away what was paid for.

## Also

The services page (`/launch`) stops saying *"Launch your services"*, *"Bring everyone who could not make it into the room"* and *"Your cameras are ready — hand them out"* for a night that has finished, and its **Add** buttons become the same closed chip.

## Verification

10 sabotages, each measured by occurrence count, each RED — including the two that would have caused real harm: the phase threaded into the owned gate (0 → 4 occurrences), and the closed pill jumping above the "Active" rung.

🪤 **Two assertions failed on their own first run, both my fault, both instructive.** One asserted a flag-gated catalog entry through `ADD_ONS` — where it is absent unless the launch flag is on, so it was asserting nothing; it is checked at its source instead. The other located `resolveOrderChargeCentavos` by `indexOf` and matched the **import at the top of the file**, reporting the guard as running too late when it does not.

- Unit suite **9213 pass / 0 fail**. Typecheck, `next lint` and seven lint guards clean.

SPEC IMPACT: None — no price, no SKU retired, no schema. One new optional catalog field and a buy-path gate. Which services close is the owner's 2026-08-21 ruling.
