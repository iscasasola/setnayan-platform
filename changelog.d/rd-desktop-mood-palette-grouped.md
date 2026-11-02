## 2026-10-19 · fix(maker-desk): the Mood Board's five main colours stay grouped at the start of their row on a desktop

The controller's check of #6658: at 1100 px the phone's `justify-between` spread YOUR MAIN PALETTE's five circles edge to
edge. On a desktop (desk rule set, `maker-desk.tsx`) they now start the row with a 20-px gap, as the phone and the attire
rows draw them; a phone is untouched (Studio › Mood Board at 390, pixel-identical). Guard line added to
`lib/studio-on-a-desktop-is-the-phones-screen.test.ts` (sabotage: rule removed → red).

SPEC IMPACT: None.
