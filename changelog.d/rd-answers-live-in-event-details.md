## 2026-10-02 · feat(your-info): every onboarding answer lives in Your info — and the app obeys it

Owner rule (DECISION_LOG 2026-10-02, "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT DETAILS ("YOUR INFO") — ONE HOME, MAPPED").

- The onboarding's last four answers, written into `style_preferences.setup` and read by nothing, each get ONE column (migration `20271260666366_answers_live_in_event_details.sql`: `papic_on`, `gifts_on`, `logo_wanted`, `cover_photo_wanted`; backfilled from the blob, then the four keys are stripped so nothing keeps a copy; SELECT + UPDATE for `authenticated`, `events_host` rebuilt).
- Your info rows: **Photos from guests** and **Gifts** (the type's own word) in Your event; **Do you want a logo?** on the Logo item; **Event photo** on the Hero item. One `PickMenu` each, saved as a Maker draft (live at Apply, never Pro, +0 server actions).
- Obeyed: Papic "No" arms no free pool or camera at the commit (all three onboarding paths), closes the guest camera door (`eventPapicGuestAccess`), takes no capture (`eventAcceptsNewCaptures`), drops Home's "Your free camera is ready" and is not re-armed by the studio's self-heal; turning it on arms both at Apply. Gifts "No" empties the guest-facing gift reader (doors, page, prints), 404s the gift page and drops the Maker's E-Gifts place. Logo "Make one" / photo "Upload" keep their What's left step open until done; "use our names" / "theme picture" answer it.
- `/details/change` (Event settings) folds into Your info › **Event settings** (its three editors moved whole; names and date stay their own items). The old address forwards with a 308 (`lib/legacy-redirects.ts`); the route count drops by one.

SPEC IMPACT: None
