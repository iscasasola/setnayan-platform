## 2026-11-14 · feat(help): H6 — 32 guest answers for the invitation, the reply, the Event Hub, the day, photos and Memory lane, joining and signing out

Fills `apps/web/lib/help/user-4.ts` (guest areas UG1–UG10 of the help coverage map) with 32 public Help answers in 6 topics, each naming its source in code. Left out on purpose: gifts (`PABUYA_PUBLIC_ROUTE_ENABLED`), guests buying credits (`NEXT_PUBLIC_PAPIC_GUEST_BUY`), the 3D avatar (`NEXT_PUBLIC_FIGURE_CHIBI`), self-service new QR (`GUEST_QR_SELF_ROTATE`), automatic face matching (`NEXT_PUBLIC_FACE_MODEL_URL`), the paid seat pass. Nine existing guest answers were found stale (listed in the file header and the PR) and left for the controller to assign — topics-existing.ts is shared.

SPEC IMPACT: None.
