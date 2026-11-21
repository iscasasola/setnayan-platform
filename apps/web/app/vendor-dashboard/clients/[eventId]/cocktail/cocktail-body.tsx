import { Pencil } from 'lucide-react';
import { ShopPill } from '@/app/vendor-dashboard/_components/kit';
import { TheirEventPart } from '@/app/vendor-dashboard/_components/set-two/their-event-line';
import { ReadFailedBody } from '@/app/vendor-dashboard/_components/set-two/read-failed';
import { CocktailEditor, type CocktailEditorData } from './cocktail-editor';

const ROUTE = '/vendor-dashboard/clients/[eventId]/cocktail';
const COLUMN = 'mx-auto w-full tab:max-w-3xl';

/**
 * The cocktail area, drawn from the page's read (the lab draws it from fixtures). Supplier pages set two, page 3: under
 * the dark line, the title in the top block with what the couple's switch lets you do as a pill — "Yours: edit" to
 * arrange the room, "Your booth" to place only your own — the map, then Add booth · Add sign in the thumb row.
 */
export function CocktailBody({ eventId, eventName, plan }: { eventId: string; eventName: string | null; plan: CocktailEditorData }) {
  return (
    <TheirEventPart
      column={COLUMN}
      mark="cocktail"
      route={ROUTE}
      eventId={eventId}
      eventName={eventName}
      title={plan.cocktail.label}
      end={
        <ShopPill tone="action">
          <Pencil aria-hidden className="h-3 w-3" />
          {plan.can_arrange ? 'Yours: edit' : 'Your booth'}
        </ShopPill>
      }
      intro={
        <p>
          {plan.can_arrange
            ? 'Arrange the cocktail / waiting area — drag the room to fit the space and place the booths. The couple sees your changes on their blueprint.'
            : 'Place and move your booth inside the couple’s cocktail / waiting area. The reception is shown for reference only — counts, never guest names.'}
        </p>
      }
    >
      <CocktailEditor eventId={eventId} data={plan} />
    </TheirEventPart>
  );
}

/** The cocktail area could not be read: the shell and the title stay, and say so (Honest state · new). */
export function CocktailReadFailed({ eventId, eventName }: { eventId: string; eventName: string | null }) {
  return (
    <TheirEventPart column={COLUMN} mark="cocktail" route={ROUTE} eventId={eventId} eventName={eventName} title="Cocktail Area">
      <ReadFailedBody mark="cocktail" tail="This is on our side. Nothing you placed has changed.">
        We couldn&rsquo;t load the cocktail area right now.
      </ReadFailedBody>
    </TheirEventPart>
  );
}
