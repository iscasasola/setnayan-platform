## 2026-11-24 · docs(apple): the 1.0 (build 9) submit list, measured on main

- New `build-sessions/APPLE-SUBMIT-2026-11-25.md`. It replaces the 22 Nov pre-submit list. Every item is marked DONE or NOT DONE, with its evidence from `origin/main` and the live site.
- Section 2 holds the App Review notes, ready to paste. They carry the current product ids and the tap path to every buy button. Music Maker, Patiktok and Setnayan AI are left out.
- Section 3 lists the owner's steps in order:
  - App Store Connect products match the code;
  - the Apple switch is on in Vercel;
  - review screenshots on his own test event;
  - archive and upload from Xcode;
  - submit with Manual release.
- The code fix the list found ships alone in #8292, and it must be live before the submit.
- Docs only. No code, migration or email.

SPEC IMPACT: None. A build-session checklist; no product decision changes.
