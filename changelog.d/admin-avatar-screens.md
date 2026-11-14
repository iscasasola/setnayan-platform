## 2026-11-14 · feat(admin): the avatar's screens — Switches, Business & compliance, Email delivery, Secrets & integrations

Owner go 14 Nov 2026 (*"Yes, queue the builds"*) on the approved drawing `Setnayan-specs/prototypes/admin_five_tabs_2026-11-13/admin.html`.

- **/admin/switches (new):** every for-everyone setting. Setnayan AI paywall (env default · on · off), Referral program, the /sample switch, Demo mode — each flip behind the house confirm that names who it reaches, posting to the SAME action as before (`setAiPaywall`, `setReferralProgramEnabled` now return here through an allow-listed `back` field; no new server action). Read-only, said so: the fee lock, homepage Spotlight, Demand Radar flags (no writer today) and the env-only flags. A refused read switches every control off.
- **/admin/business (new):** Business identity on the house form rows (same `saveBusinessIdentity`, same field names), brand icon (reset now asks first), loading animation, Sentry smoke test, doors to Onboarding and Payment methods, then the RA 10173 Compliance facts and the NPC data sheet.
- **/admin/email-delivery (new):** Resend facts (source · from · last tested — presence booleans only) + Send a test email, the 7-day delivery log as numbers between hairlines, the morning digest beside its last send, push on this device, the bell.
- **/admin/secrets:** the same reads and actions, drawn as template sections; every secret is a house Fold; Redeploy production asks first; doors to Integrations and Live Watch channels; the Apple renewal shows here from Dec 8 too.
- **Old addresses forward, with their flash params:** `/admin/settings` (every `?tab=`), `/admin/compliance`, `/admin/notifications`, `/admin/settings/demo-mode`, and the demo-mode toggle's own return.
- `app/_components/template-rows.tsx` is a byte-identical copy of the one in open PR #7632 (the shared row kit), so either merge order is clean.

SPEC IMPACT: None — builds the approved drawing; no decision changed.
