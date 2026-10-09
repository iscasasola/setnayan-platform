import { CardCols, CardField, CardFold, CardInvitedTo, CardList, CardLocked, CardPick, CardSaveState, CardSubmit, CardTip, CardToggle } from './guest-card-rows';
import type { CardKit } from './guest-card-kit';

/**
 * The kit the Guests pages hand `GuestCardBody` (`kit={TEMPLATE_KIT}`): the card's leaves as the app's Form rows. A SERVER module
 * on purpose — it only holds references to the client components in `guest-card-rows.tsx`. NOT imported by `GuestCardBody` or
 * anything it reaches: the Maker draws the card in its first load, where the templates are not
 * (`the-guest-card-adds-no-first-load-weight.test.ts`).
 */
export const TEMPLATE_KIT: CardKit = {
  Field: CardField,
  Toggle: CardToggle,
  Fold: CardFold,
  Pick: CardPick,
  InvitedTo: CardInvitedTo,
  Locked: CardLocked,
  Submit: CardSubmit,
  Tip: CardTip,
  SaveState: CardSaveState,
  List: CardList,
  Cols: CardCols,
};
