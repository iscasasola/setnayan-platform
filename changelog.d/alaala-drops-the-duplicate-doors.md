## 2026-08-19 · design(alaala): the header drops Profile and Settings

**SPEC IMPACT:** None.

Owner: *"i think we can remove that since profile and settings are found on the
upper right icon already."*

Alaala's header carried a **Profile** chip and a **Settings** chip. Both are in
the account menu behind the avatar, on **every** page, as one combined
**"Profile & settings"** row.

⚠ **VERIFIED IN THE LIVE UI BEFORE CUTTING, not assumed.** Opened the account
menu signed in and read it: *Home · Shop · HQ · **Profile & settings** · Your
Story · Sign out*. A duplicate is safe to remove; the **only** door is not, and
this repo has a standing lesson about removing a button and calling the door
closed.

`lint-port-no-lost-controls` reported the loss, which is exactly its job. Its
baseline is regenerated here and **measured before it was trusted**: 402 routes
before and after, **1** destination removed — `/dashboard/(account)/library ::
/dashboard/profile`, the intended one — **0** actions and **0** blocks lost.

⏭ One real difference, named rather than hidden: the old **Settings** chip jumped
to the settings section of the profile page. The account menu lands on the top of
that page instead, so that is one scroll longer. Deliberate — a second permanent
chip on every Alaala visit is a poor trade for one anchor.
