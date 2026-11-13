import { Container } from './container.model';
import { placementProblemIgnoring, PlanPoint } from './container-move';
import { containerRect, PlacementProblem, Rect } from './container-placement';
import { RoomSize } from './room-resize';

/**
 * Containers that share the same top-left corner and rotation, one on top of the other.
 * A container alone is a stack of one. The stack is derived from the positions: nothing else is
 * stored about it, so all its members are always in the same place.
 * With only one container type, all members have the same footprint.
 */
export interface Stack {
  /** The members from the bottom (level 1) to the top. */
  members: Container[];
  /** The container on top: the one that is drawn on the plan. */
  top: Container;
  /** The footprint of the stack on the plan. */
  rect: Rect;
}

function stackKey(container: Container): string {
  return `${container.xMm},${container.yMm},${container.rotation}`;
}

/** Members of one group of containers in the same place, from the bottom to the top. */
function sortedByLevel(group: { container: Container; index: number }[]): Container[] {
  return [...group]
    .sort((a, b) => a.container.stackPosition - b.container.stackPosition || a.index - b.index)
    .map((entry) => entry.container);
}

function groupByPlace(containers: readonly Container[]) {
  const groups = new Map<string, { container: Container; index: number }[]>();
  containers.forEach((container, index) => {
    const key = stackKey(container);
    const group = groups.get(key);
    if (group) {
      group.push({ container, index });
    } else {
      groups.set(key, [{ container, index }]);
    }
  });
  return groups;
}

/**
 * Every stack of the room. They come in the order of their first container in the list, so the
 * order is stable and the last stack is the one drawn on top of the others.
 */
export function stacksOf(containers: readonly Container[]): Stack[] {
  return Array.from(groupByPlace(containers).values()).map((group) => {
    const members = sortedByLevel(group);
    return { members, top: members[members.length - 1], rect: containerRect(members[0]) };
  });
}

/** The stack that has this container, or undefined if the id is not in the list. */
export function stackOf(containers: readonly Container[], id: string): Stack | undefined {
  const container = containers.find((c) => c.id === id);
  if (!container) {
    return undefined;
  }
  const members = sortedByLevel(
    containers
      .map((c, index) => ({ container: c, index }))
      .filter((entry) => stackKey(entry.container) === stackKey(container)),
  );
  return { members, top: members[members.length - 1], rect: containerRect(members[0]) };
}

/**
 * Makes the levels of every stack whole numbers 0, 1, 2... with no gaps and no repeats. The
 * order is kept: the lower `stackPosition` goes first, and containers with the same value keep
 * the order they have in the list (the first one goes lower). The list order does not change.
 * Containers whose level is already right are returned as they are.
 */
export function normalizeStacks(containers: readonly Container[]): Container[] {
  const levels = new Map<string, number>();
  for (const group of groupByPlace(containers).values()) {
    sortedByLevel(group).forEach((container, level) => levels.set(container.id, level));
  }
  return containers.map((container) => {
    const level = levels.get(container.id) ?? 0;
    return level === container.stackPosition ? container : { ...container, stackPosition: level };
  });
}

/** True when the point is inside the rectangle. Left and top edges count, right and bottom do not. */
function containsPoint(rect: Rect, point: PlanPoint): boolean {
  return (
    point.x >= rect.xMm &&
    point.x < rect.xMm + rect.widthMm &&
    point.y >= rect.yMm &&
    point.y < rect.yMm + rect.depthMm
  );
}

/**
 * The stack under a point (the pointer), or undefined. Stacks that have any of the ignored
 * containers (the ones being dragged) are skipped. If stacks overlap (data edited by hand),
 * the one drawn on top wins.
 */
export function stackAtPoint(
  point: PlanPoint,
  containers: readonly Container[],
  ignoredIds: readonly string[] = [],
): Stack | undefined {
  return stacksOf(containers)
    .filter((stack) => !stack.members.some((member) => ignoredIds.includes(member.id)))
    .reverse()
    .find((stack) => containsPoint(stack.rect, point));
}

/** What would happen if the user dropped a container, or a stack, where the pointer is. */
export type DragOutcome =
  /** Put it on the plan at `rect`. It is valid when `problem` is null. */
  | { kind: 'place'; rect: Rect; problem: PlacementProblem | null }
  /** Put it on top of `target`: it takes the position and rotation of that stack. */
  | { kind: 'stack'; rect: Rect; target: Stack; level: number }
  /** The pointer is on another stack but the dragged one has more than one container. */
  | { kind: 'blocked'; rect: Rect };

/**
 * Decides what happens when something is dropped. The toolbox drop (a new container) and the
 * move drop (an existing container or stack) both use it, so they follow the same rules:
 * - The pointer is inside another stack: a single container goes on top of it (level = its size + 1).
 *   A stack of more than one container is blocked: stacks are not merged.
 * - Otherwise it is a normal placement at `rect`: valid, or a problem (outside the room, or the
 *   footprints overlap without the pointer being inside the other container).
 * `draggedIds` are the containers being dragged. They are empty for a new container.
 * `rect` is where the dragged footprint would land, with its top-left corner snapped to inches.
 */
export function dragOutcome(input: {
  pointer: PlanPoint;
  rect: Rect;
  draggedIds: readonly string[];
  room: RoomSize;
  containers: readonly Container[];
}): DragOutcome {
  const { pointer, rect, draggedIds, room, containers } = input;
  const place = (): DragOutcome => ({
    kind: 'place',
    rect,
    problem: placementProblemIgnoring(rect, draggedIds, room, containers),
  });
  const target = stackAtPoint(pointer, containers, draggedIds);
  if (!target) {
    return place();
  }
  if (draggedIds.length > 1) {
    return { kind: 'blocked', rect };
  }
  // The dropped container takes the place of the stack, so that place must be valid for it.
  const ignored = [...draggedIds, ...target.members.map((member) => member.id)];
  if (placementProblemIgnoring(target.rect, ignored, room, containers) !== null) {
    return place();
  }
  return { kind: 'stack', rect: target.rect, target, level: target.members.length + 1 };
}

/**
 * Moves a container one level up or down in its stack, swapping levels with its neighbor.
 * Returns the new list, or null if the container is not in the list or is already at that end.
 */
export function reorderStack(
  containers: readonly Container[],
  id: string,
  direction: 'up' | 'down',
): Container[] | null {
  const stack = stackOf(containers, id);
  const index = stack?.members.findIndex((member) => member.id === id) ?? -1;
  const neighbor = stack?.members[index + (direction === 'up' ? 1 : -1)];
  if (!stack || index < 0 || !neighbor) {
    return null;
  }
  const moved = stack.members[index];
  return containers.map((container) => {
    if (container.id === moved.id) {
      return { ...container, stackPosition: neighbor.stackPosition };
    }
    if (container.id === neighbor.id) {
      return { ...container, stackPosition: moved.stackPosition };
    }
    return container;
  });
}

/**
 * Takes a container out of its stack and puts it, alone, at `spot`. It keeps its rotation.
 * The levels of the stack it leaves are closed up (no gap). Returns the new list.
 */
export function removeFromStack(
  containers: readonly Container[],
  id: string,
  spot: { xMm: number; yMm: number },
): Container[] {
  return normalizeStacks(
    containers.map((container) =>
      container.id === id
        ? { ...container, xMm: spot.xMm, yMm: spot.yMm, stackPosition: 0 }
        : container,
    ),
  );
}
