# MB28 ceremony drawings — manifest (generated 2026-09-06 by oversight)

Model: Recraft V4.1 `vector` via Higgsfield. Placeholder slots: florals `#D98BA6` = slot 1, fabric `#E8D9B5` = slot 2.
Every file: no gradient stop within tolerance of either slot; every candidate judged on a simulated burgundy/gold recolour, not on fill counts.

| setting | file | sha256 | paths | gradients (neutrals only) | florals paths | fabric paths | min ΔE neutral→florals | min ΔE neutral→fabric | fabric tolerance ceiling |
|---|---|---|---|---|---|---|---|---|---|
| ancestral_house | `ceremony-ancestral_house.svg` | `8acdb230e518804b53e5acdf42c4224a34c6c5a4abb86b7f9a0dbc64d9fd6a40` | 143 | 0 | 11 | 1 | 38.4 | 14.4 | ≤ 11 |
| beach | `ceremony-beach.svg` **(re-cut 2026-09-06, MB28b)** | `d4e843bba1c457f798ced8936b3af55ff1d90c44850e495207ddfdad3ed2ee6e` | 695 | 0 | 195 | 61 | 13.1 (engine) | **9.2 (engine; sky)** | **5** (seed exactly this) |
| ~~beach (as shipped by MB28, slot 1 only)~~ | `ceremony-beach.ORIGINAL-driftwood-3.5.svg` | `db70aa2de38fc568291f87966afa429786c5a650f6261cd62e24bd35e1b57842` | 695 | 0 | 195 | 61 | 23.9 (CIELAB) | 11.9 (CIELAB) — **3.5 in the ENGINE metric**, unseedable | — |

⚠ The ΔE columns above for the other seven are CIELAB. MB28 re-measured every file in the engine's own metric (`colorDistance`, weighted RGB) and seeded from that; those are the numbers that count. The beach row was the one file where the two metrics disagreed enough to matter.
| chapel | `ceremony-chapel.svg` | `ea2b6d017e3d81d7b4d215f412d23329d720c2ef0035715d40beacdec1ea9dd4` | 169 | 0 | 17 | 9 | 35.6 | 14.4 | ≤ 11 |
| civil_registrar | `ceremony-civil_registrar.svg` | `5ff75ae2614bbbdcbc9022645530fa0a67378dd01bc05190754e174837052dca` | 434 | 0 | 29 | 131 | 34.2 | 14.4 | ≤ 11 |
| garden | `ceremony-garden.svg` | `be1ed433815c1c2a81a929ce38964893fbdf5645336330448404328e8e8fff4a` | 990 | 4 | 61 | 149 | 23.4 | 18.9 | ≤ 15 |
| hotel_venue | `ceremony-hotel_venue.svg` | `7767cea45a6ed57585aa94b9d1c87585e391a19664341eec46d3840155e9ab53` | 1086 | 2 | 101 | 45 | 33.9 | 15.6 | ≤ 12 |
| mosque | `ceremony-mosque.svg` | `2a0c1867b633cd35f71cc48cdbb9f4d457ffa346d2a40cfe8f326887daaf2874` | 1267 | 1 | 106 | 6 | 27.2 | 15.6 | ≤ 12 |
| temple | `ceremony-temple.svg` | `fe3ac620874b39f01cd01c2ae6493db4054eb44716f731e53d0fef54cda38728` | 53 | 0 | 10 | 2 | 27.9 | 17.9 | ≤ 14 |

Rejected on sight (kept in oversight scratch only, never staged): 60 of 68 variants (32 first round + 28 across three later rounds) where a pew, chair, lawn, sand, lattice, ceiling, window or chandelier took a slot colour, or the runner and flowers swapped slots.
The church (`ceremony-aisle.svg`, MB25) is already live and is NOT in this folder.
