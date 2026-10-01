## 2026-09-30 · feat(invitation): Welcome is the guest's own page — their look, Reminders, E-Gifts; the Invitation's tabs read Welcome · Details · Our Love Story

Owner, verbatim: *"on invitation we can set the reminders. Home is their personalization. customized mood board. reminders. also E-Gifts should already show."* — and *"on Invitation, the menu is Welcome - Details - Our Love Story - Me"*.

**What existed (found, not rebuilt).** The guest's own dress code ("You are Ninang", their colours, the figure, Do's & Don'ts) was already drawn by `DressCodeWidget` — inside Details. The couple's reminders already had a store and an in-place Maker text box: `events.what_to_bring` (the "What to bring" scene), also inside Details. The E-Gifts door ("Send a blessing" → `/[slug]/pabuya`) already rendered in every phase, gated only on the gift page's own three rules (`PABUYA_PUBLIC_ROUTE_ENABLED`, at least one enabled gift method, the viewer's raw visibility) — **no date gate and no Pro gate**. It was simply drawn by `GuestDoorwayStrip` at the very FOOT of the page, below "Sign out of this invitation", and never in the Maker's canvas (`isEditorCanvas` → null), so the couple never saw it and a guest met it last.

**What changed.**
- `lib/invitation-welcome.ts` — ONE rule (`welcomeParts`) for what the Welcome page holds, in order: the guest's look · Reminders · E-Gifts. Only on the Invitation stage, only in the normal body, and nothing that is empty (no reminders → no Reminders, no gift method → no E-Gifts). The Maker's canvas draws each place so the couple can fill it.
- `app/[slug]/_components/guest-welcome.tsx` — `GuestWelcome`, one self-contained section taking its data as props (so it can drop into a hub panel later unchanged). Mounted after the reply, before Details, in the guest tree and in the stranger's tree (which is also the Maker's canvas).
- `DressCodeWidget part="you"` — only the reader's own look and the Do's & Don'ts, or nothing. Details now shows everyone's palette to an identified guest too (`dressCodeGeneral`), since their own half is on Welcome.
- Reminders: the `what_to_bring` scene is called **Reminders** to guests and in the Maker (label, placeholder, navigator mini) and leaves Details for Welcome. Same column, same in-place text box — no new store.
- E-Gifts: `WelcomeGifts` (the same door, under an "E-Gifts" eyebrow); the foot strip stands down on the Invitation (`welcomeCarriesGifts`) so there is one gift door per page.
- Maker navigator: new fixed tiles `f:look` ("Guest's look") and `f:gifts` ("E-Gifts"), and `w:what_to_bring`, all filed under the first tab (`anchorOfTile` → `home`), listed in the canvas's order by the same `welcomeParts`.
- Tabs: the Invitation's bar reads **Welcome · Details · Our Love Story** (then RSVP/Me) — labels only; keys and anchors (`home`/`details`/`story`) are unchanged. The Day's bar is untouched (owner: that change is after the release).
- No casual greeting on Welcome: the "Hi, {first name}." salutation (and the Maker's "Hi, Your guest.") is removed; the sentence saying when, where and as whom stays (DECISION_LOG "NO CASUAL GREETINGS").

Guard: `lib/welcome-is-the-guests-own.test.ts` (decision · render · wiring).

SPEC IMPACT: None — implements DECISION_LOG 2026-09-30 "THE INVITATION'S HOME IS THE GUEST'S OWN PAGE" and "NO CASUAL GREETINGS" as recorded; the "Welcome · Details · Our Love Story · Me" menu ruling is the owner's in chat 2026-09-30 (relayed by the controller) and should get its own DECISION_LOG row from the controller.
