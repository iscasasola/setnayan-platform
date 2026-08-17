## 2026-08-17 · fix(compliance): the face DPIA credited a tag cap that no longer exists

The shipped face-vector impact assessment described QR tagging as "capped at 10 tags/photo" and
listed **"max 10 tags/photo"** among the controls MITIGATING a misidentification risk (BV-5).

**There is no tag limit.** The owner retired all per-photo caps on 2026-08-06 (*"no tag limit. we
can tag as many"*). Read out of the live production function — not a document, not a comment —
the only remaining bound is a **100,000** runaway-write backstop, which is a loop/retry guard and
was never a product rule or a privacy control.

🔑 **Same shape as the "5-year deletion" control corrected earlier today:** a risk assessment
handed to a regulator whose safety rating rests on a mechanism that is not there. The rating, not
just the sentence, was wrong.

⚠ **Also lands the handoff for what is NOT done.** An 8-agent verification of the 15 remaining
audit findings **failed entirely on a session usage limit** and returned `confirmed: 0`. That
means **nothing was checked** — not that nothing is wrong. `WHATS_NEXT_NPC_Pack_Findings_2026-08-17.md`
in the spec corpus carries the full list, what is already closed, the guard rails a re-run must
carry, and the two owner-authorised deletion jobs that remain unbuilt.

Among the unverified: whether a guest who withdraws consent actually gets their face blurred as we
promise, whether the analytics off-switch we advertise exists, whether erasure really deletes,
and an outside company in Germany that may receive text couples write while being named nowhere.

SPEC IMPACT: Applied directly in the corpus — `NPC_Compliance/06_DPIA_Face_Vectors_DRAFT_2026-07-05.md`
+ new `WHATS_NEXT_NPC_Pack_Findings_2026-08-17.md`. Pack regenerated (13 documents, 128 pages).
