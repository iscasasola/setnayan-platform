## 2026-11-21 · feat(unichat): Call · Viber under ⋯ on both picked pages, booked only

The approved drawing `unichat_live_v3_2026-11-20.html` moves "Call · Viber" into the chat head's ⋯ menu, for booked shops only.

- **Supplier** (`/vendor-dashboard/clients/[eventId]`): one ⋯ row, "Call · Viber", placed after Crew and before Add to my calendar. It opens `BookedCallChoices`, which offers "Call" and "Video call on Viber".
- **Host** (`/dashboard/[eventId]/vendors/[vendorId]/workspace`): two ⋯ rows, "Call" and "Video call on Viber", placed before Report a problem. This ⋯ has no chat page to open a sub-page over, so each row is a plain link.
- **Booking check:** both pages use the ONE `shopIsBookedOnEvent` check, then `bookedCounterpartyPhone`. The links come only from `lib/booked-handoff.ts`, so an unbooked shop or a missing number shows no row. No new tel:/viber: builder was added, and the BOOKED_HANDOFF_BILL is unchanged.
- **Guard:** `the-more-menu-holds-places-to-go.test.ts` gains test 10. Two sabotages turned it red: dropping the supplier row, and swapping the host's booking check for `true`.
- **Not in this PR:** "Mute this chat". It needs a per-person store, a migration, and an answer on how mute applies to the shop's shared phone notifications.

SPEC IMPACT: None. This builds the approved drawing; no ruling changed.

**Head icons (controller ruling, 21 Nov):** following the approved drawing, the picked chat's head row no longer draws 📞 🎥, because the calls now live under ⋯. Outside a picked page, the host strip still draws them. The 9 Nov guard `every-chat-head-has-its-calls` was repointed, not deleted. It now holds three things: the head row draws no calls, the strip draws them only outside a picked page, and both picked pages give ⋯ its call rows using the one booking check. `the-picked-head-carries-the-chat-actions` test 2 follows the same change.
