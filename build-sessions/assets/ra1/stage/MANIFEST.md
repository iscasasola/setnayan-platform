# RA1 stage keepers - manifest (recovered from Higgsfield history 2026-09-06 by oversight)

The pilot session reported these four as keepers but left no files on disk; oversight re-downloaded them by job id. Slot hex + tolerance are the PILOT SESSION'S measurements (engine metric) - RA1 must re-measure before seeding.

| family | file | job id | sha256 | paths | slot 1 hex (pilot) | tol (pilot) | nearest neutral, engine metric (oversight recheck) |
|---|---|---|---|---|---|---|---|
| elegant-simple-classic | `elegant-simple-classic.svg` | `0326170e-1e9f-44e5-9743-e13ae1381dba` | `36b8e4716ce3ac787d7d6e35d8ca67a608d2e19c18a39084d99aeacf420fae9e` | 37 | `#C9A059` | 9 | 16.9 |
| tropical-heritage | `tropical-heritage.svg` | `eb31811d-6219-4567-9630-9c7b00353c5d` | `6d4127551193ba82b70a398d7c431dd7e87451ee3a14759154713087b9ddead3` | 84 | `#9CB29A` | 15 | 20.5 |
| modern-minimalist | `modern-minimalist.svg` | `a4c02e1d-feac-4ca9-a705-dcce7da3ba53` | `82031af11dadb7fca2d7d222deb656f8f0b8c75c2be3c340cca55af53d86dedb` | 22 | `#4A3B45` | 15 | 22.6 |
| editorial-cream | `editorial-cream.svg` | `1ebcaafd-53ce-4924-860e-7d033ffc49e1` | `0c74031350e5a323cff2850ef2af420264f108679fca3072df7c92573598f3b2` | 49 | `#D98BA6` | 15 | 14.0 |

Bridgerton regal: UNSOLVED after 4 generations (6f08da44, abb696a4, c8007776, 4dc332b6 - ornate chairs/sofa tagged, or two same-hue regions). Cell stays flat SVG.

WARN (oversight recheck, flat-fill census, engine metric): editorial-cream's nearest neutral to its slot is 14.0 while the pilot recorded tolerance 15 (and "maxClean 30"). Those two numbers cannot both be right on the same file. RA1 seeds the LARGEST tolerance at which no neutral moves on the real raster (plan Part 2), and reports which measurement was wrong.
