## 2026-09-15 · fix(gifts): a bank account number is shown to invited guests, not to the internet

Owner, shown his own bank account name and number returned by a fetch with **no
session at all**: ***"gate the account number."***

### What was public

`/[slug]/pabuya` is reachable by anyone holding the link — **deliberately**, and
unchanged here, because that is how a relative abroad sends a gift. What was
wrong is that the **payment identifier** travelled with it. Measured on the live
page minutes after it went live: account name and full account number, no
session, no invitation.

### What changes

An unrecognised reader sees that the couple accept a bank transfer, and the
account's **name**. The **number** and the **QR** are shown only to someone the
event recognises — a guest carrying their own invitation session, or a signed-in
host.

🔑 **The QR is gated WITH the number, not left behind.** A bank QR encodes the
very account it stands for; hiding the digits while printing the code beside them
is a gate with a window next to it.

🔑 **And the page says so.** A bank card with no number, no QR and no sentence
reads as a couple who filled the form in wrong. *"Bank details are shown to
invited guests. Open your own invitation link, or scan your QR, and the account
number appears here."* That sentence is the difference between a gate and a bug.

### ⛔ Wallets are deliberately NOT covered

The ruling was about the **account number**, and a bank account is the case that
cannot be undone: a couple can change a GCash number in an app; they cannot
rotate a bank account. A wallet handle is a mobile number and is arguably the
same question — **it is left alone because nobody has ruled on it.** Widening a
disclosure rule past what was asked is how the next person inherits a decision
nobody made. Stated in the code, not just here.

### Guarded

| Sabotage | Result |
|---|---|
| Publish the number again | 🔴 red |
| Leave the QR ungated | 🔴 red — *"a bank QR encodes the very account the number was hidden to protect"* |

Recognition is pinned too: a guest session **for this event**, or a host asked
through `isHostMemberType` — never `Boolean(row)`, which once waved a
`guest`-typed member into a private site.

SPEC IMPACT: owner disclosure ruling; logged in `DECISION_LOG.md`.
