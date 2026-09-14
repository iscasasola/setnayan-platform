## 2026-09-14 · feat(invite): Abaca — the Rugged invite theme, the last of the four

The fourth and last Event Hub Pro invite theme ships as a skin on `DoorShell`:
a letterpress show-card on kraft, with the couple's reveal background PRINTED
INTO the paper (`mix-blend-mode: multiply`, so the bare sheet is always the
white point), their date struck as a rubber stamp, their mark pressed as a wax
seal beside their name, and their colour as the twine DoorShell's own step rail
hangs from. With the Invite group closed, every theme the owner named on
2026-09-10 is now live.

SPEC IMPACT: None — `lib/invite-themes.ts` already carried the Abaca row
(`opening: 'four-flap'`, owner 2026-09-10); this only flips `ready` to `true`
now that the skin exists. No migration, no table, no SKU.
