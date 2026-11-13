## 2026-11-13 · fix(services): Add a service — honest reads, the plan meter, specialties per service (#7549 audit holds)

Four audit holds on the ONE Add-a-service picker (ruling 5820), fixed by extending what the sign-up already ships:

- **"On your shop" is an honest read.** `loadMakerContext` now returns `ownKinds: null` when the shop's own services could not be read (it was `[]`, which drew the picker as if the shop had nothing). The picker then shows "Couldn’t load your services. Try again." with Try again and the blank card, and does not draw the picker.
- **The service list has a fallback line.** An empty tree (the live taxonomy is never empty, so this means the read failed) now shows "Couldn’t load the list of services. Try again." It used to drop silently into the blank maker.
- **The plan meter.** The sign-up's coverage line is pulled out of `ServiceCards` as `CoverageMeter`, and the dashboard draws the same one. It counts what is on the shop plus the new picks, and the plan comes from `TIER_CAPS` through `coverageLine`, with no number typed. It is a meter, not a gate.
- **Specialties per service.** Each picked service gets its own "+ Specialties (optional)", using the sign-up's `Specialties` chips from that service's own schema. The chip read moves into `getServicePickerSpecialties`, which both pages call. The picks travel with their own service only (`?sp=` → `card_specialties` → `commitVendorService`), are pre-ticked in that card's Details fold, and are saved only when that card is saved (`lib/card-queue.ts`).
- **Owner ruling, 13 Nov.** Free and Verified shops may pick one group or several at sign-up. There is no one-group cap at the pick, and the PR never added one. A test now holds this: neither the shared picker nor the dashboard picker reads the plan to refuse a pick (`lib/open-shop-more-services.test.ts`).

Lab: `/dev/card-maker-lab?type=caterer&host=add` with `&read=shop` and `&read=tree` for the two unread states.

SPEC IMPACT: None. This implements ruling 5820 and the prototype `makers_match_2026-11-07` §2 as drawn.
