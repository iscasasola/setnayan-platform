## 2026-11-25 · fix(supplier): final check area 5, lane B 3 — "Tell us what you do" opens in place inside the maker

- **B9** (A5-G3-06) The three steps (group → category → name) open in place inside the card maker's layer, not as
  three page loads and not as a second layer. The head reads "‹ Tell us what you do" over the screen's name; ‹ steps
  back one step, and from step 1 back to the maker as it was — every typed field kept, at the same scroll.
- The maker's "Ask us" row and its reason sentence open the steps in place (their address stays for a hard load). The old
  address `/vendor-dashboard/services/requests/new` forwards to the maker with the section open, carrying where it stood.
- No new server action: the name step posts the shipped `proposeCategory`. RiseScreen / the dialog head gain a `back`
  (‹ in ✕'s place); RiseRoute lets an open section name the head; TemplateRow gains `onPress`.
- Guard: `app/vendor-dashboard/services/requests/tell-us-opens-in-place.test.ts`. Depends on lane B 2 (#8341).

SPEC IMPACT: None.
