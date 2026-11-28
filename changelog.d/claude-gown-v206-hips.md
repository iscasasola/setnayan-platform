### Gown maker: the waist no longer drags the hips down (prototype v206, owner-reported)

- **Owner, 28 Nov:** *"why is it when the waist goes down, the hips goes down as well?"*
- **Hips she gave herself never move when the waist changes.** The waist stops at 6/10 of her hips (a true hourglass, the most the mannequin can shape) with one line: *"The waist stops at 60 cm: her hips are 100 cm … Change her hips first to go lower."* The line shows at most once every 4 s.
- **Hips she has not given** are pulled in only as far as a very small waist needs, and come back to what they were as the waist rises (`hipWant`).
- **A hip change forgets that wanted value** and holds the waist between 6/10 of the hips and hips + 8 cm.
- The ratio was 0.66 and one-way: hips taken in never came back.
- Checked step by step against prototype v206's own sliders, notes included. The "Double-check" note and the weight balance are unchanged.

SPEC IMPACT: None (ports prototype v206 from the specs corpus, specs 9fed2db).
