import type { VendorSet } from '@/lib/vendor-sets';

/**
 * What your band is actually going to play — read-only, on the couple's own
 * playlist page (owner 2026-08-06: "couple or host of event should see the song
 * list for their event").
 *
 * The band has been able to build these set lists for a while. The couple could
 * not see them at all, because each table carried exactly one policy and its
 * audience was the vendor. This renders what that policy now admits.
 *
 * 🔑 READ-ONLY, AND THAT IS THE DESIGN. The set list is the ACT'S work — their
 * running order, their labels. The couple's own instrument is the picks list
 * above; giving them edit controls here would let two people author the same
 * thing from opposite sides with no rule about who wins.
 */
export function HostSetlistPanel({
  acts,
  failed,
}: {
  /** One entry per booked act that has built at least one set. */
  acts: { actName: string; sets: VendorSet[] }[];
  /** The read was REFUSED, as opposed to there being nothing yet. */
  failed: boolean;
}) {
  // 🚨 A REFUSED READ AND AN EMPTY SET LIST ARE THE SAME VALUE. Saying "nothing
  // yet" when we simply could not look tells the couple their band has done no
  // work — a false claim about someone else, quite possibly on the day they are
  // checking. Say what is true instead.
  if (failed) {
    return (
      <section className="sn-tile space-y-2 p-5">
        <h2 className="sn-eye">What your band is playing</h2>
        <p className="text-sm text-ink/70">
          We couldn’t load your band’s set list just now. It hasn’t been lost — try
          again in a moment.
        </p>
      </section>
    );
  }

  // Nothing built yet is a real, ordinary state and gets no panel at all: an
  // empty box on the couple's page reads as something broken.
  if (acts.length === 0) return null;

  return (
    <section className="sn-tile space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="sn-eye">What your band is playing</h2>
        <p className="text-xs text-ink/55">
          Built by your act from your requests. This is theirs to change — your own
          picks are above.
        </p>
      </div>

      {acts.map((act) => (
        <div key={act.actName} className="space-y-3">
          {/* One block per act. Two booked acts may BOTH have a "Set 1" — the
              uniqueness rule is per act, not per event — so the act's name has
              to head each block or the couple reads one list as two. */}
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {act.actName}
          </p>
          {act.sets.map((set) => (
            <div key={set.setId} className="rounded-lg border border-ink/10 p-3">
              <p className="text-sm font-medium text-ink">
                {set.name}{' '}
                <span className="font-normal text-ink/50">· {set.slotLabel}</span>
              </p>
              {set.songs.length > 0 ? (
                <ol className="mt-1.5 space-y-0.5">
                  {set.songs.map((s) => (
                    <li key={s.setSongId} className="text-sm text-ink/75">
                      {s.title}
                      {s.artist ? <span className="text-ink/45"> — {s.artist}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1 text-xs text-ink/45">No songs added to this set yet.</p>
              )}
              {set.missingFromHost.length > 0 ? (
                <p className="mt-2 text-xs text-ink/55">
                  You asked for {set.missingFromHost.length}{' '}
                  {set.missingFromHost.length === 1 ? 'song' : 'songs'} in this moment
                  that aren’t in their set yet:{' '}
                  <span className="text-ink/70">
                    {set.missingFromHost.join(', ')}
                  </span>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
