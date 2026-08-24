/* The 5-level rating scale of the Mister skin, shared by medias and attributes
   everywhere in the UI: steel blue (top) > green > yellow > orange > red. */

export type RatingTier = 'top' | 'alto' | 'medio' | 'bajo' | 'malo';

/** Tier of a 0-99 rating: ≥88 top, ≥78 alto, ≥68 medio, ≥58 bajo, else malo. */
export function ratingTier(value: number): RatingTier {
  if (value >= 88) return 'top';
  if (value >= 78) return 'alto';
  if (value >= 68) return 'medio';
  if (value >= 58) return 'bajo';
  return 'malo';
}

/** Media as a tinted pill (list rows, fichas). */
export function MediaPill({ value }: { value: number }) {
  return <span className={`media-pill media-pill--${ratingTier(value)}`}>{value}</span>;
}

/** Single attribute value, colour-coded, for table cells. */
export function AttrValue({ value }: { value: number }) {
  return <span className={`at at--${ratingTier(value)}`}>{value}</span>;
}
