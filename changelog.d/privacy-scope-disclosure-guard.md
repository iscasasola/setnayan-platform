## 2026-09-01 · test(privacy): pin the privacy page's disclosed OAuth scopes to what the code requests

Adds `apps/web/lib/privacy-page-scope-disclosure.test.ts`, the third guard from
L5 (PR #5063 shipped the other two). Asserts the privacy page's disclosed
YouTube and Drive scope text byte-matches `YOUTUBE_OAUTH_SCOPES` /
`DRIVE_OAUTH_SCOPES`. `userinfo.email` and `userinfo.profile` were disclosed on
this page for months after they stopped being requested (removed
2026-07-27) — this is the drift that recurrence looks like.

Mutation-tested: injecting a fake scope into either source constant, and
renaming the disclosure label the extraction anchors to (to prove it fails
loudly rather than comparing two empty sets), both flip the suite from 2
pass/0 fail to 1 pass/1 fail.

The OAuth consent screen itself (the third leg) is not checkable from code —
a human must confirm the Google Cloud console lists exactly `auth/youtube`.

SPEC IMPACT: None.
