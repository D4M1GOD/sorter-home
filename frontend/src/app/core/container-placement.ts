import { Container, ContainerRotation, getContainerType } from './container.model';
import { ROOM_MAX_SIZE_MM, ROOM_MIN_SIZE_MM } from './room.model';
import { RoomSize } from './room-resize';
import { ceilToInchMm, feetToMm, snapToInchMm } from './units';

/** A rectangle on the plan, in millimeters. (xMm, yMm) is its top-left corner. */
export interface Rect {
  xMm: number;
  yMm: number;
  widthMm: number;
  depthMm: number;
}

/** Why a place is not valid. */
export type PlacementProblem = 'outside' | 'overlap';

/** Footprint of a container type. A 90° rotation swaps width and depth. Throws for an unknown type. */
export function footprintOf(typeId: string, rotation: ContainerRotation = 0): RoomSize {
  const type = getContainerType(typeId);
  if (!type) {
    throw new Error('Unknown container type');
  }
  return rotation === 90
    ? { widthMm: type.depthMm, depthMm: type.widthMm }
    : { widthMm: type.widthMm, depthMm: type.depthMm };
}

/** The rectangle a container occupies on the plan. */
export function containerRect(container: Container): Rect {
  return {
    xMm: container.xMm,
    yMm: container.yMm,
    ...footprintOf(container.typeId, container.rotation),
  };
}

/** True when the rectangles share some area. Rectangles that only touch edges do not overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.xMm < b.xMm + b.widthMm &&
    b.xMm < a.xMm + a.widthMm &&
    a.yMm < b.yMm + b.depthMm &&
    b.yMm < a.yMm + a.depthMm
  );
}

/** Tells why a rectangle cannot be placed in the room, or null when the place is valid. */
export function placementProblem(
  rect: Rect,
  room: RoomSize,
  containers: readonly Container[],
): PlacementProblem | null {
  const inside =
    rect.xMm >= 0 &&
    rect.yMm >= 0 &&
    rect.xMm + rect.widthMm <= room.widthMm &&
    rect.yMm + rect.depthMm <= room.depthMm;
  if (!inside) {
    return 'outside';
  }
  return containers.some((container) => rectsOverlap(rect, containerRect(container)))
    ? 'overlap'
    : null;
}

/** Valid = fully inside the room walls and not overlapping any other container. */
export function isPlacementValid(
  rect: Rect,
  room: RoomSize,
  containers: readonly Container[],
): boolean {
  return placementProblem(rect, room, containers) === null;
}

/**
 * Top-left corner for a container whose center is at `centerMm`, snapped to whole inches.
 * The center is used so the container follows the pointer from its middle.
 */
export function snapTopLeft(
  centerMm: { x: number; y: number },
  footprint: RoomSize,
): { xMm: number; yMm: number } {
  return {
    xMm: snapToInchMm(centerMm.x - footprint.widthMm / 2),
    yMm: snapToInchMm(centerMm.y - footprint.depthMm / 2),
  };
}

/**
 * First valid top-left corner, scanning row by row from the room's top-left corner
 * in 1 ft steps. Returns null when there is no free spot.
 */
export function firstFreeSpot(
  room: RoomSize,
  containers: readonly Container[],
  footprint: RoomSize,
): { xMm: number; yMm: number } | null {
  for (let row = 0; feetToMm(row) + footprint.depthMm <= room.depthMm; row++) {
    for (let col = 0; feetToMm(col) + footprint.widthMm <= room.widthMm; col++) {
      const rect = { xMm: feetToMm(col), yMm: feetToMm(row), ...footprint };
      if (isPlacementValid(rect, room, containers)) {
        return { xMm: rect.xMm, yMm: rect.yMm };
      }
    }
  }
  return null;
}

/**
 * Smallest room size that keeps every container inside: the outer limit of the containers,
 * rounded up to a whole inch so the 1 in resize steps still work. It is never below the room
 * minimum or above the room maximum.
 */
export function minRoomSizeFor(containers: readonly Container[]): RoomSize {
  let right = 0;
  let bottom = 0;
  for (const container of containers) {
    const rect = containerRect(container);
    right = Math.max(right, rect.xMm + rect.widthMm);
    bottom = Math.max(bottom, rect.yMm + rect.depthMm);
  }
  const fit = (limit: number) =>
    Math.min(ROOM_MAX_SIZE_MM, Math.max(ROOM_MIN_SIZE_MM, ceilToInchMm(limit)));
  return { widthMm: fit(right), depthMm: fit(bottom) };
}
