# Maps and connections audit (24 Nov 2026)

> READ-ONLY audit. Owner, 23 Nov: "connect all maps and connections to the database, if any."
> This lane only finds problems and groups them into fix batches. No app code is changed here.

STATUS: building. The findings table and fix batches follow as each pass completes.

## Passes

1. Maps: every map, pin, radius, route or location picker.
2. Connections: counts, lists, prices, names, badges, statuses fed by constants, samples, placeholders or a failure that reads as empty.
3. Dead doors: buttons and links that go nowhere, 404, or point at a retired page.
