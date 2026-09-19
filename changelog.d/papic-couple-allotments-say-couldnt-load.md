## 2026-09-19 · fix(papic): the couple's guest-credit limits say "couldn't load" instead of drawing numbers from a failed read (AREA-PAPIC)

The **How many credits each guest gets** row in the couple's Papic studio reads five things: whether guest cameras are on, the pot, the head count, the guest list and the named allotments. It then does arithmetic over all five. Each failure turned into a value that looked real:
- A refused guest list read `[]`, so the sheet said "Your guest list is empty".
- Refused allotments read as "nobody named".
- A refused pot showed "0 credits each".
- A refused camera check hid the row entirely.

A couple would then "correct" a share the database was never applying.

The decision is now one pure function, `allotmentRowState` in `lib/papic-guest-allotments.ts`. It returns `show` only when every read answered and the three-state `eventPapicGuestAccess` says `on`, and `hidden` only when that check answered `off`. Anything else renders **Couldn't load**, with no numbers and no controls. **When guests can shoot** does the same ("Couldn't check") instead of disappearing. The moderation page no longer tells the couple their guests' photos will appear "once Papic is on" when the check simply failed. Its capture list is a separate read, so it still renders.

No gate was widened, and every refusal still fails closed. The database still enforces the real limits when a photo is taken.

Guard: `app/dashboard/[eventId]/studio/papic/the-allotment-row-never-draws-a-failed-read.test.ts`:
- It runs the decision over all 48 combinations. Exactly one draws numbers.
- It pins each read's result to its argument.
- It requires the unknown branch to render the couldn't-load state.
- It bans the two-state gate anywhere under `studio/papic` (floor of 30 files).

Sabotage-proven five ways. Each of these fails:
- The decision ignores `guestsOk`.
- `guestsOk: true`.
- The unknown branch returns null.
- The cameras choice is reverted.
- The moderation page is reverted.

SPEC IMPACT: None
