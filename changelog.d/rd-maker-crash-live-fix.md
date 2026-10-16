## 2026-10-16 · fix(maker): live crash on open — a server element as a button icon arrives as a lazy and was drawn as a type

The owner's Maker (Studio) would not open: "Something on our end didn't work", React #306 in the browser and
"Element type is invalid … got: object" on the server (`app_fault_issues`, build 85b2c52). Reproduced on a local
PRODUCTION build replaying cale-ice's real rows read-only; dev mode does not crash, which is why every lab walk passed.

Cause: Studio › Prints' pass-card zip row is built in the server module `maker-prints.tsx` with
`icon: <PaidMark state="unlocked" …/>` (a server component) and reaches the client `ActionButton` through
`StudioTool part="pass-rows"` → `PrintSaveButton`. A production RSC payload delivers that element as a React lazy;
`ActionButton.renderIcon` asked `isValidElement(icon)` (false for a lazy) and drew it as a component type. Only an
internal (Studio) account on an event whose zip is unlocked took the branch.

Fix: `lib/icon-is-a-component.ts` — only a function or a forwardRef/memo is a component; anything else is drawn as a
node. Guard: `lib/an-icon-node-is-never-drawn-as-a-type.test.ts` feeds the exact live lazy shape (sabotaged red with
the live message, restored green).

SPEC IMPACT: None
