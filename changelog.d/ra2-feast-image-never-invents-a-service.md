## 2026-09-07 · fix(moodboard): the feast image never invents a service, and never swallows a station

`20271212409881` switched `feast` on with a gate that reads *"is the flat feast
group empty?"*. For every decor zone before it that was the same question as
*"is there something here for the image to replace?"* — `stage` and `tables` each
draw ONE restyled object. `feast` is the first zone whose flat drawing holds more
than one independently chosen object: a service line AND, ticked separately, a
cake table, a mobile bar, a coffee cart.

**Measured on the shipped code, not inferred:** a couple with
`feast.service = 'plated'` who ticked a cake table got the generated **buffet
line** drawn into their room — a service they explicitly did not choose — and
**lost the cake table they did**. `service: 'none'` plus any station failed the
same way, and even with a buffet chosen the station was swallowed. The existing
guard probes `service: 'none'` with `stations: []`, where the whole group is
empty, so it passes whether the gate is the service line or the group, and could
not see any of it.

The gate is now the service line itself, and the stations are drawn AFTER the
image rather than replaced by it — standing in front of the generated buffet.
With no decor layer the render is byte-identical to before, as MB14b requires.
Sabotage: restoring the shipped gate verbatim turns the new guard red, as does
keeping the gate but swallowing the stations.

SPEC IMPACT: None. No schema, no rows, no artwork — a wiring correction to the
zone seeded by `20271212409881`.
