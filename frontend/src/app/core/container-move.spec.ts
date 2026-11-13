import { Container, createContainer, TOUGH_BOX_27_GAL } from './container.model';
import {
  grabOffsetOf,
  moveTopLeft,
  placementProblemIgnoring,
  rotatedContainer,
} from './container-move';
import { containerRect } from './container-placement';
import { DRAG_THRESHOLD_PX } from './drag';
import { feetToMm, inchesToMm } from './units';

const W = TOUGH_BOX_27_GAL.widthMm; // 775
const D = TOUGH_BOX_27_GAL.depthMm; // 521
const room = { widthMm: feetToMm(12), depthMm: feetToMm(10) }; // 3658 x 3048

function box(xMm: number, yMm: number, rotation: 0 | 90 = 0): Container {
  return { ...createContainer(TOUGH_BOX_27_GAL.id, 'Box', xMm, yMm), rotation };
}

describe('container move', () => {
  it('shares a drag threshold of 6 screen pixels', () => {
    expect(DRAG_THRESHOLD_PX).toBe(6);
  });

  describe('grabOffsetOf', () => {
    it('is the distance from the top-left corner to the pointer', () => {
      expect(grabOffsetOf({ x: 1700, y: 1300 }, box(1600, 1245))).toEqual({ x: 100, y: 55 });
    });

    it('can have decimals, because the pointer does', () => {
      expect(grabOffsetOf({ x: 1700.5, y: 1300.25 }, box(1600, 1245))).toEqual({
        x: 100.5,
        y: 55.25,
      });
    });
  });

  describe('moveTopLeft', () => {
    const start = box(1600, 1245); // 63 in and 49 in, whole inches
    const grab = grabOffsetOf({ x: 1700, y: 1300 }, start);

    it('keeps the container where it is when the pointer does not move', () => {
      expect(moveTopLeft({ x: 1700, y: 1300 }, grab)).toEqual({ xMm: 1600, yMm: 1245 });
    });

    it('moves the corner with the pointer and snaps it to whole inches', () => {
      // 2500 - 100 = 2400 mm = 94.49 in -> 94 in = 2388 mm. y does not change.
      expect(moveTopLeft({ x: 2500, y: 1300 }, grab)).toEqual({ xMm: 2388, yMm: 1245 });
    });

    it('does not make the container jump: the grab point decides where the corner lands', () => {
      // Same pointer position, different grab points: the corners differ by the grab difference.
      const nearCorner = moveTopLeft({ x: 2000, y: 1500 }, { x: 5, y: 5 });
      const nearMiddle = moveTopLeft({ x: 2000, y: 1500 }, { x: 380, y: 260 });
      expect(nearCorner.xMm - nearMiddle.xMm).toBeGreaterThan(300);
      expect(nearCorner.yMm - nearMiddle.yMm).toBeGreaterThan(200);
    });

    it('always gives whole millimeters on the inch grid', () => {
      const { xMm, yMm } = moveTopLeft({ x: 1234.56, y: 987.65 }, { x: 33.3, y: 12.7 });
      expect(Number.isInteger(xMm)).toBe(true);
      expect(Number.isInteger(yMm)).toBe(true);
      expect(Math.abs(xMm / 25.4 - Math.round(xMm / 25.4))).toBeLessThan(0.02);
      expect(Math.abs(yMm / 25.4 - Math.round(yMm / 25.4))).toBeLessThan(0.02);
    });

    it('can give a corner outside the room (the shadow then turns red)', () => {
      expect(moveTopLeft({ x: 10, y: 10 }, { x: 300, y: 300 }).xMm).toBeLessThan(0);
    });
  });

  describe('placementProblemIgnoring', () => {
    it('does not count the ignored container, so it can stay on its own place', () => {
      const a = box(500, 500);
      expect(placementProblemIgnoring(containerRect(a), a.id, room, [a])).toBeNull();
    });

    it('allows moving a little over the old place of the same container', () => {
      const a = box(500, 500);
      const moved = { xMm: 600, yMm: 500, widthMm: W, depthMm: D }; // overlaps a's old place
      expect(placementProblemIgnoring(moved, a.id, room, [a])).toBeNull();
    });

    it('still reports an overlap with any other container', () => {
      const a = box(500, 500);
      const b = box(2000, 500);
      const onB = { xMm: 2100, yMm: 500, widthMm: W, depthMm: D };
      expect(placementProblemIgnoring(onB, a.id, room, [a, b])).toBe('overlap');
    });

    it('still reports "outside" when the place leaves the room', () => {
      const a = box(500, 500);
      const out = { xMm: room.widthMm - W + 1, yMm: 500, widthMm: W, depthMm: D };
      expect(placementProblemIgnoring(out, a.id, room, [a])).toBe('outside');
    });

    it('accepts a container right next to another one', () => {
      const a = box(0, 0);
      const b = box(2000, 0);
      const next = { xMm: W, yMm: 0, widthMm: W, depthMm: D };
      expect(placementProblemIgnoring(next, b.id, room, [a, b])).toBeNull();
    });
  });

  describe('rotatedContainer', () => {
    it('turns 0 into 90 and 90 back into 0', () => {
      expect(rotatedContainer(box(1600, 1245)).rotation).toBe(90);
      expect(rotatedContainer(box(1600, 1245, 90)).rotation).toBe(0);
    });

    it('swaps the footprint on the plan', () => {
      const rotated = rotatedContainer(box(1600, 1245));
      expect(containerRect(rotated)).toMatchObject({ widthMm: D, depthMm: W });
    });

    it('pivots around the center: the corner moves by half the difference of the sides', () => {
      // (775 - 521) / 2 = 127 mm = exactly 5 in: the corner goes right 127 and up 127 mm.
      const rotated = rotatedContainer(box(1600, 1245));
      expect(rotated.xMm).toBe(1727);
      expect(rotated.yMm).toBe(1118);
    });

    it('keeps the center in the same place (within the 1 in snap)', () => {
      const before = box(1700, 900);
      const after = rotatedContainer(before);
      const centerBefore = containerRect(before);
      const centerAfter = containerRect(after);
      const dx =
        centerBefore.xMm + centerBefore.widthMm / 2 - (centerAfter.xMm + centerAfter.widthMm / 2);
      const dy =
        centerBefore.yMm + centerBefore.depthMm / 2 - (centerAfter.yMm + centerAfter.depthMm / 2);
      expect(Math.abs(dx)).toBeLessThanOrEqual(12.7 + 0.5);
      expect(Math.abs(dy)).toBeLessThanOrEqual(12.7 + 0.5);
    });

    it('returns to the original corner after two rotations (Tough Box)', () => {
      for (const [xIn, yIn] of [
        [0, 0],
        [10, 3],
        [63, 49],
        [101, 77],
      ]) {
        const start = box(inchesToMm(xIn), inchesToMm(yIn));
        const twice = rotatedContainer(rotatedContainer(start));
        expect(twice).toEqual(start);
      }
    });

    it('always gives whole millimeters', () => {
      const rotated = rotatedContainer(box(1613, 777));
      expect(Number.isInteger(rotated.xMm)).toBe(true);
      expect(Number.isInteger(rotated.yMm)).toBe(true);
    });

    it('keeps the id, name and type, and does not change the original', () => {
      const original = box(1600, 1245);
      const copy = { ...original };
      const rotated = rotatedContainer(original);
      expect(rotated).toMatchObject({
        id: original.id,
        name: original.name,
        typeId: original.typeId,
      });
      expect(original).toEqual(copy);
    });

    describe('does it fit?', () => {
      it('fits when there is free space around it', () => {
        const a = box(1000, 1000);
        const rotated = rotatedContainer(a);
        expect(placementProblemIgnoring(containerRect(rotated), a.id, room, [a])).toBeNull();
      });

      it('does not fit against the top wall (the corner would go above it)', () => {
        const a = box(1000, 0);
        const rotated = rotatedContainer(a);
        expect(placementProblemIgnoring(containerRect(rotated), a.id, room, [a])).toBe('outside');
      });

      it('does not fit against the bottom wall', () => {
        const a = box(1000, room.depthMm - D);
        const rotated = rotatedContainer(a);
        expect(placementProblemIgnoring(containerRect(rotated), a.id, room, [a])).toBe('outside');
      });

      it('fits against the side walls, because the footprint gets narrower', () => {
        const left = box(0, 1000);
        const right = box(room.widthMm - W, 1000);
        expect(
          placementProblemIgnoring(containerRect(rotatedContainer(left)), left.id, room, [left]),
        ).toBeNull();
        expect(
          placementProblemIgnoring(containerRect(rotatedContainer(right)), right.id, room, [right]),
        ).toBeNull();
      });

      it('does not fit when it would overlap a neighbor', () => {
        const a = box(1000, 1000);
        const below = box(1000, 1000 + D); // touches a from below
        const rotated = rotatedContainer(a);
        expect(placementProblemIgnoring(containerRect(rotated), a.id, room, [a, below])).toBe(
          'overlap',
        );
      });
    });
  });
});
