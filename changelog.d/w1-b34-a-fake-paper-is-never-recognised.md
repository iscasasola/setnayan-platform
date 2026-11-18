## 2026-11-18 · fix(verify): a fake paper is never "Recognised" (walk W1-B34)

Walk W1-B34: a photo stamped "TEST — NOT VALID", and a paper no government office issued, both read as **Recognised** on the supplier's papers row and passed auto-verify check 1. "Recognised" meant only "a file is filed and the reader returned something". So automatic approval was held (`AUTO_APPROVAL_HELD = true`, #7955).

One rule now decides it, `lib/paper-recognised.ts` (`notRecognisedBecause`). The supplier's row (`paperState`), the intake's message (`mergeIntake`) and auto-verify check 1 all use it. A paper is Recognised only when:

- **nothing on it says it is a test.** No TEST / SAMPLE / SPECIMEN / VOID / NOT VALID / DEMO stamp or word in any value read, and no placeholder number (all one digit, the 123456789 run). A real paper's own fine print ("Not valid without the dry seal", "Void if altered") is not a marker.
- **every line its type prints was read.** DTI: business name, owner, BN number, valid-until. SEC: company name, registration number. BIR 2303: name, a real TIN, address, RDO code. Mayor's Permit: name, permit number, city, address, valid-until.
- **the issuer is the government body for that type** (DTI · SEC · BIR · a city or municipal government), and not a business, school or bank.

A paper that fails is **kept for a person** (the machine never refuses anybody), and the row says why under it. A **failed read** (no reply, an error object, a reply with no valid `registry`) now parses to null. That becomes "We couldn't read papers just now". It is never Recognised and never "This isn't one of the three papers we need". Before this change, an error object became a read of type `unreadable`.

The reader's prompt now asks for `issuer` and `markings`. Reads stored before this change have no issuer, so they read as "kept for a person" rather than Recognised. That is the safe direction.

`AUTO_APPROVAL_HELD` stays `true`. Lifting it is the owner's call, once this ships and W1 re-walks B34.

Held by `lib/paper-recognised.test.ts`. 16 fake reader replies are each run through the parser, the row, the intake and the Submit check. All 16 read "Recognised" on main. Five failed-read replies are also covered. The fixtures in `auto-verify.test.ts` and `one-paper-one-state.test.ts` now carry an issuer and a non-"SAMPLE" name.

SPEC IMPACT: None. This puts the existing "clean papers verify the shop on submit" ruling into effect (only CLEAN papers verify; anything in doubt goes to a person). No new decision.
