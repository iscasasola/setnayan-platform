/**
 * 0018 Setnayan Supplies — public exports.
 *
 * Import from '@/lib/supplies' to keep call-sites stable as internals evolve.
 */

export type {
  DeliveryAddress,
  PricingAvailable,
  PricingResult,
  PricingUnavailable,
  ServiceAreaCode,
  SupplyCategory,
  VolumeTier,
} from './types';

export {
  DEFAULT_MARKUP_PCT,
  SERVICE_AREA_LABEL,
  SUPPLY_CATEGORY_LABEL,
} from './types';

export {
  isServiceAreaSupported,
  resolveServiceArea,
} from './service-area';

export {
  formatRetailLabel,
  resolveSuppliesPricing,
} from './pricing';
