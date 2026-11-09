import { Service, signal } from '@angular/core';
import {
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

/** Checks data read from localStorage, which could have been edited or corrupted. */
function isRoom(value: unknown): value is Room {
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

  remove(id: string): void {
    this.update((rooms) => rooms.filter((room) => room.id !== id));
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
