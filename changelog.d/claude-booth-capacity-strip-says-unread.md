## 2026-10-24 · fix(patiktok): the booth's soft-cap strip says it could not count, never "0 / 40"

The Video booth page counts renders queued in the last 24 h for its soft-cap strip. It worked out
`submissionsMeasured` and never used it: a refused count became `0`, so the strip read
"0 / 40 · 40 left before soft cap" with the green pill — identical to a quiet booth. The strip is
now handed `measured`; unread, it draws no figure, no "N left", no pill and no warn frame, and says
"Couldn't read today's count. Refresh to try again." A real count draws exactly as before.
Held by `app/dashboard/reads-are-honest.test.ts` (sabotaged four ways: flag dropped, figure on the
unread path, `?? 0` restored, green pill on the unread path — each red).

SPEC IMPACT: None
