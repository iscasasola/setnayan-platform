/**
 * Renderer for `the-cover-rsvp-reaches-its-action.spec.ts` — prints, as JSON on stdout:
 *   · `pages`: the REAL guest page body (`SiteBody`, `lib/site-body-fixture-render.ts`) of the fixture invitation for a
 *     guest with a key and for the event's host, on a full colour ground (cale-ice's shape);
 *   · `reply`: the fixture event's reply page (`inviteReplyPath`) — where the cover's button must land (owner 2026-10-26).
 * Run by the spec in a `tsx` child process (Playwright's transform cannot server-render imported JSX).
 */
async function main() {
  const { renderSiteBodyFixture } = await import('../../lib/site-body-fixture-render');
  const { fixtureStranger, fixtureWidgets, siteBodyFixtureProps } = await import('../../lib/site-body-fixture');
  const { inviteReplyPath } = await import('../../lib/invite-arrival');
  const widgets = fixtureWidgets({ hero: { ground: { kind: 'color', color: '#3a4a5a', shape: 'full' } } });
  const event = siteBodyFixtureProps().event;
  const host = { capability: 'owner', ownerUserId: 'lab-host', ownerEventId: event.event_id, maySiteEdit: true } as const;
  const pages: Record<string, string> = {
    guest: await renderSiteBodyFixture({ widgets }),
    host: await renderSiteBodyFixture({ identity: fixtureStranger(), widgets, heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg', ownerCapability: host as never,
      /* 🗳 The host's OWN guest row, not yet answered (owner bug 2026-10-24): the host's button reads their row and opens
         the plain reply page, which replies as that row — never the Maker’s sample. */
      hostOwnGuestId: '00000000-0000-4000-8000-00000000a002', hostOwnRsvp: 'pending' }),
  };
  process.stdout.write(JSON.stringify({ pages, reply: inviteReplyPath(event.slug ?? '') }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
