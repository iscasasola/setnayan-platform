## 2026-09-02 · fix(panood): stop asserting `enableEmbed` on YouTube broadcast create

`createYoutubeBroadcast` (`lib/panood-youtube.ts`) sent `enableEmbed: true` on
`liveBroadcasts.insert`, and every Go Live attempt against the Setnayan pool
channel failed with YouTube 400 `invalidEmbedSetting` — observed live
2026-09-02, 04:52:26Z. `panood_broadcasts` was 0 as a direct result: no
broadcast this platform has ever attempted reached YouTube. The field is now
omitted so YouTube applies its own default instead of asserting a value the
channel is not currently eligible for; unlisted videos are ordinarily
embeddable without it. Guarded by
`apps/web/lib/panood-youtube-embed-omitted.test.ts`.

Not yet re-verified against a real broadcast (a real attempt was intentionally
not repeated from this session per the "one real YouTube call per attempt,
change one field, read the response" instruction it shipped under — the fix
removes the one known-bad field; whether YouTube now accepts the create call,
and whether the youtube-nocookie event-page iframe still plays without an
explicit `enableEmbed: true`, needs one live Go Live attempt to confirm).

SPEC IMPACT: None.
