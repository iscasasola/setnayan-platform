## 2026-11-25 · fix(money): final check area 1, batch a1-a5-money

Lane A fixes for failed reads that showed as a real answer, and for pesos formatted by hand. No price, number or rule changed.

- **A1-100:** a refused price-list read (`fetchV2CustomerCatalogRead`, `ok: false`) says "Couldn't read the prices" where the paid plans and extras go on Home, /pricing and /pricing/plan, instead of a Free-only list that looks complete.
- **A1-023:** /papic says it couldn't read the Papic prices, with Try again, and no longer draws a free-only dial ("You pay nothing").
- **A1-034, A1-114:** the Papic dial, Home's plan rows, /pricing, the plan quiz and the feature pages format pesos with `formatPhp`. A feature price that couldn't be read says so.
- **A1-036:** the /panood demo has Try again (the /papic half shipped in a1-live).
- **A1-033:** "Add to an event" says "Couldn't read your events" with Try again when the events read is refused or throws, never "You don't have an event yet" or the signed-out look.
- **A1-045:** "Start a new event" opens the page's own start door (on /marketplace that was Discover), and each event row opens where the service lives (`eventHref` first, as the studio rail does).
- **A1-041:** Compare says each failed read in its own place: the shops (an error page with Try again, not a silent redirect), the reviews, the venue and the saved state.
- **A1-042:** Compare lists shops through `FINDABLE_SHOP_GATE` and draws the badge with `hasVerifiedBadge`. It is now on the findable registry.
- **A1-043:** Compare reads "your" event with `resolvePrimaryHostEvent`, as Save does, and a host with several events gets "Save to…".
- **A1-157:** the supplier grid says "Couldn't read the suppliers" with Try again when its reads fail, instead of "No services listed yet", and drops the unmeasured "suppliers are landing every week".

SPEC IMPACT: None.
