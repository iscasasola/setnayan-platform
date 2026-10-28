## 2026-10-28 · feat(guests): the send run, redrawn simple — full screen, one guest as a page, swipe

Owner, 28 Oct: *"invitation page still not the design we did"* (DECISION_LOG "THE SEND RUN, REDRAWN SIMPLE" · "APPROVED —
THE SIMPLE SEND RUN, PLUS SWIPE" · "CLOSING THE SEND RUN ALWAYS RETURNS TO THE GUEST LIST" · "THE SEND RUN ALSO SERVES A
ONE-QR EVENT" · "THE SEND RUN'S HINT LINE … FADES AFTER 10 S" · "APPROVED — ONE SEND BUTTON FOR EVERY INVITE"; prototype
`prototypes/send_run_simple_2026-10-27/`). `/dashboard/<id>/guests/send` (`send-run.tsx`) extended in place:
- full screen over the bars (drawn on `document.body` — the event `<main>` traps `fixed`); ✕ and **Done for now** always
  land on the Guest list; the old title, "← Guest list" and the "Who to send to" picker are gone;
- "N sent · M more to invite" + a thin bar; "Invite k of all";
- the guest as a page: their QR, name, role as a neutral pill, side · group, their +1s ("+1 · no name yet"), mobile
  (`lib/send-run-page.ts › runGuestPage`);
- ONE **Send**: phone → its share sheet (`shareInvite`), then "Did you send <name>'s invitation? Sent / Not yet" (the
  shipped `SentOrNotYet`) — Sent stamps through `setGuestInvitationSent` and moves on; computer → the shipped app rows
  (WhatsApp · Viber · Messenger) + Copy message, in place; **Invite later** skips with no stamp;
- swipe left = next, right = previous (no stamp; follows the finger and snaps; ‹ › and ←/→ on a computer; no motion
  under reduced motion);
- the hint line names the invitation's kind and fades after 10 s; the same words + "Change the message" stay in the ⓘ;
- a one-link event walks the same guests with the event's ONE link and QR (`readGuestsGetIn` = 'one_qr' → `readOneLink`).
Guard: `guests/send/the-send-run-is-the-simple-page.test.ts` (rendered run + words; sabotaged red);
`lib/to-invite-is-one-rule.test.ts` re-aimed at the new words. Port baseline regenerated (the "Who" PickMenu and
`SendInviteActions` left the run deliberately; the exits are `href={home}`). +0 server actions, no migration.

SPEC IMPACT: None (builds the 2026-10-27 rulings as recorded). Note for the owner: the run's phone Send now ASKS
"Sent / Not yet" after the share sheet instead of stamping on its own (the prototype's return frame).
