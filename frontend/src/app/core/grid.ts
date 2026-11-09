import { MM_PER_FOOT } from './units';

/**
 * Positions (in millimeters) of the grid lines between 0 and the given size.
 * The lines on the edges are not included, because the wall is drawn there.
 * Positions can have decimals: the grid is only a drawing guide, not stored data.
 */
export function gridLinePositions(sizeMm: number, stepMm: number = MM_PER_FOOT): number[] {
  const positions: number[] = [];
  // The "- 1" skips a line that would fall less than 1 mm from the wall.
  for (let i = 1; i * stepMm < sizeMm - 1; i++) {
    positions.push(i * stepMm);
  }
  return positions;
}