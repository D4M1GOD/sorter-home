import { vi } from 'vitest';
import { createRoom } from './room.model';
import { ROOMS_STORAGE_KEY, RoomStore } from './room-store';

describe('RoomStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty when nothing is saved', () => {
    expect(new RoomStore().rooms()).toEqual([]);
  });

  it('adds a room and finds it by id', () => {
    const store = new RoomStore();
    const room = createRoom('Garage');
    store.add(room);
    expect(store.rooms()).toEqual([room]);
    expect(store.getById(room.id)).toEqual(room);
  });

  it('returns undefined for an unknown id', () => {
    expect(new RoomStore().getById('nope')).toBeUndefined();
  });

  it('renames a room and trims the name', () => {
    const store = new RoomStore();
    const room = createRoom('Garage');
    store.add(room);
    expect(store.rename(room.id, '  Attic  ')).toBe(true);
    expect(store.getById(room.id)?.name).toBe('Attic');
  });

  it('does not rename with an invalid name or an unknown id', () => {
    const store = new RoomStore();
    const room = createRoom('Garage');
    store.add(room);
    expect(store.rename(room.id, '   ')).toBe(false);
    expect(store.rename('nope', 'Attic')).toBe(false);
    expect(store.getById(room.id)?.name).toBe('Garage');
  });

  it('removes a room', () => {
    const store = new RoomStore();
    const room = createRoom('Garage');
    store.add(room);
    store.remove(room.id);
    expect(store.rooms()).toEqual([]);
  });

  it('keeps the data when a new store instance is created', () => {
    const first = new RoomStore();
    const room = createRoom('Garage');
    first.add(room);
    first.rename(room.id, 'Basement');
    expect(new RoomStore().rooms()).toEqual([{ ...room, name: 'Basement' }]);
  });

  it('starts empty when the saved text is not valid JSON', () => {
    localStorage.setItem(ROOMS_STORAGE_KEY, '{not json');
    expect(new RoomStore().rooms()).toEqual([]);
  });

  it('starts empty when the saved data is not a list', () => {
    localStorage.setItem(ROOMS_STORAGE_KEY, '{"a":1}');
    expect(new RoomStore().rooms()).toEqual([]);
    localStorage.setItem(ROOMS_STORAGE_KEY, 'null');
    expect(new RoomStore().rooms()).toEqual([]);
  });

  it('ignores saved items that are not valid rooms', () => {
    const good = createRoom('Garage');
    localStorage.setItem(
      ROOMS_STORAGE_KEY,
      JSON.stringify([
        good,
        { id: 'a', name: '', widthMm: 3658, depthMm: 3048 },
        { id: 'b', name: 'Bad size', widthMm: 12.5, depthMm: 3048 },
        { id: 'c', name: 'Too small', widthMm: 10, depthMm: 3048 },
        { id: 'd', name: 'Missing depth', widthMm: 3658 },
        'text',
        null,
        good,
      ]),
    );
    expect(new RoomStore().rooms()).toEqual([good]);
  });

  it('does not crash when localStorage is not available', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = new RoomStore();
    expect(store.rooms()).toEqual([]);
    const room = createRoom('Garage');
    store.add(room);
    expect(store.getById(room.id)).toEqual(room);
  });
});
