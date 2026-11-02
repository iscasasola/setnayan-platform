## 2026-08-05 · fix(admin): the phone search finds what you mean, like the laptop already did

The owner typed "pending" into the admin search and got *"Nothing called
pending."* — correct, and useless: three different pages hold pending work and
none has that word in its name. That was fixed by giving the desktop palette a
haystack of descriptions plus hand-picked aliases.

🪤 **THE PHONE HAS ITS OWN FILTER, AND IT KEPT MATCHING TITLES ONLY.** So the
identical complaint stayed live **on the device the owner actually reported it
from**, while looking fixed everywhere I checked. "Pending", "refund", "proof",
"gcash", "erasure", "scam" all worked on a laptop and returned nothing on a
phone.

The alias list moved out of the palette and in beside the nav descriptions, and
both surfaces import it. Phone cards now carry the same haystack — name,
section, description, aliases — and the filter reads it, **falling back to the
label** so any grid that has not adopted the attribute keeps filtering exactly
as before rather than silently matching nothing.

🔑 **ONE LIST, TWO READERS.** A guard fails if either surface stops reading the
shared list, if a second literal alias table reappears, if the filter reverts to
label-only, or if a word the owner has actually typed stops resolving —
including "pending" itself, the exact word from the screenshot. Mutation-checked
against the label-only revert.

SPEC IMPACT: None.
