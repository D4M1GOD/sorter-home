import { clampRoomSize, ROOM_MIN_SIZE_MM } from './room.model';
import { snapToInchMm } from './units';

/** The three resize handles. The top-left corner of the room never moves. */
export type ResizeHandle = 'right' | 'bottom' | 'corner';

export interface RoomSize {
  widthMm: number;
  depthMm: number;
}

/**
 * New room size when a handle is dragged to a pointer position (in plan millimeters,
 * with the room's top-left corner at 0,0). Each dragged length is snapped to a whole inch
 * and then clamped between the room minimum and maximum. An edge handle only changes its own
 * axis; the other length stays as it is in `current`.
 *
 * `minSize` is the smallest size allowed, so the room cannot shrink under the containers inside
 * it (see `minRoomSizeFor`). It defaults to the room minimum.
 */
export function resizeRoom(
  handle: ResizeHandle,
  pointerMm: { x: number; y: number },
  current: RoomSize,
  minSize: RoomSize = { widthMm: ROOM_MIN_SIZE_MM, depthMm: ROOM_MIN_SIZE_MM },
): RoomSize {
  const changesWidth = handle === 'right' || handle === 'corner';
  const changesDepth = handle === 'bottom' || handle === 'corner';
  return {
    widthMm: changesWidth
      ? Math.max(minSize.widthMm, clampRoomSize(snapToInchMm(pointerMm.x)))
      : current.widthMm,
    depthMm: changesDepth
      ? Math.max(minSize.depthMm, clampRoomSize(snapToInchMm(pointerMm.y)))
      : current.depthMm,
  };
}
