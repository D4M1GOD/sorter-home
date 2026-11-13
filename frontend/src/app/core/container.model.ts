import { inchesToMm } from './units';
import { isValidRoomName, ROOM_NAME_MAX_LENGTH } from './room.model';

/** A kind of container that can be placed on the plan. All lengths are whole millimeters. */
export interface ContainerType {
  id: string;
  label: string;
  /** Footprint seen from above, with rotation 0. */
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

/** Tough Box 27 gal: 30.5 x 20.5 x 14.25 in outside (775 x 521 x 362 mm). */
export const TOUGH_BOX_27_GAL: ContainerType = {
  id: 'tough-box-27-gal',
  label: 'Tough Box 27 gal',
  widthMm: inchesToMm(30.5),
  depthMm: inchesToMm(20.5),
  heightMm: inchesToMm(14.25),
};

/** Every container type the toolbox offers. Add new types here. */
export const CONTAINER_TYPES: readonly ContainerType[] = [TOUGH_BOX_27_GAL];

export function getContainerType(typeId: string): ContainerType | undefined {
  return CONTAINER_TYPES.find((type) => type.id === typeId);
}

/** Rotation in degrees. It is always 0 until rotating is built (step 2.2). */
export type ContainerRotation = 0 | 90;

/** A physical box on the plan. It has no photo, description or category: those belong to items. */
export interface Container {
  id: string;
  typeId: string;
  name: string;
  /** Top-left corner of the footprint, in plan millimeters (the room's top-left corner is 0,0). */
  xMm: number;
  yMm: number;
  rotation: ContainerRotation;
}

/** Container names follow the same rules as room names. */
export const CONTAINER_NAME_MAX_LENGTH = ROOM_NAME_MAX_LENGTH;
export const isValidContainerName = isValidRoomName;

/** Creates a container with rotation 0. Throws if the name or the type is not valid. */
export function createContainer(
  typeId: string,
  name: string,
  xMm: number,
  yMm: number,
): Container {
  if (!isValidContainerName(name)) {
    throw new Error('Invalid container name');
  }
  if (!getContainerType(typeId)) {
    throw new Error('Unknown container type');
  }
  return { id: crypto.randomUUID(), typeId, name: name.trim(), xMm, yMm, rotation: 0 };
}

/**
 * Automatic name for a new container: "Container N", where N is the lowest positive number
 * that no container in the list uses yet (names are compared exactly).
 */
export function nextContainerName(containers: readonly Container[]): string {
  const used = new Set(containers.map((container) => container.name));
  let n = 1;
  while (used.has(`Container ${n}`)) {
    n++;
  }
  return `Container ${n}`;
}

/** Shortens a text to at most `maxChars` characters, ending with "…" when it was cut. */
export function truncateLabel(text: string, maxChars: number): string {
  if (maxChars < 1) {
    return '';
  }
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}
