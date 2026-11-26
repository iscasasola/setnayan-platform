## 2026-11-25 · feat(home): the event card opens its menu (brief Add 40)

Owner-approved 25 Nov (drawing `build-sessions/final-check/drawings/event-card-menu.html` on `final-check/brief`).

- **Opening the menu.**
  - On Home, tapping an event you organise or help with opens one menu. So do its ⋯, a long-press and a right-click.
  - The rows are Open Dashboard · Open your Event Hub · Open Chat · Open your Memories · Publish Story · Delete Event.
  - On a phone it is the house sheet. On a computer it is a small menu anchored to the ⋯, over the one scrim.
  - It replaces the Dashboard · Event Hub · trash buttons that sat under each card.
- **Open your Event Hub.**
  - It opens the hub itself (`/{slug}`), signed in, view only, in the app's own view.
  - It has no Public/Unlisted gate for the people who run the event.
  - An event with no address says "Set up your Event Hub first".
- **Helpers.** They get Dashboard · Event Hub · Chat. Memories shows only with Photos, by the Memories page's own rule. There is no Story and no Delete.
- **Publish Story.** It waits for the app's story gate (the day after the event) and lands on the Story's publish step.
- **Delete.**
  - It is the shipped flow inside the same menu: one shared body, the same server actions, "Put this away" first.
  - A refused check is now said under the rows.
  - No new server action.

SPEC IMPACT: None. This builds the approved drawing (brief Add 40).
