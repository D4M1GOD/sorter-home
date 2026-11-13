import { Container } from './container.model';
import {
  footprintOf,
  PlacementProblem,
  placementProblem,
  Rect,
  snapTopLeft,
} from './container-placement';
import { RoomSize } from './room-resize';
import { snapToInchMm } from './units';

/** A point on the plan, in millimeters. It can have decimals: it comes from the pointer. */
export interface PlanPoint {
  x: number;
  y: number;
}

/**
 * Where inside the container the pointer holds it: the distance from the container's top-left
 * corner to the pointer. It is measured once, when the press starts.
 */
export function grabOffsetOf(pointer: PlanPoint, container: Container): PlanPoint {
  return { x: pointer.x - container.xMm, y: pointer.y - container.yMm };
}

/**
 * Top-left corner of a container that is being dragged, snapped to whole inches. Keeping the
 * grab offset means the part of the container under the pointer stays under the pointer, so the
 * container does not jump when the drag starts.
 */
export function moveTopLeft(
  pointer: PlanPoint,
  grabOffset: PlanPoint,
): { xMm: number; yMm: number } {
  return {
    xMm: snapToInchMm(pointer.x - grabOffset.x),
    yMm: snapToInchMm(pointer.y - grabOffset.y),
  };
}

/**
 * Like `placementProblem`, but one container is left out of the overlap check: the one being
 * moved or rotated. Otherwise it would overlap with itself at its old position.
 */
export function placementProblemIgnoring(
  rect: Rect,
  ignoredId: string,
  room: RoomSize,
  containers: readonly Container[],
): PlacementProblem | null {
  return placementProblem(
    rect,
    room,
    containers.filter((container) => container.id !== ignoredId),
  );
}

/**
 * The container turned 90°, as a new object (the original is not changed). It pivots around its
 * center: the center stays where it was, and the new top-left corner is snapped to whole inches.
 * Rotation alternates between 0 and 90, because 180° has the same footprint as 0°.
 * It does not check that the result fits in the room: use `placementProblemIgnoring` for that.
 */
export function rotatedContainer(container: Container): Container {
  const current = footprintOf(container.typeId, container.rotation);
  const rotation = container.rotation === 0 ? 90 : 0;
  const next = footprintOf(container.typeId, rotation);
  const center = {
    x: container.xMm + current.widthMm / 2,
    y: container.yMm + current.depthMm / 2,
  };
  return { ...container, ...snapTopLeft(center, next), rotation };
}
