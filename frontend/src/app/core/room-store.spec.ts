import { vi } from 'vitest';
import { createContainer, TOUGH_BOX_27_GAL } from './container.model';
import { createRoom, ROOM_MAX_SIZE_MM, ROOM_MIN_SIZE_MM } from './room.model';
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

  it('resizes a room', () => {
    const store = new RoomStore();
    const room = createRoom('Garage');
    store.add(room);
    expect(store.resize(room.id, 5000, 4000)).toBe(true);
    expect(store.getById(room.id)).toEqual({ ...room, widthMm: 5000, depthMm: 4000 });
  });

  it('clamps the size when resizing', () => {
    const store = new RoomStore();
    const room = createRoom('Garage');
    store.add(room);
    expect(store.resize(room.id, 10, 999999)).toBe(true);
    expect(store.getById(room.id)?.widthMm).toBe(ROOM_MIN_SIZE_MM);
    expect(store.getById(room.id)?.depthMm).toBe(ROOM_MAX_SIZE_MM);
  });

  it('does not resize an unknown id', () => {
    const store = new RoomStore();
    const room = createRoom('Garage');
    store.add(room);
    expect(store.resize('nope', 5000, 4000)).toBe(false);
    expect(store.getById(room.id)).toEqual(room);
  });

  it('keeps the new size when a new store instance is created', () => {
    const first = new RoomStore();
    const room = createRoom('Garage');
    first.add(room);
    first.resize(room.id, 5000, 4000);
    expect(new RoomStore().getById(room.id)).toEqual({ ...room, widthMm: 5000, depthMm: 4000 });
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

describe('RoomStore containers', () => {
  const W = TOUGH_BOX_27_GAL.widthMm;
  const D = TOUGH_BOX_27_GAL.depthMm;

  beforeEach(() => {
    localStorage.clear();
  });

  function storeWithRoom() {
    const store = new RoomStore();
    const room = createRoom('Garage'); // 3658 x 3048 mm
    store.add(room);
    return { store, room };
  }

  function box(name: string, xMm: number, yMm: number) {
    return createContainer(TOUGH_BOX_27_GAL.id, name, xMm, yMm);
  }

  it('adds a container to a room', () => {
    const { store, room } = storeWithRoom();
    const container = box('Toys', 100, 200);
    expect(store.addContainer(room.id, container)).toBe(true);
    expect(store.getById(room.id)?.containers).toEqual([container]);
  });

  it('does not add a container that leaves the room or overlaps another one', () => {
    const { store, room } = storeWithRoom();
    expect(store.addContainer(room.id, box('A', 0, 0))).toBe(true);
    expect(store.addContainer(room.id, box('Overlap', 100, 100))).toBe(false);
    expect(store.addContainer(room.id, box('Outside', room.widthMm - W + 1, 1000))).toBe(false);
    expect(store.addContainer(room.id, box('Negative', -5, 1000))).toBe(false);
    expect(store.getById(room.id)?.containers.length).toBe(1);
  });

  it('does not add a container to an unknown room, with a repeated id or an invalid name', () => {
    const { store, room } = storeWithRoom();
    const container = box('A', 0, 0);
    expect(store.addContainer('nope', container)).toBe(false);
    expect(store.addContainer(room.id, container)).toBe(true);
    expect(store.addContainer(room.id, { ...container, xMm: 2000 })).toBe(false);
    expect(store.addContainer(room.id, { ...box('B', 2000, 0), name: '   ' })).toBe(false);
    expect(store.getById(room.id)?.containers.length).toBe(1);
  });

  it('renames a container and trims the name', () => {
    const { store, room } = storeWithRoom();
    const container = box('A', 0, 0);
    store.addContainer(room.id, container);
    expect(store.renameContainer(room.id, container.id, '  Winter  ')).toBe(true);
    expect(store.getById(room.id)?.containers[0].name).toBe('Winter');
  });

  it('does not rename with an invalid name or an unknown id', () => {
    const { store, room } = storeWithRoom();
    const container = box('A', 0, 0);
    store.addContainer(room.id, container);
    expect(store.renameContainer(room.id, container.id, '   ')).toBe(false);
    expect(store.renameContainer(room.id, container.id, 'a'.repeat(61))).toBe(false);
    expect(store.renameContainer(room.id, 'nope', 'B')).toBe(false);
    expect(store.renameContainer('nope', container.id, 'B')).toBe(false);
    expect(store.getById(room.id)?.containers[0].name).toBe('A');
  });

  it('removes a container', () => {
    const { store, room } = storeWithRoom();
    const a = box('A', 0, 0);
    const b = box('B', 2000, 0);
    store.addContainer(room.id, a);
    store.addContainer(room.id, b);
    expect(store.removeContainer(room.id, a.id)).toBe(true);
    expect(store.getById(room.id)?.containers).toEqual([b]);
    expect(store.removeContainer(room.id, a.id)).toBe(false);
    expect(store.removeContainer('nope', b.id)).toBe(false);
  });

  it('keeps the containers when a new store instance is created', () => {
    const { store, room } = storeWithRoom();
    const container = box('Toys', 100, 200);
    store.addContainer(room.id, container);
    store.renameContainer(room.id, container.id, 'Books');
    expect(new RoomStore().getById(room.id)?.containers).toEqual([{ ...container, name: 'Books' }]);
    store.removeContainer(room.id, container.id);
    expect(new RoomStore().getById(room.id)?.containers).toEqual([]);
  });

  it('loads rooms saved before containers existed as rooms without containers', () => {
    localStorage.setItem(
      ROOMS_STORAGE_KEY,
      JSON.stringify([{ id: 'old', name: 'Old room', widthMm: 3658, depthMm: 3048 }]),
    );
    const store = new RoomStore();
    expect(store.getById('old')).toEqual({
      id: 'old',
      name: 'Old room',
      widthMm: 3658,
      depthMm: 3048,
      containers: [],
    });
    // The old room is fully usable.
    const container = box('A', 0, 0);
    expect(store.addContainer('old', container)).toBe(true);
    expect(new RoomStore().getById('old')?.containers).toEqual([container]);
  });

  it('treats a saved "containers" value that is not a list as no containers', () => {
    localStorage.setItem(
      ROOMS_STORAGE_KEY,
      JSON.stringify([{ id: 'r', name: 'R', widthMm: 3658, depthMm: 3048, containers: 'x' }]),
    );
    expect(new RoomStore().getById('r')?.containers).toEqual([]);
  });

  it('discards malformed saved containers and keeps the good ones', () => {
    const good = box('Good', 0, 0);
    localStorage.setItem(
      ROOMS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r',
          name: 'R',
          widthMm: 3658,
          depthMm: 3048,
          containers: [
            good,
            { ...good, id: 'a', name: '' },
            { ...good, id: 'b', typeId: 'unknown-type' },
            { ...good, id: 'c', xMm: 10.5 },
            { ...good, id: 'd', yMm: '5' },
            { ...good, id: 'e', rotation: 45 },
            { id: 'f', typeId: TOUGH_BOX_27_GAL.id, name: 'No position', rotation: 0 },
            'text',
            null,
            good,
          ],
        },
      ]),
    );
    expect(new RoomStore().getById('r')?.containers).toEqual([good]);
  });

  it('keeps well-formed saved containers even outside the room or overlapping', () => {
    const outside = { ...box('Outside', 99999, 0), id: 'out' };
    const overlapA = { ...box('A', 0, 0), id: 'a' };
    const overlapB = { ...box('B', 100, 100), id: 'b' };
    localStorage.setItem(
      ROOMS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'r',
          name: 'R',
          widthMm: 3658,
          depthMm: 3048,
          containers: [outside, overlapA, overlapB],
        },
      ]),
    );
    expect(new RoomStore().getById('r')?.containers).toEqual([outside, overlapA, overlapB]);
  });

  describe('resize with containers', () => {
    it('does not shrink a room under its containers', () => {
      const { store, room } = storeWithRoom();
      // Outer limit 2000 + W = 2775 mm and 1500 + D = 2021 mm -> 2794 x 2032 mm.
      store.addContainer(room.id, box('A', 2000, 1500));
      expect(store.resize(room.id, 1300, 1300)).toBe(true);
      const resized = store.getById(room.id);
      expect(resized?.widthMm).toBe(2794);
      expect(resized?.depthMm).toBe(2032);
    });

    it('can shrink down to the containers limit and grow as usual', () => {
      const { store, room } = storeWithRoom();
      store.addContainer(room.id, box('A', 0, 0));
      store.resize(room.id, 2000, 1500);
      expect(store.getById(room.id)?.widthMm).toBe(2000);
      expect(store.getById(room.id)?.depthMm).toBe(1500);
      store.resize(room.id, 6000, 5000);
      expect(store.getById(room.id)?.widthMm).toBe(6000);
    });

    it('keeps the containers when resizing', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 0, 0);
      store.addContainer(room.id, container);
      store.resize(room.id, 5000, 4000);
      expect(store.getById(room.id)?.containers).toEqual([container]);
    });
  });

  it('uses the footprint of the container type', () => {
    // A container at the exact bottom-right corner fits; one millimeter more does not.
    const { store, room } = storeWithRoom();
    expect(store.addContainer(room.id, box('Fits', room.widthMm - W, room.depthMm - D))).toBe(true);
  });
});
