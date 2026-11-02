## 2026-08-02 · fix(privacy): the notice never stated how long we keep anything — and the one disclosure that couldn't be switched off never said so

Closes the per-clause `/privacy` honesty audit left open by
`Interim_Payments_and_Privacy_Deferral_Policy_2026-07-24.md` §5, plus DPO gate 0e.
Full audit record: `Privacy_Per_Clause_Honesty_Audit_2026-08-02.md` (corpus).

**Method.** Mechanical pass over all 31 `<Section>` bodies for four clause families
(scope · opt-in/out · retention · withdrawal), then a read of every flagged
section, discarding false positives — a "Contact" section owes no retention
clause. 28 of 31 needed nothing. Two genuine gaps, both **omissions** rather than
misstatements, so the §3 honesty guardrail was never actually broken.

**GAP 1 · No retention period for media, anywhere.** A grep for any retention
figure across 1,415 lines returned three narrow disclosures — a TikTok grant, a
Drive connection, BIR records. **Photos and video, the largest and most sensitive
category we hold, had no stated retention at all.** Not an undecided question:
every number already existed in `Data_Retention_Schedule_2026-07-11.md` and the
notice simply never carried them.
→ New section **"How long we keep things"**, the schedule restated for a reader:
media **5 years** post-event (hot 90 days → cold), face vectors **per-event,
deleted on withdrawal or with the media**, chat **5 years**, payments/receipts
**10 years (BIR floor — we cannot delete early)**, contracts **10 years**, account
**life + 30–90 day tail**, tickets **2 years**, logs **≤90 days, no PII**, device
hash **life of account, 24-month prune**. ⚠ It must move in lockstep with the
schedule; a comment at the insertion point says so.

**GAP 2 · The one disclosure that never said whether you can opt out.** §"Vendor
interest counts" describes the same-date demand signal thoroughly — aggregate
only, inquiry-only, min-3 floor, exact-date only, never dressed as scarcity.
Every *other* processing section tells you how to switch the thing off. This one
didn't, **because the answer is no.** A notice that goes quiet exactly where the
answer is unflattering is not an honest notice.
→ Added: it cannot be switched off, what protects you instead (an integer ≥ 3
with nothing attached pointing back to you), and that not sending the inquiry is
the only way out.

**DPO gate 0e · the consent copy named the technique, not the processing.** The
RSVP selfie consent said "facial-recognition photo matching for this event" but
neither **where the photos come from** (largely other guests' own phones — Papic
Pool sells shots to attendees) nor **what the match is for** (delivery to your own
gallery). Both now stated in the checkbox the guest actually ticks.

**Coverage notes corrected.** `same_date_demand`'s note claimed a `/privacy`
paragraph was owed — **stale**, §"Vendor interest counts" already existed. All
three notes now point at the RoPA rows drafted today; `declaredIn` deliberately
stays EMPTY until the bundled ROPA **PDF** is regenerated, because that field
claims declaration in a shipped filing artifact, not in a markdown draft.

Corpus (separate commit): RoPA **DPS-15** guest columns · **DPS-16** Papic shared
pool · **DPS-17** same-date demand · **DPS-18** WebRTC/TURN (closes the entry owed
by security-handoff task #42) · **DPS-05 amended** to name guest-phone capture and
face-sorted delivery (DPO gate 0d).

Verification: unit suite **6135 pass / 0 fail**; all three changed files parse
clean via the TypeScript compiler API; `lint-changelog-dir`, `lint-page-masthead`,
`lint-guest-legibility` pass. ⚠ **Full `tsc --noEmit` could NOT be run — it died
on heap exhaustion (Mark-Compact ~4 GB, allocation failure).** No green typecheck
is claimed here; CI is the authority.

SPEC IMPACT: `Privacy_Per_Clause_Honesty_Audit_2026-08-02.md` added; RoPA extended
by 4 activities + 1 amendment. No control status changed, no data-handling change.
