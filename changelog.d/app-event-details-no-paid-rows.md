## 2026-10-21 · fix(store-shell): the iPhone app names no paid service and has no dead "back to services" jump

TestFlight build 5 went to App Review (3.1.1) with notes saying the digital extras are "not offered, priced, or advertised in the app". Event Details › Services still read "Event Hub Pro · Not added" and "Setnayan AI · Not added" in the app, and the "Open Services" / "More Services" / "Back to add-ons" links landed on Home (the More menu is gone from the app, #6725).

- **Event Details › Services**: in the app only Plan it myself stays. No Event Hub Pro / Setnayan AI / Papic row, owned or not, and no "Open Services".
- **Finished-event summary**: no More Services card in the app.
- **Home** (app only): no "Settle a payment" ask for a digital order, no Papic nudge or Papic tile, no "Your services" card, no Setnayan AI free-shortlist offer, no live desk or Live Photo Wall card on the day, and no "More Services" first-visit tour slide (`sells: true`).
- **Coordinator's Event Hub page** (`/launch` canvas): the day-of services (Live Watch, Live Photo Wall, Papic, with "Add") are not built in the app.
- **Back links**: Save the Date, Indoor Blueprint and the about pages draw no "Back to add-ons" in the app. Photo Delivery's "Not now" goes to the galleries. `storeShellHidesHref` now also hides any link to the More address (Home `?more=services`), as the net under every other link.
- **Galleries**: no Papic or Live Watch card in the app.
- **Maker copy**: the QR note and the Theme tip don't name Event Hub Pro in the app. Our photos and Love Story use app words. In Photo moments the app says "photo team", not "Papic team".
- **Guests**: the "Blur their face on the Live Wall" switch is web-only. **Suppliers**: the Sai "First shortlist free ✦" chip is web-only. **☰ drawer**: the Studio group is web-only.
- **Help** (app only): the Papic and Live Watch topics, and the What is Setnayan AI / Music Maker / Papic / Live Watch, photo-sharing and Photo Wall answers, are `HELP_NOT_IN_THE_APP`. The no-signal answer gets app words. A deep link to one of those answers shows no title or topic in the app.
- **Refused in the app**: `/dashboard/<id>/alaala`, the "Memories" page, which is all paid-add-on chips.
- **Web unchanged.**
- **Guard**: `lib/the-app-names-no-paid-service.test.ts`. The paid names are derived from `STORE_SHELL_HIDDEN_ADDON_KEYS`. It renders the finished card, checks the app's help model and the link-guard net, and walks 740 app-reachable files. It has 7 sabotage runs, each caught.

SPEC IMPACT: None. This applies the standing 2026-09-05 / 2026-09-20 store-shell rulings (DECISION_LOG) to more surfaces. The Help hiding answers an open owner question in the app's favour, which the PR flags.
