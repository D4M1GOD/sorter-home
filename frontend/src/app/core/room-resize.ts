import { clampRoomSize } from './room.model';
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
 */
export function resizeRoom(
  handle: ResizeHandle,
  pointerMm: { x: number; y: number },
  current: RoomSize,
): RoomSize {
  const changesWidth = handle === 'right' || handle === 'corner';
  const changesDepth = handle === 'bottom' || handle === 'corner';
  return {
    widthMm: changesWidth ? clampRoomSize(snapToInchMm(pointerMm.x)) : current.widthMm,
    depthMm: changesDepth ? clampRoomSize(snapToInchMm(pointerMm.y)) : current.depthMm,
  };
}
