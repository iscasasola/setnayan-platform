## 2026-08-28 · fix(pay): once the proof is in, the page stops telling you to pay

Owner, on his own pay page after sending proof: *"After I paid, it should say we
are currently verifying your purchase. kindly wait within 24 hours. (1) and (2)
must not show anymore."*

The page kept rendering *"Scan the code with your GCash or bank app"* and *"Pay
this exact amount"*, with a live QR and an "I've paid" button, **underneath** a
notice saying we were checking his payment. It told somebody who had already paid
to pay. The worst outcome of that sentence is that they pay twice, into a rail we
reconcile by hand.

The waiting state is now the whole page. What survives is what a waiting person
still needs — what they bought, the amount, and the reference they would quote if
they had to ask us about it. A refused proof puts everything back.

SPEC IMPACT: None.
