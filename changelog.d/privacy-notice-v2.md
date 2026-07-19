## 2026-07-13 · docs(privacy): disclose faith/family/honoree/e-gift data + complete subprocessors

Reconcile the public `/privacy` notice to the as-built platform and the v2.0 NPC
dossier. Adds two sections — **Optional personalization & family details**
(self-profile religion / civil status / gender; dependents & godparents incl.
minors' data; event honoree/specialty data such as christening child DOB/gender
and gender-reveal due-date; guest dietary as sensitive) and **Gift-receiving
details (Pabuya)** (couple's own GCash/bank/e-wallet handle + QR; Setnayan never
holds or moves money). Adds **Anthropic** and **Suno** to the subprocessor list.
Softens the device-identifier copy to match its flag-OFF/dormant state. Bumps
last-updated to 2026-07-13.

No schema or behavior change — disclosure copy only. Notice previously already
carried proper Biometric + Device-identifier sections (the earlier "denies
biometrics" report was from a stale local checkout, not `origin/main`).

SPEC IMPACT: Applied in corpus — `NPC_Privacy_Compliance_Dossier_2026-07-12.md`
(v2.0, full ROPA + SPI + subprocessors) + `Privacy_Reconciliation_Home_and_Data_Flows_2026-07-13.md`.
Still open (owner/counsel): external legal review before NPC filing; binding
`01_Contracts/Setnayan_Privacy_and_Security_Policy.md` alignment (SLA, 10-yr floor,
vendor-verification retention class, subprocessor table).
