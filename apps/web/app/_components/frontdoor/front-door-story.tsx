/**
 * front-door-story.tsx — the two blocks that turn the headline into an argument.
 *
 * The opening claims *"the best photo of the night is on somebody else's
 * phone."* On its own that is an assertion. These two make the reader verify it
 * from their own memory, which is the only proof a company with almost no
 * customers can honestly offer.
 *
 * ─── 1 · THE GROUP CHAT ──────────────────────────────────────────────────
 * Four beats with widening gaps, ending in silence. It is where the reader
 * laughs and then goes quiet, and the humour is LOAD-BEARING: without it the
 * page is an advertisement about regret aimed at people planning the most
 * expensive day of their lives. Keep the joke.
 *
 * 🔑 IT IS DRAWN AS AN OBVIOUS ILLUSTRATION AND MUST STAY THAT WAY. No avatars,
 * no app chrome, no sender names, monospace timestamps, plain bubbles. We have
 * near-zero customers; a vignette that could be mistaken for a real person's
 * screenshot would be a fabricated testimonial, which is the one thing the
 * whole front-door brief forbids. If a later pass "improves" this with profile
 * pictures or a phone frame, it has crossed that line.
 *
 * It is marked up as a <figure> with a real <figcaption>, and the beats are a
 * list — a screen reader gets the same four beats in the same order, not a
 * decorative blob.
 *
 * ─── 2 · THE ONES WHO COULD NOT FLY HOME ─────────────────────────────────
 * The second-strongest truth we have, at supporting scale: a specific hour in
 * two places. Framed as something you can SEND, never as something you would be
 * guilty of missing — "don't let lola miss it" is banned from this page and
 * everything descended from it.
 *
 * ⚠ NOTHING HERE IS A PROMISE WE CANNOT KEEP. Every capability named — one link,
 * photos gathered from every phone, the day watched live from abroad — ships.
 */

export function FrontDoorStory() {
  return (
    <>
      <section className="fd-story" aria-labelledby="fd-story-chat">
        <h2 id="fd-story-chat" className="fd-story-h">
          You have this group chat.
        </h2>

        <figure className="fd-chat">
          <ol className="fd-chat-list">
            <li className="fd-chat-beat">
              <span className="fd-chat-when">Day 1</span>
              <span className="fd-chat-lines">
                <span className="fd-bub">PICS PLS</span>
                <span className="fd-bub">grabe ang ganda ni bride</span>
                <span className="fd-bub fd-bub-quiet">+43 photos</span>
              </span>
            </li>
            <li className="fd-chat-beat">
              <span className="fd-chat-when">Day 4</span>
              <span className="fd-chat-lines">
                <span className="fd-bub">sino may video ng vows?</span>
                <span className="fd-bub">check ko phone ko mamaya</span>
              </span>
            </li>
            <li className="fd-chat-beat">
              <span className="fd-chat-when">Week 3</span>
              <span className="fd-chat-lines">
                <span className="fd-bub">hi po, pasend na lang po ng pics with ninang</span>
                <span className="fd-chat-seen">Seen</span>
              </span>
            </li>
            <li className="fd-chat-beat">
              <span className="fd-chat-when">Month 11</span>
              <span className="fd-chat-lines">
                <span className="fd-chat-left">Tita left the group.</span>
              </span>
            </li>
          </ol>
          <figcaption className="fd-chat-cap">
            Nobody deleted anything. Nobody decided anything. Forty phones went
            home with forty albums, and none of them was yours.
          </figcaption>
        </figure>

        <p className="fd-story-turn">
          It was never a storage problem. It’s a gathering problem — so we built
          the gathering.
        </p>
      </section>

      <section className="fd-story fd-story-afar" aria-labelledby="fd-story-afar">
        <h2 id="fd-story-afar" className="fd-story-h">
          For the ones who couldn’t fly home.
        </h2>
        <p className="fd-story-body">
          The wedding is in Bulacan at three. In Riyadh it’s ten in the morning,
          and your kuya is watching it live. What he shouts at his screen comes
          home with everything else.
        </p>
      </section>
    </>
  );
}
