import type { Container } from './container.model';
import { feetToMm } from './units';

/** A room is a floor plan seen from above. All lengths are whole millimeters. */
export interface Room {
  id: string;
  name: string;
  /** Left-to-right size of the plan. */
  widthMm: number;
  /** Front-to-back size of the plan. */
  depthMm: number;
  /** The containers placed in this room. */
  containers: Container[];
}

export const ROOM_NAME_MAX_LENGTH = 60;
export const ROOM_DEFAULT_WIDTH_MM = feetToMm(12);
export const ROOM_DEFAULT_DEPTH_MM = feetToMm(10);
export const ROOM_MIN_SIZE_MM = feetToMm(4);
export const ROOM_MAX_SIZE_MM = feetToMm(100);

/** A name is valid when it has 1 to 60 characters after removing surrounding spaces. */
export function isValidRoomName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= ROOM_NAME_MAX_LENGTH;
}

/** Rounds to whole millimeters and keeps the size between the minimum and the maximum. */
export function clampRoomSize(sizeMm: number): number {
  return Math.min(ROOM_MAX_SIZE_MM, Math.max(ROOM_MIN_SIZE_MM, Math.round(sizeMm)));
}

/** Creates a room with the default size. Throws if the name is not valid. */
export function createRoom(name: string): Room {
  if (!isValidRoomName(name)) {
    throw new Error('Invalid room name');
  }
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    widthMm: ROOM_DEFAULT_WIDTH_MM,
    depthMm: ROOM_DEFAULT_DEPTH_MM,
    containers: [],
  };
}