## 2026-07-02 · fix(vendor-profile): adversarial-review fixes for the vendor-website redesign

Follow-up to the 4 redesign slices (#2578/#2585/#2588/#2596), fixing 3 defects a
multi-agent adversarial review confirmed (each refuted-then-confirmed by two
independent skeptics):

- **Get-in-touch contradiction (medium):** the "Already a Setnayan couple? Start
  a thread from your dashboard" copy rendered directly above the new compose-first
  Inquire composer for the SAME eventless visitor — telling them to use a
  dashboard they don't have while the composer says "Log in free". The copy is now
  composer-aware: it only shows the "from your dashboard" line when no composer
  renders, and a "send an inquiry below" lead-in otherwise.
- **Dispatcher dropped messages on transient errors (low):** the dispatcher's
  `else if (error) clear` treated EVERY startServiceInquiry error as terminal and
  cleared the localStorage stash — but that status also covers a transient
  chat_threads upsert blip, so a momentary DB error permanently discarded the
  couple's only copy of the composed message (and contradicted the file's own
  docstring). Now ANY non-ok result keeps the stash for a later retry; a genuinely
  dead stash is reaped by the existing 48h TTL instead.
- **Non-deterministic Trusted-by badge (low):** `fetchTrustedByVendors` had no
  ORDER BY, so when an endorser held two accepted partnership types the first-wins
  dedupe could flip the visible badge between renders. Added a deterministic
  `.order(relationship_type).order(recommending_vendor_id)` (accredited wins ties).

Not fixed here (surfaced separately): a pre-existing chat first-message race — the
non-atomic count==0 first-message check (chat-send.ts / inquiry-actions.ts) has no
DB-level uniqueness, so two concurrent inquiry writers for one (event,vendor) can
each send the first message. `chat_threads` UNIQUE still prevents duplicate
threads; worst case is a duplicate message + in-app/push notification (no email).
The compose-first happy path (signup-first) does NOT trigger it. Root-cause fix is
DB-level in shared chat-core (partial unique index / advisory lock) — deferred for
a separate, owner-visible decision.

SPEC IMPACT: None — bug fixes over this session's additive UI. See DECISION_LOG.md.
