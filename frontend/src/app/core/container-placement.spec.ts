import { Container, createContainer, TOUGH_BOX_27_GAL } from './container.model';
import {
  containerRect,
  firstFreeSpot,
  footprintOf,
  isPlacementValid,
  minRoomSizeFor,
  placementProblem,
  rectsOverlap,
  snapTopLeft,
} from './container-placement';
import { ROOM_MAX_SIZE_MM, ROOM_MIN_SIZE_MM } from './room.model';
import { feetToMm } from './units';

const W = TOUGH_BOX_27_GAL.widthMm; // 775
const D = TOUGH_BOX_27_GAL.depthMm; // 521
const room = { widthMm: feetToMm(12), depthMm: feetToMm(10) }; // 3658 x 3048
const footprint = { widthMm: W, depthMm: D };

function box(xMm: number, yMm: number, rotation: 0 | 90 = 0): Container {
  return { ...createContainer(TOUGH_BOX_27_GAL.id, 'Box', xMm, yMm), rotation };
}

describe('container placement', () => {
  describe('footprint', () => {
    it('is the type footprint with rotation 0', () => {
      expect(footprintOf(TOUGH_BOX_27_GAL.id)).toEqual({ widthMm: W, depthMm: D });
    });

    it('swaps width and depth with rotation 90', () => {
      expect(footprintOf(TOUGH_BOX_27_GAL.id, 90)).toEqual({ widthMm: D, depthMm: W });
      expect(containerRect(box(10, 20, 90))).toEqual({
        xMm: 10,
        yMm: 20,
        widthMm: D,
        depthMm: W,
      });
    });

    it('throws for an unknown type', () => {
      expect(() => footprintOf('nope')).toThrow();
    });
  });

  describe('rectsOverlap', () => {
    const a = { xMm: 0, yMm: 0, widthMm: 100, depthMm: 100 };

    it('detects a partial overlap and containment', () => {
      expect(rectsOverlap(a, { xMm: 50, yMm: 50, widthMm: 100, depthMm: 100 })).toBe(true);
      expect(rectsOverlap(a, { xMm: 10, yMm: 10, widthMm: 5, depthMm: 5 })).toBe(true);
    });

    it('does not count rectangles that only touch', () => {
      expect(rectsOverlap(a, { xMm: 100, yMm: 0, widthMm: 100, depthMm: 100 })).toBe(false);
      expect(rectsOverlap(a, { xMm: 0, yMm: 100, widthMm: 100, depthMm: 100 })).toBe(false);
    });

    it('does not count separate rectangles', () => {
      expect(rectsOverlap(a, { xMm: 300, yMm: 300, widthMm: 10, depthMm: 10 })).toBe(false);
    });
  });

  describe('placementProblem / isPlacementValid', () => {
    it('accepts a place inside the room', () => {
      const rect = { xMm: 100, yMm: 100, ...footprint };
      expect(placementProblem(rect, room, [])).toBeNull();
      expect(isPlacementValid(rect, room, [])).toBe(true);
    });

    it('accepts a container touching the walls', () => {
      const rect = { xMm: room.widthMm - W, yMm: room.depthMm - D, ...footprint };
      expect(isPlacementValid(rect, room, [])).toBe(true);
      expect(isPlacementValid({ xMm: 0, yMm: 0, ...footprint }, room, [])).toBe(true);
    });

    it('rejects a place that leaves the room on any side', () => {
      expect(placementProblem({ xMm: -1, yMm: 0, ...footprint }, room, [])).toBe('outside');
      expect(placementProblem({ xMm: 0, yMm: -1, ...footprint }, room, [])).toBe('outside');
      expect(placementProblem({ xMm: room.widthMm - W + 1, yMm: 0, ...footprint }, room, [])).toBe(
        'outside',
      );
      expect(placementProblem({ xMm: 0, yMm: room.depthMm - D + 1, ...footprint }, room, [])).toBe(
        'outside',
      );
    });

    it('rejects any overlap with another container', () => {
      const existing = [box(500, 500)];
      expect(placementProblem({ xMm: 600, yMm: 600, ...footprint }, room, existing)).toBe(
        'overlap',
      );
      expect(placementProblem({ xMm: 500, yMm: 500, ...footprint }, room, existing)).toBe(
        'overlap',
      );
    });

    it('accepts a container right next to another one', () => {
      const existing = [box(0, 0)];
      expect(isPlacementValid({ xMm: W, yMm: 0, ...footprint }, room, existing)).toBe(true);
      expect(isPlacementValid({ xMm: 0, yMm: D, ...footprint }, room, existing)).toBe(true);
    });

    it('reports "outside" before "overlap"', () => {
      expect(placementProblem({ xMm: -10, yMm: 0, ...footprint }, room, [box(0, 0)])).toBe(
        'outside',
      );
    });

    it('uses the rotated rectangle of existing containers', () => {
      const rotated = [box(0, 0, 90)]; // occupies D wide x W deep
      expect(isPlacementValid({ xMm: D, yMm: 0, ...footprint }, room, rotated)).toBe(true);
      expect(isPlacementValid({ xMm: D - 1, yMm: 0, ...footprint }, room, rotated)).toBe(false);
    });
  });

  describe('snapTopLeft', () => {
    it('puts the center under the pointer and snaps the corner to whole inches', () => {
      const { xMm, yMm } = snapTopLeft({ x: 2000, y: 1500 }, footprint);
      // 2000 - 387.5 = 1612.5 mm = 63.48 in -> 63 in = 1600 mm; 1500 - 260.5 = 1239.5 mm = 48.8 in -> 49 in
      expect(xMm).toBe(1600);
      expect(yMm).toBe(1245);
    });

    it('returns whole millimeters on the inch grid', () => {
      const { xMm, yMm } = snapTopLeft({ x: 1234.56, y: 987.65 }, footprint);
      expect(Number.isInteger(xMm)).toBe(true);
      expect(Number.isInteger(yMm)).toBe(true);
      expect(Math.abs(xMm / 25.4 - Math.round(xMm / 25.4))).toBeLessThan(0.02);
    });

    it('can give a corner outside the room (the shadow then turns red)', () => {
      expect(snapTopLeft({ x: 0, y: 0 }, footprint).xMm).toBeLessThan(0);
    });
  });

  describe('firstFreeSpot', () => {
    it('is the top-left corner of an empty room', () => {
      expect(firstFreeSpot(room, [], footprint)).toEqual({ xMm: 0, yMm: 0 });
    });

    it('moves right in 1 ft steps along the row', () => {
      // A box at 0,0 covers x 0..775. The next 1 ft step is 305 (< 775): still overlaps.
      // 610 and 914 are also tested; 915 (3 ft) is the first free column.
      expect(firstFreeSpot(room, [box(0, 0)], footprint)).toEqual({ xMm: feetToMm(3), yMm: 0 });
    });

    it('goes to the next row when the row is full', () => {
      const fullRow = [box(0, 0), box(feetToMm(3), 0), box(feetToMm(6), 0), box(feetToMm(9), 0)];
      const spot = firstFreeSpot(room, fullRow, footprint);
      // The next 1 ft row (305 mm) still overlaps the first row (depth 521): 2 ft (610) is free.
      expect(spot).toEqual({ xMm: 0, yMm: feetToMm(2) });
    });

    it('returns null when there is no free spot', () => {
      const small = { widthMm: 1219, depthMm: 1219 }; // 4 ft x 4 ft
      // Two boxes side by side do not fit in 1219 mm (2 x 775); fill with one tall column.
      const blockers = [box(0, 0), box(0, D), box(0, 2 * D)];
      expect(firstFreeSpot(small, blockers, footprint)).toBeNull();
    });

    it('returns null when the container is bigger than the room', () => {
      expect(firstFreeSpot({ widthMm: 500, depthMm: 500 }, [], footprint)).toBeNull();
    });

    it('only returns valid spots', () => {
      const spot = firstFreeSpot(room, [box(0, 0)], footprint);
      expect(spot).not.toBeNull();
      expect(isPlacementValid({ ...spot!, ...footprint }, room, [box(0, 0)])).toBe(true);
    });
  });

  describe('minRoomSizeFor', () => {
    it('is the room minimum when there are no containers', () => {
      expect(minRoomSizeFor([])).toEqual({
        widthMm: ROOM_MIN_SIZE_MM,
        depthMm: ROOM_MIN_SIZE_MM,
      });
    });

    it('is the outer limit of the containers rounded up to a whole inch', () => {
      // Right limit 2000 + 775 = 2775 mm = 109.25 in -> 110 in = 2794 mm.
      // Bottom limit 1500 + 521 = 2021 mm = 79.57 in -> 80 in = 2032 mm.
      expect(minRoomSizeFor([box(2000, 1500)])).toEqual({ widthMm: 2794, depthMm: 2032 });
    });

    it('uses the farthest container on each axis', () => {
      const result = minRoomSizeFor([box(2000, 100), box(100, 1800)]);
      expect(result.widthMm).toBe(2794);
      expect(result.depthMm).toBe(2337); // 1800 + 521 = 2321 mm = 91.38 in -> 92 in = 2336.8 mm
    });

    it('never goes below the room minimum', () => {
      expect(minRoomSizeFor([box(0, 0)])).toEqual({
        widthMm: ROOM_MIN_SIZE_MM,
        depthMm: ROOM_MIN_SIZE_MM,
      });
    });

    it('never goes above the room maximum', () => {
      const far = box(ROOM_MAX_SIZE_MM + 5000, 0);
      expect(minRoomSizeFor([far]).widthMm).toBe(ROOM_MAX_SIZE_MM);
    });

    it('uses the rotated footprint', () => {
      const result = minRoomSizeFor([box(2000, 0, 90)]); // 2000 + 521 = 2521 -> 100 in = 2540
      expect(result.widthMm).toBe(2540);
    });
  });
});
