## 2026-11-17 · fix(supplier-chat): Counter-offer and "Update this quote" open their panel inside the picked client

From the supplier dashboard audit (Chat):
- The same chat box draws on full screen (`/vendor-dashboard/messages/<id>`) and inside the picked client (`/vendor-dashboard/clients/<id>?tab=chat`). Its compose doors were relative: `?compose=deal` for Counter-offer, `?compose=quote` for "Update this quote", and the expired-quote blocker's "Send a new quotation". Inside the client, a relative link dropped `tab=chat`, and the client page never reads `compose`, so all three landed on Details.
- Inside the client those doors now go to the Quotation page (`customerCardHref(eventId, 'quote')`) and to the full-screen chat with the deal panel open. Full screen is unchanged.
- The two guards that pinned the literal strings now pin both forms.

SPEC IMPACT: None.
