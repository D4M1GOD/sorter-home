import { Container, createContainer, TOUGH_BOX_27_GAL } from './container.model';
import {
  dragOutcome,
  normalizeStacks,
  removeFromStack,
  reorderStack,
  stackAtPoint,
  stackOf,
  stacksOf,
} from './container-stack';
import { feetToMm } from './units';

const W = TOUGH_BOX_27_GAL.widthMm; // 775
const D = TOUGH_BOX_27_GAL.depthMm; // 521
const room = { widthMm: feetToMm(12), depthMm: feetToMm(10) }; // 3658 x 3048

function box(
  id: string,
  xMm: number,
  yMm: number,
  extra: Partial<Pick<Container, 'rotation' | 'stackPosition'>> = {},
): Container {
  return { ...createContainer(TOUGH_BOX_27_GAL.id, id, xMm, yMm), id, ...extra };
}

const ids = (containers: readonly Container[]) => containers.map((c) => c.id);
const levels = (containers: readonly Container[]) => containers.map((c) => c.stackPosition);

describe('container stacks', () => {
  describe('stacksOf', () => {
    it('gives every separate container its own stack of one', () => {
      const stacks = stacksOf([box('a', 0, 0), box('b', 2000, 0)]);
      expect(stacks.length).toBe(2);
      expect(stacks[0].members.length).toBe(1);
      expect(stacks[0].top.id).toBe('a');
      expect(stacks[1].top.id).toBe('b');
    });

    it('puts containers in the same place in one stack, from the bottom to the top', () => {
      const stacks = stacksOf([
        box('top', 100, 100, { stackPosition: 2 }),
        box('bottom', 100, 100, { stackPosition: 0 }),
        box('middle', 100, 100, { stackPosition: 1 }),
        box('other', 2000, 0),
      ]);
      expect(stacks.length).toBe(2);
      expect(ids(stacks[0].members)).toEqual(['bottom', 'middle', 'top']);
      expect(stacks[0].top.id).toBe('top');
    });

    it('has the footprint of its containers', () => {
      const [stack] = stacksOf([box('a', 100, 200), box('b', 100, 200, { stackPosition: 1 })]);
      expect(stack.rect).toEqual({ xMm: 100, yMm: 200, widthMm: W, depthMm: D });
      const [turned] = stacksOf([box('a', 100, 200, { rotation: 90 })]);
      expect(turned.rect).toEqual({ xMm: 100, yMm: 200, widthMm: D, depthMm: W });
    });

    it('does not join containers with another rotation, or that only overlap partly', () => {
      expect(stacksOf([box('a', 100, 100), box('b', 100, 100, { rotation: 90 })]).length).toBe(2);
      expect(stacksOf([box('a', 100, 100), box('b', 150, 100)]).length).toBe(2);
    });

    it('is empty for no containers', () => {
      expect(stacksOf([])).toEqual([]);
    });
  });

  describe('stackOf', () => {
    const list = [
      box('a', 100, 100),
      box('b', 100, 100, { stackPosition: 1 }),
      box('c', 2000, 0),
    ];

    it('finds the stack of any of its members, also the hidden ones', () => {
      expect(ids(stackOf(list, 'a')!.members)).toEqual(['a', 'b']);
      expect(ids(stackOf(list, 'b')!.members)).toEqual(['a', 'b']);
      expect(stackOf(list, 'b')!.top.id).toBe('b');
      expect(ids(stackOf(list, 'c')!.members)).toEqual(['c']);
    });

    it('is undefined for an unknown id', () => {
      expect(stackOf(list, 'nope')).toBeUndefined();
    });
  });

  describe('normalizeStacks', () => {
    it('keeps the list order and numbers containers in the same place by that order', () => {
      // Saved before stacks existed: all have level 0 and sit exactly on top of each other.
      const result = normalizeStacks([box('a', 100, 100), box('b', 100, 100), box('c', 100, 100)]);
      expect(ids(result)).toEqual(['a', 'b', 'c']);
      expect(levels(result)).toEqual([0, 1, 2]);
    });

    it('uses the saved level before the list order', () => {
      const result = normalizeStacks([
        box('a', 100, 100, { stackPosition: 2 }),
        box('b', 100, 100, { stackPosition: 0 }),
      ]);
      expect(ids(result)).toEqual(['a', 'b']);
      expect(levels(result)).toEqual([1, 0]);
    });

    it('closes gaps and repeats', () => {
      const gaps = normalizeStacks([
        box('a', 100, 100, { stackPosition: 0 }),
        box('b', 100, 100, { stackPosition: 5 }),
        box('c', 100, 100, { stackPosition: 9 }),
      ]);
      expect(levels(gaps)).toEqual([0, 1, 2]);
      const repeats = normalizeStacks([
        box('a', 100, 100, { stackPosition: 1 }),
        box('b', 100, 100, { stackPosition: 1 }),
      ]);
      expect(levels(repeats)).toEqual([0, 1]);
    });

    it('gives level 0 to a container alone, whatever level it had', () => {
      expect(levels(normalizeStacks([box('a', 100, 100, { stackPosition: 4 })]))).toEqual([0]);
    });

    it('does not join partial overlaps or different rotations', () => {
      const result = normalizeStacks([
        box('a', 100, 100),
        box('b', 150, 100),
        box('c', 100, 100, { rotation: 90 }),
      ]);
      expect(levels(result)).toEqual([0, 0, 0]);
    });

    it('returns the same objects when nothing changes', () => {
      const list = [box('a', 100, 100), box('b', 100, 100, { stackPosition: 1 }), box('c', 5, 5)];
      const result = normalizeStacks(list);
      result.forEach((container, i) => expect(container).toBe(list[i]));
    });

    it('does not change the position, rotation or name', () => {
      const [first] = normalizeStacks([box('a', 100, 100, { stackPosition: 7 })]);
      expect(first).toMatchObject({ xMm: 100, yMm: 100, rotation: 0, name: 'a' });
    });
  });

  describe('stackAtPoint', () => {
    const list = [box('a', 1000, 1000), box('b', 1000, 1000, { stackPosition: 1 })];

    it('finds the stack when the point is inside its footprint', () => {
      expect(stackAtPoint({ x: 1400, y: 1200 }, list)?.top.id).toBe('b');
    });

    it('counts the left and top edges as inside, and the right and bottom edges as outside', () => {
      expect(stackAtPoint({ x: 1000, y: 1000 }, list)).toBeDefined();
      expect(stackAtPoint({ x: 1000 + W, y: 1200 }, list)).toBeUndefined();
      expect(stackAtPoint({ x: 1200, y: 1000 + D }, list)).toBeUndefined();
      expect(stackAtPoint({ x: 999, y: 1200 }, list)).toBeUndefined();
    });

    it('uses the rotated footprint', () => {
      const turned = [box('a', 1000, 1000, { rotation: 90 })];
      expect(stackAtPoint({ x: 1000 + D - 1, y: 1000 + W - 1 }, turned)).toBeDefined();
      expect(stackAtPoint({ x: 1000 + D + 1, y: 1200 }, turned)).toBeUndefined();
    });

    it('skips the stacks that have an ignored container', () => {
      expect(stackAtPoint({ x: 1400, y: 1200 }, list, ['a'])).toBeUndefined();
      expect(stackAtPoint({ x: 1400, y: 1200 }, list, ['zzz'])).toBeDefined();
    });

    it('picks the stack drawn on top when stacks overlap', () => {
      const overlapping = [box('first', 1000, 1000), box('last', 1200, 1100)];
      expect(stackAtPoint({ x: 1300, y: 1200 }, overlapping)?.top.id).toBe('last');
    });
  });

  describe('dragOutcome', () => {
    const snapped = { xMm: 2400, yMm: 1500, widthMm: W, depthMm: D };

    it('is a valid placement when the pointer is not on another container', () => {
      const outcome = dragOutcome({
        pointer: { x: 2800, y: 1700 },
        rect: snapped,
        draggedIds: [],
        room,
        containers: [box('a', 1000, 1000)],
      });
      expect(outcome).toEqual({ kind: 'place', rect: snapped, problem: null });
    });

    it('stacks a new container when the pointer is inside another one', () => {
      const a = box('a', 1000, 1000);
      const outcome = dragOutcome({
        pointer: { x: 1300, y: 1200 },
        rect: { xMm: 913, yMm: 940, widthMm: W, depthMm: D },
        draggedIds: [],
        room,
        containers: [a],
      });
      expect(outcome.kind).toBe('stack');
      if (outcome.kind === 'stack') {
        expect(outcome.rect).toEqual({ xMm: 1000, yMm: 1000, widthMm: W, depthMm: D });
        expect(outcome.target.top.id).toBe('a');
        expect(outcome.level).toBe(2);
      }
    });

    it('gives the next level of a stack of several containers', () => {
      const list = [
        box('a', 1000, 1000),
        box('b', 1000, 1000, { stackPosition: 1 }),
        box('c', 1000, 1000, { stackPosition: 2 }),
      ];
      const outcome = dragOutcome({
        pointer: { x: 1300, y: 1200 },
        rect: snapped,
        draggedIds: [],
        room,
        containers: list,
      });
      expect(outcome).toMatchObject({ kind: 'stack', level: 4 });
    });

    it('takes the position and rotation of a rotated stack', () => {
      const outcome = dragOutcome({
        pointer: { x: 1100, y: 1700 },
        rect: snapped,
        draggedIds: [],
        room,
        containers: [box('a', 1000, 1000, { rotation: 90 })],
      });
      expect(outcome).toMatchObject({
        kind: 'stack',
        rect: { xMm: 1000, yMm: 1000, widthMm: D, depthMm: W },
      });
    });

    it('stacks an existing container that is alone on top of another one', () => {
      const a = box('a', 1000, 1000);
      const b = box('b', 2400, 1500);
      const outcome = dragOutcome({
        pointer: { x: 1300, y: 1200 },
        rect: { xMm: 1300, yMm: 1200, widthMm: W, depthMm: D },
        draggedIds: ['b'],
        room,
        containers: [a, b],
      });
      expect(outcome).toMatchObject({ kind: 'stack', level: 2 });
    });

    it('blocks dropping a stack of more than one container on another container', () => {
      const list = [
        box('a', 1000, 1000),
        box('b', 2400, 1500),
        box('c', 2400, 1500, { stackPosition: 1 }),
      ];
      const outcome = dragOutcome({
        pointer: { x: 1300, y: 1200 },
        rect: snapped,
        draggedIds: ['b', 'c'],
        room,
        containers: list,
      });
      expect(outcome).toEqual({ kind: 'blocked', rect: snapped });
    });

    it('moves a stack of more than one container like a single one when it is not on another', () => {
      const list = [box('b', 2400, 1500), box('c', 2400, 1500, { stackPosition: 1 })];
      const outcome = dragOutcome({
        pointer: { x: 2500, y: 1600 },
        rect: { xMm: 2450, yMm: 1550, widthMm: W, depthMm: D }, // over its own old place
        draggedIds: ['b', 'c'],
        room,
        containers: list,
      });
      expect(outcome).toMatchObject({ kind: 'place', problem: null });
    });

    it('does not stack on the stack that is being dragged', () => {
      const b = box('b', 2400, 1500);
      const outcome = dragOutcome({
        pointer: { x: 2500, y: 1600 },
        rect: { xMm: 2450, yMm: 1550, widthMm: W, depthMm: D },
        draggedIds: ['b'],
        room,
        containers: [b],
      });
      expect(outcome).toMatchObject({ kind: 'place', problem: null });
    });

    it('is red (overlap) when the footprints overlap but the pointer is not on the container', () => {
      const a = box('a', 1000, 1000); // x 1000..1775
      const outcome = dragOutcome({
        pointer: { x: 2100, y: 1200 }, // outside a
        rect: { xMm: 1700, yMm: 1000, widthMm: W, depthMm: D }, // overlaps a
        draggedIds: [],
        room,
        containers: [a],
      });
      expect(outcome).toMatchObject({ kind: 'place', problem: 'overlap' });
    });

    it('is red (outside) when the footprint would leave the room', () => {
      const outcome = dragOutcome({
        pointer: { x: 50, y: 50 },
        rect: { xMm: -300, yMm: -200, widthMm: W, depthMm: D },
        draggedIds: [],
        room,
        containers: [],
      });
      expect(outcome).toMatchObject({ kind: 'place', problem: 'outside' });
    });

    it('does not stack when the place of the target stack is not valid for the container', () => {
      // A container saved outside the room (the loader keeps it): stacking there is not allowed.
      const out = box('out', room.widthMm - 100, 1000);
      const outcome = dragOutcome({
        pointer: { x: room.widthMm - 50, y: 1100 },
        rect: snapped,
        draggedIds: [],
        room,
        containers: [out],
      });
      expect(outcome.kind).toBe('place');
    });
  });

  describe('reorderStack', () => {
    const list = [
      box('a', 100, 100),
      box('b', 100, 100, { stackPosition: 1 }),
      box('c', 100, 100, { stackPosition: 2 }),
      box('far', 2000, 0),
    ];

    it('moves a container up by swapping levels with the one above', () => {
      const result = reorderStack(list, 'a', 'up')!;
      expect(levels(result)).toEqual([1, 0, 2, 0]);
      expect(ids(stackOf(result, 'a')!.members)).toEqual(['b', 'a', 'c']);
    });

    it('moves a container down by swapping levels with the one below', () => {
      const result = reorderStack(list, 'c', 'down')!;
      expect(ids(stackOf(result, 'a')!.members)).toEqual(['a', 'c', 'b']);
    });

    it('can move a middle container both ways', () => {
      expect(ids(stackOf(reorderStack(list, 'b', 'up')!, 'a')!.members)).toEqual(['a', 'c', 'b']);
      expect(ids(stackOf(reorderStack(list, 'b', 'down')!, 'a')!.members)).toEqual(['b', 'a', 'c']);
    });

    it('returns null at the ends, for a container alone, and for an unknown id', () => {
      expect(reorderStack(list, 'c', 'up')).toBeNull();
      expect(reorderStack(list, 'a', 'down')).toBeNull();
      expect(reorderStack(list, 'far', 'up')).toBeNull();
      expect(reorderStack(list, 'nope', 'up')).toBeNull();
    });

    it('does not change the original list or the other containers', () => {
      const before = levels(list);
      const result = reorderStack(list, 'a', 'up')!;
      expect(levels(list)).toEqual(before);
      expect(result[3]).toBe(list[3]);
    });
  });

  describe('removeFromStack', () => {
    const list = [
      box('a', 100, 100, { rotation: 90 }),
      box('b', 100, 100, { rotation: 90, stackPosition: 1 }),
      box('c', 100, 100, { rotation: 90, stackPosition: 2 }),
    ];

    it('puts the container alone at the spot and keeps its rotation', () => {
      const result = removeFromStack(list, 'b', { xMm: 2000, yMm: 500 });
      expect(result.find((c) => c.id === 'b')).toMatchObject({
        xMm: 2000,
        yMm: 500,
        rotation: 90,
        stackPosition: 0,
      });
    });

    it('closes the gap in the stack it leaves', () => {
      const result = removeFromStack(list, 'a', { xMm: 2000, yMm: 500 });
      expect(ids(stackOf(result, 'b')!.members)).toEqual(['b', 'c']);
      expect(levels(stackOf(result, 'b')!.members)).toEqual([0, 1]);
    });

    it('does not change the list order or the other containers', () => {
      const result = removeFromStack(list, 'c', { xMm: 2000, yMm: 500 });
      expect(ids(result)).toEqual(['a', 'b', 'c']);
      expect(result[0]).toBe(list[0]);
    });
  });
});
