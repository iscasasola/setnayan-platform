## 2026-11-25 · fix(final check, area 3, batch 3): one reveal picker; failed reads stop reading as facts

From the final check of the staging copy (area 3, lane A).

- **N-10 / Add 18 (owner, 25 Nov):** the reveal is edited in the Event Hub only. Save the Date's Step 5 no longer offers a second picker. It names the opening its preview plays and links to "Choose your reveal in the Event Hub" (`detailsItemHref(eventId, 'reveal')`).
- **N-09:** the send run's guest QR shows "Couldn't load {name}'s QR. Their link still works" when the image fails, instead of an empty white frame. The guest's mobile line stays: it is in the approved send-run drawing, and Send shares through the phone's share sheet or the messaging apps, not SMS.
- **E-16:** Privacy says "Couldn't read whether featuring is on" when the consent read fails, instead of "Off" with a switch. Privacy, Photo moments, Set the mood and Sections show the error page on a refused event read, instead of bouncing to Home.
- **I-07 (send part):** a failed events read on the send run says it could not read the address, never "no address yet".
- **Server actions:** no new export. No migration. No price, plan or sign-in rule changed.

SPEC IMPACT: None. N-10 builds the owner's Add 18 ruling (final-check owner adds, 25 Nov), already ruled; no new decision.
