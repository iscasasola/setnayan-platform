## 2026-09-18 · fix(tests): the-venue-respects-privacy uses the shared stripComments

`the-venue-respects-privacy.test.ts` had its own hand-rolled regex comment
stripper — the same class of blind spot `lib/strip-comments.ts`'s docblock
documents (a block-comment regex opened by `accept="image/*"` can blank real
code, and a trailing `// comment` survives a `^\s*` anchor). Switched to the
shared `stripComments()`, matching the same fix already applied to
`venue-door-throttle.test.ts`.

SPEC IMPACT: None.
