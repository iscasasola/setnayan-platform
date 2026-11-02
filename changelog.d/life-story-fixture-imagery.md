## 2026-07-08 · fix(life-story): real demo imagery in fixture mode

Owner QA feedback ("just backgrounds — cannot decipher"): fixture mode now carries REAL demo media — deterministic seeded photos (picsum, same moment ⇒ same picture) + Google sample clips — passed through as display URLs in the fixture branch only. Production media is untouched (real rows carry R2 keys and always take the signed path; the fixture branch never runs in prod).

SPEC IMPACT: None.
