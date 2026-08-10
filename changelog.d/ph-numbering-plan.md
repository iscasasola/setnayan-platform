## 2026-08-10 · fix(open-shop): the contact number now obeys the numbering plan, not just its shape

Owner: *"just make sure they obey the landline and mobile number rules."* Two real defects in what I shipped an hour earlier.

### 🔴 DITO mobile numbers were being recorded as landlines

`0895`–`0899` are real Philippine mobile numbers. The rule matched only numbers starting `9`, so every DITO number fell through to the landline branch — where it was **accepted**, so nothing looked wrong, and stored with the wrong `kind`.

🔑 **A value that is quietly mislabelled is worse than one that is refused.** A refusal gets reported by the person in front of it; a wrong label sits in the database and nothing ever mentions it.

### 🔴 Any area code passed, including ones that do not exist

The landline rule took *any* 8–10 digits starting 2–8, so `0391234567` — area code 39, never assigned — was a valid landline. **Obeying the plan means checking against the plan**, so there is now the actual list of assigned codes: `2` for Metro Manila, and the two-digit codes across Luzon, the Visayas and Mindanao.

**Metro Manila is pinned to exactly eight digits**, which is a rule rather than a range: the 2019 migration moved the whole city from 7 to 8. A seven-digit Manila number is one somebody has not finished updating, and it no longer rings.

⚠ **Provincial subscribers stay at 6–8 on purpose.** They vary, published lists disagree at the edges, and being wrong there refuses a real business its own number — the failure worth avoiding more than the one it prevents. Same reasoning as the area-code list itself: 🔴 **an omission there locks a real vendor out of signup and they will not tell us, they will just leave.** If a new code is assigned, adding one line is the whole fix.

### 🪤 One of these "failures" was my test being wrong

`(021) 234 5678` was in my not-a-real-area-code list. It should not have been: strip the trunk zero and the digits are `2` plus an 8-digit subscriber — **exactly Metro Manila**. The brackets are a person's punctuation, not part of the number. Pinning that expectation would have taught the parser to refuse a real Manila line.

**The code was right and the test was wrong**, and the tempting move — "make the failing test pass" — would have shipped the defect.

Mutation-tested three ways: drop the DITO range (1 fail) · accept any area code (5 fail) · let Metro Manila be any length (1 fail). Twelve real landlines from Manila to Davao are asserted accepted, so a future tightening cannot quietly start refusing them.

Verified: **7452/7452** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None — refines the rule recorded with the Philippines-only ruling.
