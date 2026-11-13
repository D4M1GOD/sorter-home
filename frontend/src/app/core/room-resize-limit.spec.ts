import { minRoomSizeFor } from './container-placement';
import { createContainer, TOUGH_BOX_27_GAL } from './container.model';
import { ROOM_MIN_SIZE_MM } from './room.model';
import { resizeRoom } from './room-resize';
import { feetToMm } from './units';

/** Resize limit from the containers inside the room (FR-4c). */
describe('resizeRoom with a minimum size', () => {
  const current = { widthMm: feetToMm(12), depthMm: feetToMm(10) };
  // One box whose outer limit is 2775 x 2021 mm: the room cannot be smaller than 2794 x 2032 mm.
  const minSize = minRoomSizeFor([createContainer(TOUGH_BOX_27_GAL.id, 'Box', 2000, 1500)]);

  it('stops the right edge at the containers', () => {
    const result = resizeRoom('right', { x: 500, y: 0 }, current, minSize);
    expect(result).toEqual({ widthMm: 2794, depthMm: current.depthMm });
  });

  it('stops the bottom edge at the containers', () => {
    const result = resizeRoom('bottom', { x: 0, y: 500 }, current, minSize);
    expect(result).toEqual({ widthMm: current.widthMm, depthMm: 2032 });
  });

  it('stops each axis of the corner separately', () => {
    const result = resizeRoom('corner', { x: 500, y: feetToMm(8) }, current, minSize);
    expect(result).toEqual({ widthMm: 2794, depthMm: feetToMm(8) });
  });

  it('still moves in 1 in steps just above the limit', () => {
    // 2794 mm is 110 in. 111 in is 2819 mm.
    const result = resizeRoom('right', { x: 2819, y: 0 }, current, minSize);
    expect(result.widthMm).toBe(2819);
  });

  it('lets the room grow as usual', () => {
    const result = resizeRoom('corner', { x: feetToMm(20), y: feetToMm(15) }, current, minSize);
    expect(result).toEqual({ widthMm: feetToMm(20), depthMm: feetToMm(15) });
  });

  it('uses the room minimum when no minimum size is given', () => {
    const result = resizeRoom('corner', { x: 10, y: 10 }, current);
    expect(result).toEqual({ widthMm: ROOM_MIN_SIZE_MM, depthMm: ROOM_MIN_SIZE_MM });
  });
});
