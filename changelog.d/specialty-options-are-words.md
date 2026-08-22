## 2026-08-20 · fix(onboarding): the details screens stop printing internal keys at customers

The owner's birthday details screen offered chips reading `1st_birthday` and
`adult_regular`. Not a rendering bug — **the labels did not exist.** In the specialty
catalog a FIELD carries a key and a label; an OPTION is a bare string, and the type
has no slot for an option label at all. The renderer printed the only thing it had.

Measured, because it is far bigger than the two chips he saw: **187 distinct option
values across every event type**, every one rendering raw — `ninong`, `pamamanhikan`,
`cord_yugal`, `summa_cum_laude`, `mythical_five`. Fixing only the birthday two would
have been a correction at one site, which this project has repeatedly learned is not
a correction.

All 187 now have authored names, with the Filipino terms kept as the words a customer
actually says (*Palabunutan (raffle)* · *Ninong (godfather)* · *Arrhae — the 13 coins*
· *Cord and yugal* · *Visita Iglesia* · *Salo-salo*).

Done as a lookup rather than by widening the option type, because the stored value IS
the key: it is already written on live rows and is what `show_when` branches compare
against. A type change also could not have reached specs authored in the DATABASE,
which the code cannot enumerate. The unknown-key fallback humanises instead of
printing code, so a new or DB-authored option can never reintroduce a raw key.

SPEC IMPACT: DECISION_LOG.md 2026-08-20.
