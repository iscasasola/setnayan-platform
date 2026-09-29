## 2026-09-29 · fix(privacy): the visibility options say what the join link really does

The event privacy page (`website/privacy/page.tsx`) still described the
2026-09-16 model: Public, Unlisted and "guests with an account" each said a
shared link hands anyone the Event Hub and a camera. Since the 2026-09-26 ruling
("nobody without a key gets inside until the couple links or accepts them") the
join code ends every keyless arrival in `createJoinRequest` — a row in Requests,
nothing opened — and only when the couple turned on "Anyone, I approve".

- Public / Unlisted / guests-with-an-account now say: anyone may read the page
  (per option), getting inside takes a guest's own key, and with "Anyone, I
  approve" on a stranger can ask to join and waits in Requests for Keep, Link
  or Remove. Private: "nobody new can ask to join".
- The Unlisted description rendered a literal `—` in production (a JS
  escape inside a plain JSX attribute string, which JSX does not decode) — now a
  real dash, as are the new quote marks.
- The Maker's short picker said Private is "Only you and your hosts"; the gate
  (`closedEventAdmits`) also admits key holders and linked guests — now "Only
  your hosts and your guests." Two Maker hints said "site" → "Event Hub".
- `lib/the-privacy-setting-says-who-can-join.test.ts` was pinning the OLD
  promise and stayed green through the reversal; it now asserts the request
  path (`createJoinRequest` ×2, `anyoneMayAskToJoin`, the setting's label) and
  that no blurb names the Event Hub or a camera without the key. Reverting the
  copy fails 3 of its tests.

SPEC IMPACT: None — copy now matches DECISION_LOG 2026-09-26.
