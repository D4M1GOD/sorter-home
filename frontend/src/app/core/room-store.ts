import { Service, signal } from '@angular/core';
import { Container, getContainerType, isValidContainerName } from './container.model';
import { placementProblemIgnoring, rotatedContainer } from './container-move';
import { containerRect, isPlacementValid, minRoomSizeFor } from './container-placement';
import {
  clampRoomSize,
  isValidRoomName,
  Room,
  ROOM_MAX_SIZE_MM,
  ROOM_MIN_SIZE_MM,
} from './room.model';

export const ROOMS_STORAGE_KEY = 'sorterhome.rooms.v1';

function isValidSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= ROOM_MIN_SIZE_MM &&
    value <= ROOM_MAX_SIZE_MM
  );
}

/** A room as it can be found in localStorage: rooms saved before containers existed have none. */
type SavedRoom = Omit<Room, 'containers'> & { containers?: unknown };

/** Checks data read from localStorage, which could have been edited or corrupted. */
function isRoom(value: unknown): value is SavedRoom {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const room = value as Record<string, unknown>;
  return (
    typeof room['id'] === 'string' &&
    room['id'].length > 0 &&
    typeof room['name'] === 'string' &&
    isValidRoomName(room['name']) &&
    isValidSize(room['widthMm']) &&
    isValidSize(room['depthMm'])
  );
}

/** A container as it can be found in localStorage: the rotation may be missing or wrong. */
type SavedContainer = Omit<Container, 'rotation'> & { rotation?: unknown };

/**
 * Checks the shape of a saved container. It only checks the data, not the placement: a
 * well-formed container is kept even if it sits outside the room or overlaps another one.
 * The placement rules are applied when the user adds, moves or resizes, not when loading.
 * The rotation is not checked here: `loadContainers` repairs it instead of discarding the container.
 */
function isContainer(value: unknown): value is SavedContainer {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const container = value as Record<string, unknown>;
  return (
    typeof container['id'] === 'string' &&
    container['id'].length > 0 &&
    typeof container['typeId'] === 'string' &&
    getContainerType(container['typeId']) !== undefined &&
    typeof container['name'] === 'string' &&
    isValidContainerName(container['name']) &&
    Number.isInteger(container['xMm']) &&
    Number.isInteger(container['yMm'])
  );
}

/**
 * Reads the containers of a saved room. Rooms saved before containers existed have none.
 * Malformed entries and repeated ids are discarded. A rotation that is missing or is not 0 or 90
 * becomes 0: the container is kept, because losing a container is worse than losing its turn.
 */
function loadContainers(value: unknown): Container[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seenIds = new Set<string>();
  const containers: Container[] = [];
  for (const item of value) {
    if (isContainer(item) && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      containers.push({
        id: item.id,
        typeId: item.typeId,
        name: item.name,
        xMm: item.xMm,
        yMm: item.yMm,
        rotation: item.rotation === 90 ? 90 : 0,
      });
    }
  }
  return containers;
}

/** Reads the saved rooms. Any problem (no storage, bad JSON, wrong shape) gives an empty list. */
function loadRooms(): Room[] {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seenIds = new Set<string>();
    const rooms: Room[] = [];
    for (const item of parsed) {
      if (isRoom(item) && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        rooms.push({
          id: item.id,
          name: item.name,
          widthMm: item.widthMm,
          depthMm: item.depthMm,
          containers: loadContainers(item.containers),
        });
      }
    }
    return rooms;
  } catch {
    return [];
  }
}

/**
 * Keeps all rooms in memory (a signal) and saves them in localStorage.
 * Pages only use these methods, so localStorage can later be replaced by a backend API
 * without changing the pages.
 */
@Service()
export class RoomStore {
  private readonly roomsState = signal<Room[]>(loadRooms());

  /** Read-only view of the rooms. Change them only through the methods below. */
  readonly rooms = this.roomsState.asReadonly();

  getById(id: string): Room | undefined {
    return this.roomsState().find((room) => room.id === id);
  }

  add(room: Room): void {
    this.update((rooms) => [...rooms, room]);
  }

  /** Renames a room. Returns false if the room does not exist or the name is not valid. */
  rename(id: string, name: string): boolean {
    if (!isValidRoomName(name) || !this.getById(id)) {
      return false;
    }
    this.update((rooms) =>
      rooms.map((room) => (room.id === id ? { ...room, name: name.trim() } : room)),
    );
    return true;
  }

