## 2026-07-24 · feat(chat): explicit "+" composer entry — Send a deal / Request a meeting

Owner decision (council verdict 2026-07-24): keep the auto-suggest chips AND add a deliberate composer entry.

- New `NegotiationComposerMenu` above the message box on both thread pages: a "+" that opens **"Send a deal"** (the multi-line Deal builder) and **"Request a meeting"** (bounded date + time-slot form). Reuses the same server actions (`createAmendmentFromChat`, `createScheduleRequestFromChat`) + `AmendmentBuilder` the chips use — so a structured card can be started deliberately, not only when the reader auto-suggests it.
- Flag-gated on `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF) — renders nothing when off.

No schema/migration. typecheck 0 · full lint clean · radius clean · full suite 3029 green.

SPEC IMPACT: implements the council verdict's "both entry points" decision (iteration 0019). Remaining: customer "Lock this deal" (`thread.agreed_price`). Payment/5% = separate session.
