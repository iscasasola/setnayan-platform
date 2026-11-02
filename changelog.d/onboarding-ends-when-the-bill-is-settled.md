## 2026-08-28 · feat(onboarding): setting up ends where the bill is settled, not on a ledger entry

Owner: *"i will go here? it should be settled first. After I paid, it should say
we are currently verifying your purchase. kindly wait within 24 hours. […] Then
the onboarding end. No option to pay later. then need to go back to uncheck their
papic and setnayan AI purchase."*

Finishing the wizard now opens `/pay/[reference]?setup=1` — the page with the QR
carrying the amount, the account number and the proof form — instead of the
dashboard's ledger entry for the bill. The order page is where a bill LIVES; the
pay page is where one is SETTLED.

In set-up mode the page has two doors and no third: settle it, or remove the
extras. The dashboard "back" link is gone, because on the last step of setting up
it reads as "skip this". After the proof is in, the removal door is replaced by
"Finish setting up".

**"Go back and uncheck" is a cancel, not a rewind.** The event exists before the
bill is minted — that is where the reference comes from — so re-entering the
wizard would re-run a commit that has already happened, and the likeliest outcome
is a second celebration. Removing cancels the bill and lands them in the
celebration, which stays live with its free shots either way.

The removal states its cost: these can be added later, at the price without the
set-up discount.

SPEC IMPACT: None — no price, SKU or locked decision moves.