  /**
   * Changes the size of a room. Lengths are rounded and kept between the minimum and maximum,
   * and never smaller than the containers inside the room. Returns false if the room does
   * not exist.
   */
  resize(id: string, widthMm: number, depthMm: number): boolean {
    const current = this.getById(id);
    if (!current) {
      return false;
    }
    const min = minRoomSizeFor(current.containers);
    const width = Math.max(min.widthMm, clampRoomSize(widthMm));
    const depth = Math.max(min.depthMm, clampRoomSize(depthMm));
    this.update((rooms) =>
      rooms.map((room) =>
        room.id === id ? { ...room, widthMm: width, depthMm: depth } : room,
      ),
    );
    return true;
  }

  /**
   * Adds a container to a room. Returns false (and changes nothing) if the room does not exist,
   * the container is not valid, its id is already used, or its place is not valid (it would
   * leave the room or overlap another container).
   */
  addContainer(roomId: string, container: Container): boolean {
    const room = this.getById(roomId);
    if (
      !room ||
      !isValidContainerName(container.name) ||
      !getContainerType(container.typeId) ||
      room.containers.some((existing) => existing.id === container.id) ||
      !isPlacementValid(containerRect(container), room, room.containers)
    ) {
      return false;
    }
    this.updateRoom(roomId, (r) => ({ ...r, containers: [...r.containers, container] }));
    return true;
  }

  /** Renames a container. Returns false if the room or container does not exist or the name is not valid. */
  renameContainer(roomId: string, containerId: string, name: string): boolean {
    const room = this.getById(roomId);
    if (!room || !isValidContainerName(name) || !room.containers.some((c) => c.id === containerId)) {
      return false;
    }
    this.updateRoom(roomId, (r) => ({
      ...r,
      containers: r.containers.map((c) => (c.id === containerId ? { ...c, name: name.trim() } : c)),
    }));
    return true;
  }

  /**
   * Moves a container to a new top-left corner (whole millimeters). The place is checked again
   * here, so the data stays valid whatever the screen sends: it must be inside the room and not
   * overlap another container (the container itself does not count). Returns false, and changes
   * nothing, if the room or container does not exist, a value is not a whole number, or the
   * place is not valid.
   */
  moveContainer(roomId: string, containerId: string, xMm: number, yMm: number): boolean {
    const room = this.getById(roomId);
    const container = room?.containers.find((c) => c.id === containerId);
    if (!room || !container || !Number.isInteger(xMm) || !Number.isInteger(yMm)) {
      return false;
    }
    const rect = { ...containerRect(container), xMm, yMm };
    if (placementProblemIgnoring(rect, container.id, room, room.containers) !== null) {
      return false;
    }
    if (xMm !== container.xMm || yMm !== container.yMm) {
      this.updateContainer(roomId, containerId, (c) => ({ ...c, xMm, yMm }));
    }
    return true;
  }

  /**
   * Turns a container 90° around its center (see `rotatedContainer`). The new place is checked
   * again here. Returns false, and changes nothing, if the room or container does not exist or
   * the rotated container would leave the room or overlap another one.
   */
  rotateContainer(roomId: string, containerId: string): boolean {
    const room = this.getById(roomId);
    const container = room?.containers.find((c) => c.id === containerId);
    if (!room || !container) {
      return false;
    }
    const rotated = rotatedContainer(container);
    if (
      placementProblemIgnoring(containerRect(rotated), container.id, room, room.containers) !== null
    ) {
      return false;
    }
    this.updateContainer(roomId, containerId, () => rotated);
    return true;
  }

  /** Removes a container. Returns false if the room or container does not exist. */
  removeContainer(roomId: string, containerId: string): boolean {
    const room = this.getById(roomId);
    if (!room || !room.containers.some((c) => c.id === containerId)) {
      return false;
    }
    this.updateRoom(roomId, (r) => ({
      ...r,
      containers: r.containers.filter((c) => c.id !== containerId),
    }));
    return true;
  }

  remove(id: string): void {
    this.update((rooms) => rooms.filter((room) => room.id !== id));
  }

  private updateContainer(
    roomId: string,
    containerId: string,
    change: (container: Container) => Container,
  ): void {
    this.updateRoom(roomId, (room) => ({
      ...room,
      containers: room.containers.map((c) => (c.id === containerId ? change(c) : c)),
    }));
  }

  private updateRoom(id: string, change: (room: Room) => Room): void {
    this.update((rooms) => rooms.map((room) => (room.id === id ? change(room) : room)));
  }

  private update(change: (rooms: Room[]) => Room[]): void {
    const next = change(this.roomsState());
    this.roomsState.set(next);
    try {
      localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage is full or unavailable: the app keeps working, but data is not saved.
    }
  }
}
