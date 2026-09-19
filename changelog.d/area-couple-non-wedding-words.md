## 2026-09-19 · fix(host): a debut is not a wedding — five host-page phrases follow the event type

A debut or birthday host was told "Your wedding" (guest mind map root — shown whenever no
bride+groom are listed, i.e. every non-wedding), "Set your wedding date first" (Preparation empty
state), "This locks your wedding date." (date-lock confirmation), "…for our wedding" (the invite
sent to an off-platform supplier), and "Role in wedding" (guest detail on a sideless event). They
now read `eventNoun(event_type)` (weddings unchanged) or neutral words ("This locks your date.").
Guard: `lib/a-debut-is-not-a-wedding-on-the-couple-pages.test.ts` (phrase gone AND the mount passes
the word). `lock-impact-wiring.test.ts` updated to the new date sentence on purpose.

SPEC IMPACT: None
