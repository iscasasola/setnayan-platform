## 2026-07-02 · fix(marketing): Setnayan AI overlay radii → --m-r-full tokens

Follow-up to #2645 — the new SetnayanAiOverlay used two inline `borderRadius` px literals
(20 / 22) which tripped the advisory `lint radius tokens` check. Both are pills → now
`var(--m-r-full)`, per the owner-locked one-token-scale rule. Radius guard passes.

SPEC IMPACT: None.
