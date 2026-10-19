## 2026-10-19 · feat(guest-desk): Reply on a desktop opens the one reply page in the 440-px side panel

Ruling: DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED" (3). Behind the same gate as #6662
(`guestHubDesktopEnabled`). At 1024 px and wider a Reply press opens the shared `Sheet` (the desk's 440-px right panel)
framing the reply page itself (`/{slug}/invite/reply`), so there is still one reply form. A saved reply (the save's own
`?rsvp=ok|details|refused`) closes the panel and the invitation is read again without a reload, under the Event Hub's
own words for it. Esc / ✕ close it; focus returns to the Reply. Phones and the gate-off case keep the plain link.
New: `lib/guest-reply-panel.ts`, `app/[slug]/_components/reply-panel.tsx`, guard
`lib/the-reply-panel-is-the-reply-page.test.ts`; lab `/dev/maker-lab/guest?replycard=open&desk=1`.

SPEC IMPACT: None (implements the 2026-10-19 ruling; no new decision).
