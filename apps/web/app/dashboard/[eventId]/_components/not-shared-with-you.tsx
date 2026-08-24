import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * "The couple hasn't shared this with you."
 *
 * 🔑 THE SCREEN A DELEGATE GETS INSTEAD OF AN EMPTY ONE. A row this person
 * may not read comes back as zero rows with no error — identical to an event
 * with nothing in it. On a guest list that difference is the whole message:
 * "no guests yet" invites them to add some and reads as the couple having
 * done nothing, when the truth is that this part was not shared.
 *
 * ⛔ NO CTA. There is nothing for them to press: the host grants access, and
 * a button here would either do nothing or send an ask from the wrong screen.
 * It names the person who can change it and stops.
 */
export function NotSharedWithYou({
  title,
  thing,
}: {
  /** The page's own title, so the masthead does not change under them. */
  title: string;
  /** What was not shared, in the words the couple would use — "guest list". */
  thing: string;
}) {
  return (
    <section className="sn-col space-y-6">
      <PageMasthead title={title} />
      <div className="sn-tile p-5">
        <p className="text-sm text-ink/70">
          The couple haven&rsquo;t shared the {thing} with you, so there is nothing to
          show here. Ask them if you need it — they can share it from their own
          screen, one part at a time.
        </p>
      </div>
    </section>
  );
}
