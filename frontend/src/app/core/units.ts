/** Millimeters per inch and per foot. Stored lengths are always whole millimeters. */
export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;

/** Converts feet to whole millimeters (rounded to the nearest one). */
export function feetToMm(feet: number): number {
  return Math.round(feet * MM_PER_FOOT);
}

/** Converts inches to whole millimeters (rounded to the nearest one). */
export function inchesToMm(inches: number): number {
  return Math.round(inches * MM_PER_INCH);
}

/** Converts millimeters to inches. The result can have decimals. */
export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

/** Formats millimeters for display, rounded to the nearest inch. Example: 3658 -> "12 ft 0 in". */
export function formatFeetInches(mm: number): string {
  const totalInches = Math.round(mmToInches(mm));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet} ft ${inches} in`;
}