## 2026-11-13 · feat(post-event): Post Event reads as a story — the owner's six calls

Owner, 13 Nov (DECISION_LOG "POST EVENT = A STORY (ONE SCENE PER SCREEN) — SIX CALLS SETTLED"), built on the shipped Post Event draft and scenes:

1. **Story is the default reading** — one scene per screen (full-screen min height, CSS scroll snap) with progress bars on top, counted from what the page drew. Maker › Post Event › "Reads as" (Story / Page) is one draft key, `readAs`, in `event_editorial.draft_json` (`lib/post-event-draft.ts`); no new table.
2. **Gift thank-you** — a new `gifts` scene: one line for every giver, stored as the scene's words in the draft, shown only to the signed-in guest who has a gift record (`lib/gift-thanks.server.ts`, the same fence as `recordGift`); never an amount.
3. **Thank-you video** — no upload; the Videos scene's empty state tells the couple to paste a YouTube link.
4. **"Full size until <date>" + Save all** on the guest's own "Were you there?" (date from `FULL_RES_POST_EVENT_GRACE_DAYS`; Save all hands the viewer's own full-size photos to one share sheet). No email.
5. **`/{slug}/recap` sends to the story**; Share + Save-the-card move to the story's last screen, only when the story is set to Everyone.
6. **The couple's surprise** — new `events.chapters_peek` (default false, column grants + `events_host` rebuilt): chapter photos stay hidden from the couple until Post Event opens; "Peek now" switch in the Post Event panel (folded into `hubDraftAction`, no new server action). Guests unaffected. Migration `20271344065097`.

SPEC IMPACT: None — the DECISION_LOG row of 2026-11-13 records the six calls.
