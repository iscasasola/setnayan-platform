export type KwentoMomentKey =
  | 'bridal_march'
  | 'exchange_of_vows'
  | 'veil_and_cord'
  | 'first_kiss'
  | 'leaving_the_church'
  | 'cocktail_hour'
  | 'newlywed_entrance'
  | 'first_dance'
  | 'cake_cutting'
  | 'money_dance';

export type KwentoMoment = {
  key: KwentoMomentKey;
  label: string;
  eyebrow: string;
};

export const KWENTO_MOMENTS: readonly KwentoMoment[] = [
  { key: 'bridal_march',        label: 'Bridal March',          eyebrow: 'The entrance' },
  { key: 'exchange_of_vows',    label: 'Exchange of Vows',       eyebrow: 'The promise' },
  { key: 'veil_and_cord',       label: 'Veil & Cord',            eyebrow: 'The binding' },
  { key: 'first_kiss',          label: 'First Kiss',             eyebrow: 'The seal' },
  { key: 'leaving_the_church',  label: 'Leaving the Church',     eyebrow: 'The exit' },
  { key: 'cocktail_hour',       label: 'Cocktail Hour',          eyebrow: 'The mingling' },
  { key: 'newlywed_entrance',   label: 'Newlywed Entrance',      eyebrow: 'The reception' },
  { key: 'first_dance',         label: 'First Dance',            eyebrow: 'The song' },
  { key: 'cake_cutting',        label: 'Cake Cutting',           eyebrow: 'The sweetness' },
  { key: 'money_dance',         label: 'Money Dance',            eyebrow: 'The celebration' },
] as const;

export const KWENTO_MOMENT_BY_KEY = new Map(
  KWENTO_MOMENTS.map((m) => [m.key, m]),
);
