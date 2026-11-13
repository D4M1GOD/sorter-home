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

/** Snaps a length to the nearest whole inch and returns it as whole millimeters. */
export function snapToInchMm(mm: number): number {
  return inchesToMm(Math.round(mmToInches(mm)));
}

/**
 * Rounds a length UP to the next whole inch and returns it as whole millimeters.
 * The small tolerance avoids a floating-point error: 762 mm / 25.4 can come out as
 * 30.000000000000004, which would wrongly round up to 31 in.
 */
export function ceilToInchMm(mm: number): number {
  // "+ 0" turns a negative zero (Math.ceil of a tiny negative number) into a plain 0.
  return inchesToMm(Math.ceil(mmToInches(mm) - 1e-9) + 0);
}

/** Formats millimeters for display, rounded to the nearest inch. Example: 3658 -> "12 ft 0 in". */
export function formatFeetInches(mm: number): string {
  const totalInches = Math.round(mmToInches(mm));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet} ft ${inches} in`;
}