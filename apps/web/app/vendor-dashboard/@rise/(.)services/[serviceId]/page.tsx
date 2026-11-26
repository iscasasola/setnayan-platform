import CardMakerPage from '../../../services/[serviceId]/page';
import { LoadWhole } from '@/app/_components/load-whole';
import { isServiceCardId } from '@/lib/service-card-id';

/**
 * The card maker, risen — for a card id only. Any other name here (`requests`, `their-work`) is a services page of its
 * own and loads as one (`LoadWhole`); it never rises (controller 25 Nov). 🔒 app/vendor-dashboard/services/the-maker-rises.test.ts
 */
export default async function RisenCardMaker(props: Parameters<typeof CardMakerPage>[0]) {
  const { serviceId } = await props.params;
  if (!isServiceCardId(serviceId)) return <LoadWhole />;
  return <CardMakerPage {...props} />;
}
