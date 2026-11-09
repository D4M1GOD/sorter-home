import { ROOM_MAX_SIZE_MM, ROOM_MIN_SIZE_MM } from './room.model';
import { resizeRoom } from './room-resize';
import { feetToMm } from './units';

const current = { widthMm: feetToMm(12), depthMm: feetToMm(10) };

describe('resizeRoom', () => {
  it('the right handle changes only the width', () => {
    const result = resizeRoom('right', { x: feetToMm(14), y: 99999 }, current);
    expect(result).toEqual({ widthMm: feetToMm(14), depthMm: current.depthMm });
  });

  it('the bottom handle changes only the depth', () => {
    const result = resizeRoom('bottom', { x: 99999, y: feetToMm(8) }, current);
    expect(result).toEqual({ widthMm: current.widthMm, depthMm: feetToMm(8) });
  });

  it('the corner handle changes both lengths', () => {
    const result = resizeRoom('corner', { x: feetToMm(15), y: feetToMm(9) }, current);
    expect(result).toEqual({ widthMm: feetToMm(15), depthMm: feetToMm(9) });
  });

  it('snaps to whole inches and returns whole millimeters', () => {
    // 14 ft = 168 in. 14 ft + 10 mm is 168.39 in -> 168 in. 14 ft + 15 mm is 168.6 in -> 169 in.
    expect(resizeRoom('right', { x: feetToMm(14) + 10, y: 0 }, current).widthMm).toBe(4267);
    const up = resizeRoom('right', { x: feetToMm(14) + 15, y: 0 }, current).widthMm;
    expect(up).toBe(4293); // 169 in = 4292.6 mm
    expect(Number.isInteger(up)).toBe(true);
  });

  it('stops at the minimum size', () => {
    const result = resizeRoom('corner', { x: -500, y: 10 }, current);
    expect(result).toEqual({ widthMm: ROOM_MIN_SIZE_MM, depthMm: ROOM_MIN_SIZE_MM });
  });

  it('stops at the maximum size', () => {
    const result = resizeRoom('corner', { x: 1_000_000, y: feetToMm(101) }, current);
    expect(result).toEqual({ widthMm: ROOM_MAX_SIZE_MM, depthMm: ROOM_MAX_SIZE_MM });
  });
});
