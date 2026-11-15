import { vi } from 'vitest';
import { createContainer, TOUGH_BOX_27_GAL } from './container.model';
import { createItem, Item, ItemDraft } from './item.model';
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

  describe('loading the rotation', () => {
    function loadWith(rotation: Record<string, unknown>) {
      const { rotation: _ignored, ...saved } = box('Saved', 100, 100);
      localStorage.setItem(
        ROOMS_STORAGE_KEY,
        JSON.stringify([
          {
            id: 'r',
            name: 'R',
            widthMm: 3658,
            depthMm: 3048,
            containers: [{ ...saved, id: 'c', ...rotation }],
          },
        ]),
      );
      return new RoomStore().getById('r')?.containers ?? [];
    }

    it('uses 0 when the saved container has no rotation', () => {
      const containers = loadWith({});
      expect(containers.length).toBe(1);
      expect(containers[0].rotation).toBe(0);
    });

    it('keeps a saved rotation of 0 or 90', () => {
      expect(loadWith({ rotation: 0 })[0].rotation).toBe(0);
      expect(loadWith({ rotation: 90 })[0].rotation).toBe(90);
    });

    it('keeps the container with rotation 0 when the saved rotation is not valid', () => {
      for (const rotation of [45, '90', null, 180, -90, true, {}]) {
        const containers = loadWith({ rotation });
        expect(containers.length).toBe(1);
        expect(containers[0]).toMatchObject({ id: 'c', name: 'Saved', xMm: 100, yMm: 100 });
        expect(containers[0].rotation).toBe(0);
      }
    });
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

  describe('moveContainer', () => {
    it('moves a container and saves it', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 0, 0);
      store.addContainer(room.id, container);
      expect(store.moveContainer(room.id, container.id, 1600, 1245)).toBe(true);
      expect(store.getById(room.id)?.containers[0]).toEqual({ ...container, xMm: 1600, yMm: 1245 });
      expect(new RoomStore().getById(room.id)?.containers[0]).toMatchObject({
        xMm: 1600,
        yMm: 1245,
      });
    });

    it('keeps the storage key and the other fields of the container', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 0, 0);
      store.addContainer(room.id, container);
      store.moveContainer(room.id, container.id, 500, 500);
      const saved = JSON.parse(localStorage.getItem('sorterhome.rooms.v1') ?? '[]');
      expect(saved[0].containers[0]).toEqual({ ...container, xMm: 500, yMm: 500 });
    });

    it('allows moving over its own old place', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 500, 500);
      store.addContainer(room.id, container);
      expect(store.moveContainer(room.id, container.id, 600, 500)).toBe(true);
      expect(store.getById(room.id)?.containers[0].xMm).toBe(600);
    });

    it('allows the container to touch the walls and other containers', () => {
      const { store, room } = storeWithRoom();
      const a = box('A', 0, 0);
      const b = box('B', 2000, 0);
      store.addContainer(room.id, a);
      store.addContainer(room.id, b);
      expect(store.moveContainer(room.id, b.id, W, 0)).toBe(true);
      expect(store.moveContainer(room.id, b.id, room.widthMm - W, room.depthMm - D)).toBe(true);
    });

    it('does nothing (and returns true) when the place did not change', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 100, 100);
      store.addContainer(room.id, container);
      const before = store.getById(room.id);
      expect(store.moveContainer(room.id, container.id, 100, 100)).toBe(true);
      expect(store.getById(room.id)).toBe(before);
    });

    it('rejects a place that overlaps another container, and changes nothing', () => {
      const { store, room } = storeWithRoom();
      const a = box('A', 0, 0);
      const b = box('B', 2000, 0);
      store.addContainer(room.id, a);
      store.addContainer(room.id, b);
      const before = store.getById(room.id);
      expect(store.moveContainer(room.id, b.id, 100, 100)).toBe(false);
      expect(store.getById(room.id)).toBe(before);
    });

    it('rejects a place that leaves the room on any side', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 1000, 1000);
      store.addContainer(room.id, container);
      expect(store.moveContainer(room.id, container.id, -1, 1000)).toBe(false);
      expect(store.moveContainer(room.id, container.id, 1000, -1)).toBe(false);
      expect(store.moveContainer(room.id, container.id, room.widthMm - W + 1, 1000)).toBe(false);
      expect(store.moveContainer(room.id, container.id, 1000, room.depthMm - D + 1)).toBe(false);
      expect(store.getById(room.id)?.containers[0]).toEqual(container);
    });

    it('uses the rotated footprint when checking the place', () => {
      const { store, room } = storeWithRoom();
      const container = { ...box('A', 1000, 1000), rotation: 90 as const }; // D wide, W deep
      store.addContainer(room.id, container);
      expect(store.moveContainer(room.id, container.id, room.widthMm - D, 1000)).toBe(true);
      expect(store.moveContainer(room.id, container.id, room.widthMm - D + 1, 1000)).toBe(false);
      expect(store.moveContainer(room.id, container.id, 1000, room.depthMm - W)).toBe(true);
      expect(store.moveContainer(room.id, container.id, 1000, room.depthMm - W + 1)).toBe(false);
    });

    it('rejects values that are not whole numbers', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 100, 100);
      store.addContainer(room.id, container);
      expect(store.moveContainer(room.id, container.id, 100.5, 100)).toBe(false);
      expect(store.moveContainer(room.id, container.id, 100, Number.NaN)).toBe(false);
      expect(store.moveContainer(room.id, container.id, Infinity, 100)).toBe(false);
      expect(store.getById(room.id)?.containers[0]).toEqual(container);
    });

    it('returns false for an unknown room or container', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 100, 100);
      store.addContainer(room.id, container);
      expect(store.moveContainer('nope', container.id, 500, 500)).toBe(false);
      expect(store.moveContainer(room.id, 'nope', 500, 500)).toBe(false);
      expect(store.getById(room.id)?.containers[0]).toEqual(container);
    });

    it('does not change the other containers', () => {
      const { store, room } = storeWithRoom();
      const a = box('A', 0, 0);
      const b = box('B', 2000, 0);
      store.addContainer(room.id, a);
      store.addContainer(room.id, b);
      store.moveContainer(room.id, b.id, 2500, 1000);
      expect(store.getById(room.id)?.containers[0]).toEqual(a);
    });
  });

  describe('rotateContainer', () => {
    it('rotates a container around its center and saves it', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 1600, 1245);
      store.addContainer(room.id, container);
      expect(store.rotateContainer(room.id, container.id)).toBe(true);
      expect(store.getById(room.id)?.containers[0]).toEqual({
        ...container,
        xMm: 1727,
        yMm: 1118,
        rotation: 90,
      });
      expect(new RoomStore().getById(room.id)?.containers[0].rotation).toBe(90);
    });

    it('rotates back to 0 on the second rotation, on the original corner', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 1600, 1245);
      store.addContainer(room.id, container);
      store.rotateContainer(room.id, container.id);
      expect(store.rotateContainer(room.id, container.id)).toBe(true);
      expect(store.getById(room.id)?.containers[0]).toEqual(container);
    });

    it('blocks the rotation and changes nothing when it would leave the room', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 1000, 0); // against the top wall
      store.addContainer(room.id, container);
      const before = store.getById(room.id);
      expect(store.rotateContainer(room.id, container.id)).toBe(false);
      expect(store.getById(room.id)).toBe(before);
    });

    it('blocks the rotation and changes nothing when it would overlap a neighbor', () => {
      const { store, room } = storeWithRoom();
      const a = box('A', 1000, 1000);
      store.addContainer(room.id, a);
      store.addContainer(room.id, box('B', 1000, 1000 + D));
      const before = store.getById(room.id);
      expect(store.rotateContainer(room.id, a.id)).toBe(false);
      expect(store.getById(room.id)).toBe(before);
    });

    it('returns false for an unknown room or container', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 1000, 1000);
      store.addContainer(room.id, container);
      expect(store.rotateContainer('nope', container.id)).toBe(false);
      expect(store.rotateContainer(room.id, 'nope')).toBe(false);
      expect(store.getById(room.id)?.containers[0]).toEqual(container);
    });

    it('makes the room unable to shrink under the rotated footprint', () => {
      const { store, room } = storeWithRoom();
      const container = box('A', 1600, 1245);
      store.addContainer(room.id, container);
      store.rotateContainer(room.id, container.id); // now x 1727..2248 mm, y 1118..1893 mm
      store.resize(room.id, 1300, 1300);
      // 2248 mm = 88.5 in -> 89 in = 2261 mm. 1893 mm = 74.5 in -> 75 in = 1905 mm.
      expect(store.getById(room.id)?.widthMm).toBe(2261);
      expect(store.getById(room.id)?.depthMm).toBe(1905);
    });
  });

  describe('stacks', () => {
    /** A room with container A, and container B put on top of it with the store. */
    function twoStacked() {
      const { store, room } = storeWithRoom();
      const a = box('A', 1016, 1016);
      const b = box('B', 2500, 2000);
      store.addContainer(room.id, a);
      expect(store.addContainerOnStack(room.id, b, a.id)).toBe(true);
      return { store, room, a, b };
    }

    function stackLevels(store: RoomStore, roomId: string): Record<string, number> {
      const levels: Record<string, number> = {};
      for (const c of store.getById(roomId)?.containers ?? []) {
        levels[c.name] = c.stackPosition;
      }
      return levels;
    }

    function savedRoom(containers: unknown[]) {
      localStorage.setItem(
        ROOMS_STORAGE_KEY,
        JSON.stringify([{ id: 'r', name: 'R', widthMm: 3658, depthMm: 3048, containers }]),
      );
      return new RoomStore().getById('r')?.containers ?? [];
    }

    function saved(name: string, xMm: number, yMm: number, extra: Record<string, unknown> = {}) {
      const { stackPosition: _ignored, ...container } = box(name, xMm, yMm);
      return { ...container, id: name, ...extra };
    }

    describe('loading', () => {
      it('gives level 0 to saved containers that have no stack position', () => {
        const containers = savedRoom([saved('A', 100, 100), saved('B', 2000, 100)]);
        expect(containers.map((c) => c.stackPosition)).toEqual([0, 0]);
      });

      it('keeps the container, with level 0, when the stack position is not valid', () => {
        for (const stackPosition of [-1, 1.5, '2', null, {}, true]) {
          const containers = savedRoom([saved('A', 100, 100, { stackPosition })]);
          expect(containers.length).toBe(1);
          expect(containers[0]).toMatchObject({ id: 'A', xMm: 100, yMm: 100, stackPosition: 0 });
        }
      });

      it('makes a stack of saved containers that sit exactly on top of each other, first at the bottom', () => {
        const containers = savedRoom([
          saved('A', 100, 100),
          saved('B', 100, 100),
          saved('C', 100, 100),
        ]);
        expect(containers.map((c) => [c.id, c.stackPosition])).toEqual([
          ['A', 0],
          ['B', 1],
          ['C', 2],
        ]);
      });

      it('uses the saved stack position before the saved order, and closes the gaps', () => {
        const containers = savedRoom([
          saved('A', 100, 100, { stackPosition: 7 }),
          saved('B', 100, 100, { stackPosition: 2 }),
          saved('C', 100, 100, { stackPosition: 2 }),
        ]);
        expect(containers.map((c) => [c.id, c.stackPosition])).toEqual([
          ['A', 2],
          ['B', 0],
          ['C', 1],
        ]);
      });

      it('does not make stacks of partial overlaps or of other rotations, and keeps them as saved', () => {
        const containers = savedRoom([
          saved('A', 100, 100),
          saved('B', 150, 100),
          saved('C', 100, 100, { rotation: 90 }),
        ]);
        expect(containers.map((c) => [c.xMm, c.yMm, c.rotation, c.stackPosition])).toEqual([
          [100, 100, 0, 0],
          [150, 100, 0, 0],
          [100, 100, 90, 0],
        ]);
      });

      it('keeps the storage key and the saved stack positions after a reload', () => {
        const { store, room, a } = twoStacked();
        const again = new RoomStore().getById(room.id)?.containers ?? [];
        expect(again.map((c) => [c.name, c.stackPosition])).toEqual([
          ['A', 0],
          ['B', 1],
        ]);
        expect(again[1]).toMatchObject({ xMm: a.xMm, yMm: a.yMm });
        expect(JSON.parse(localStorage.getItem(ROOMS_STORAGE_KEY) ?? '[]')[0].containers[1]).toMatchObject({
          stackPosition: 1,
        });
        expect(store.getById(room.id)?.containers.length).toBe(2);
      });
    });

    describe('addContainerOnStack', () => {
      it('adds the container on top, with the position and rotation of the stack', () => {
        const { store, room } = storeWithRoom();
        const a = box('A', 1016, 1016);
        store.addContainer(room.id, a);
        store.rotateContainer(room.id, a.id);
        const turned = store.getById(room.id)!.containers[0];
        const b = box('B', 0, 0);
        expect(store.addContainerOnStack(room.id, b, a.id)).toBe(true);
        expect(store.getById(room.id)!.containers[1]).toMatchObject({
          name: 'B',
          xMm: turned.xMm,
          yMm: turned.yMm,
          rotation: 90,
          stackPosition: 1,
        });
      });

      it('goes to the top of a stack of several containers, also when the target is a lower one', () => {
        const { store, room, a } = twoStacked();
        expect(store.addContainerOnStack(room.id, box('C', 0, 0), a.id)).toBe(true);
        expect(stackLevels(store, room.id)).toEqual({ A: 0, B: 1, C: 2 });
      });

      it('rejects an unknown room or target, a repeated id and an invalid name, and changes nothing', () => {
        const { store, room, a } = twoStacked();
        const before = store.getById(room.id);
        expect(store.addContainerOnStack('nope', box('C', 0, 0), a.id)).toBe(false);
        expect(store.addContainerOnStack(room.id, box('C', 0, 0), 'nope')).toBe(false);
        expect(store.addContainerOnStack(room.id, { ...box('C', 0, 0), id: a.id }, a.id)).toBe(false);
        expect(store.addContainerOnStack(room.id, { ...box('C', 0, 0), name: '  ' }, a.id)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('rejects a stack whose place is not valid (saved outside the room)', () => {
        localStorage.setItem(
          ROOMS_STORAGE_KEY,
          JSON.stringify([
            {
              id: 'r',
              name: 'R',
              widthMm: 3658,
              depthMm: 3048,
              containers: [saved('Out', 3600, 100)],
            },
          ]),
        );
        const store = new RoomStore();
        const before = store.getById('r');
        expect(store.addContainerOnStack('r', box('C', 0, 0), 'Out')).toBe(false);
        expect(store.getById('r')).toBe(before);
      });
    });

    describe('stackContainer', () => {
      it('puts a container that is alone on top of a stack, with its position and rotation', () => {
        const { store, room, a } = twoStacked();
        store.rotateContainer(room.id, a.id);
        const c = box('C', 100, 100);
        store.addContainer(room.id, c);
        expect(store.stackContainer(room.id, c.id, a.id)).toBe(true);
        const turned = store.getById(room.id)!.containers[0];
        expect(store.getById(room.id)!.containers.find((x) => x.name === 'C')).toMatchObject({
          xMm: turned.xMm,
          yMm: turned.yMm,
          rotation: 90,
          stackPosition: 2,
        });
      });

      it('saves the result', () => {
        const { store, room, a } = twoStacked();
        const c = box('C', 100, 100);
        store.addContainer(room.id, c);
        store.stackContainer(room.id, c.id, a.id);
        const again = new RoomStore().getById(room.id)!.containers;
        expect(again.map((x) => x.stackPosition)).toEqual([0, 1, 2]);
      });

      it('does not stack a container that is in a stack with others', () => {
        const { store, room, a, b } = twoStacked();
        const c = box('C', 100, 100);
        store.addContainer(room.id, c);
        const before = store.getById(room.id);
        expect(store.stackContainer(room.id, b.id, c.id)).toBe(false);
        expect(store.stackContainer(room.id, a.id, c.id)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('does not stack a container on itself or on its own stack', () => {
        const { store, room, a, b } = twoStacked();
        const before = store.getById(room.id);
        expect(store.stackContainer(room.id, a.id, a.id)).toBe(false);
        expect(store.stackContainer(room.id, a.id, b.id)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('rejects unknown ids and changes nothing', () => {
        const { store, room, a } = twoStacked();
        const before = store.getById(room.id);
        expect(store.stackContainer('nope', a.id, a.id)).toBe(false);
        expect(store.stackContainer(room.id, 'nope', a.id)).toBe(false);
        expect(store.stackContainer(room.id, a.id, 'nope')).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });
    });

    describe('unstackContainer', () => {
      it('puts the container in the first free spot, alone, and keeps its rotation', () => {
        const { store, room, a, b } = twoStacked();
        store.rotateContainer(room.id, a.id);
        expect(store.unstackContainer(room.id, b.id)).toBe(true);
        const left = store.getById(room.id)!.containers.find((c) => c.id === b.id)!;
        expect(left).toMatchObject({ xMm: 0, yMm: 0, rotation: 90, stackPosition: 0 });
        expect(store.getById(room.id)!.containers.find((c) => c.id === a.id)!.stackPosition).toBe(0);
      });

      it('closes the gap in the stack it leaves', () => {
        const { store, room, a } = twoStacked();
        store.addContainerOnStack(room.id, box('C', 0, 0), a.id);
        expect(store.unstackContainer(room.id, a.id)).toBe(true); // the bottom one leaves
        expect(stackLevels(store, room.id)).toEqual({ A: 0, B: 0, C: 1 });
      });

      it('shows no free space: returns false and changes nothing', () => {
        const { store, room, a, b } = twoStacked();
        store.moveContainer(room.id, a.id, 0, 0);
        store.addContainer(room.id, box('Under', 0, D));
        store.resize(room.id, 1219, 1219); // 4 ft x 4 ft: the stack and the box under it fill it
        const before = store.getById(room.id);
        expect(store.unstackContainer(room.id, b.id)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('does nothing for a container that is alone, or an unknown id', () => {
        const { store, room } = storeWithRoom();
        const a = box('A', 100, 100);
        store.addContainer(room.id, a);
        const before = store.getById(room.id);
        expect(store.unstackContainer(room.id, a.id)).toBe(false);
        expect(store.unstackContainer(room.id, 'nope')).toBe(false);
        expect(store.unstackContainer('nope', a.id)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });
    });

    describe('moveInStack', () => {
      it('swaps the container with the one above or below, and saves it', () => {
        const { store, room, a, b } = twoStacked();
        expect(store.moveInStack(room.id, a.id, 'up')).toBe(true);
        expect(stackLevels(store, room.id)).toEqual({ A: 1, B: 0 });
        expect(store.moveInStack(room.id, a.id, 'down')).toBe(true);
        expect(stackLevels(store, room.id)).toEqual({ A: 0, B: 1 });
        store.moveInStack(room.id, b.id, 'down');
        expect(new RoomStore().getById(room.id)!.containers.map((c) => c.stackPosition)).toEqual([
          1, 0,
        ]);
      });

      it('returns false, and changes nothing, at the ends, for a container alone and for unknown ids', () => {
        const { store, room, a, b } = twoStacked();
        const lone = box('Lone', 100, 100);
        store.addContainer(room.id, lone);
        const before = store.getById(room.id);
        expect(store.moveInStack(room.id, b.id, 'up')).toBe(false);
        expect(store.moveInStack(room.id, a.id, 'down')).toBe(false);
        expect(store.moveInStack(room.id, lone.id, 'up')).toBe(false);
        expect(store.moveInStack(room.id, 'nope', 'up')).toBe(false);
        expect(store.moveInStack('nope', a.id, 'up')).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });
    });

    describe('moving, rotating and removing', () => {
      it('moves the whole stack: all its containers share the new position', () => {
        const { store, room, a, b } = twoStacked();
        expect(store.moveContainer(room.id, b.id, 2000, 1500)).toBe(true); // moves from the top one
        const containers = store.getById(room.id)!.containers;
        expect(containers.map((c) => [c.xMm, c.yMm, c.stackPosition])).toEqual([
          [2000, 1500, 0],
          [2000, 1500, 1],
        ]);
        expect(a.id).toBe(containers[0].id);
      });

      it('can move the stack over its own old place, and rejects a place over another container', () => {
        const { store, room, a } = twoStacked();
        const other = box('Other', 2500, 200);
        store.addContainer(room.id, other);
        expect(store.moveContainer(room.id, a.id, 1116, 1016)).toBe(true);
        const before = store.getById(room.id);
        expect(store.moveContainer(room.id, a.id, 2600, 200)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('rejects a place for the stack that is outside the room, and changes nothing', () => {
        const { store, room, a } = twoStacked();
        const before = store.getById(room.id);
        expect(store.moveContainer(room.id, a.id, -1, 0)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('rotates the whole stack around the center of its footprint', () => {
        const { store, room, a } = twoStacked();
        expect(store.rotateContainer(room.id, a.id)).toBe(true);
        const containers = store.getById(room.id)!.containers;
        // 1016 mm = 40 in on both axes: the corner goes 127 mm right and 127 mm up.
        expect(containers.map((c) => [c.xMm, c.yMm, c.rotation, c.stackPosition])).toEqual([
          [1143, 889, 90, 0],
          [1143, 889, 90, 1],
        ]);
      });

      it('blocks the rotation of a stack that does not fit, and changes nothing', () => {
        const { store, room, a } = twoStacked();
        store.moveContainer(room.id, a.id, 1016, 0); // against the top wall
        const before = store.getById(room.id);
        expect(store.rotateContainer(room.id, a.id)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('blocks the rotation of a stack that would overlap a neighbor', () => {
        const { store, room, a } = twoStacked();
        store.addContainer(room.id, box('Under', 1016, 1016 + D));
        const before = store.getById(room.id);
        expect(store.rotateContainer(room.id, a.id)).toBe(false);
        expect(store.getById(room.id)).toBe(before);
      });

      it('closes the gap when a container in the middle of a stack is removed', () => {
        const { store, room, a, b } = twoStacked();
        store.addContainerOnStack(room.id, box('C', 0, 0), a.id);
        expect(store.removeContainer(room.id, b.id)).toBe(true);
        expect(stackLevels(store, room.id)).toEqual({ A: 0, C: 1 });
      });

      it('removing the bottom or the top container keeps the levels from 0 with no gap', () => {
        const { store, room, a, b } = twoStacked();
        const c = box('C', 0, 0);
        store.addContainerOnStack(room.id, c, a.id);
        store.removeContainer(room.id, a.id);
        expect(stackLevels(store, room.id)).toEqual({ B: 0, C: 1 });
        store.removeContainer(room.id, c.id);
        expect(stackLevels(store, room.id)).toEqual({ B: 0 });
        expect(b.id).toBe(store.getById(room.id)!.containers[0].id);
      });

      it('does not let the room shrink under the footprint of a stack, which is one footprint', () => {
        const { store, room } = twoStacked();
        store.moveContainer(room.id, store.getById(room.id)!.containers[0].id, 2000, 1500);
        store.resize(room.id, 1300, 1300);
        // The same limit as for one container at 2000, 1500: 2794 x 2032 mm.
        expect(store.getById(room.id)?.widthMm).toBe(2794);
        expect(store.getById(room.id)?.depthMm).toBe(2032);
      });
    });
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

describe('RoomStore items', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function box(name: string, xMm: number, yMm: number) {
    return createContainer(TOUGH_BOX_27_GAL.id, name, xMm, yMm);
  }

  /** A store with one room and two containers, "Toys" and "Books", far from each other. */
  function storeWithContainers() {
    const store = new RoomStore();
    const room = createRoom('Garage'); // 3658 x 3048 mm
    store.add(room);
    const toys = box('Toys', 0, 0);
    const books = box('Books', 2000, 0);
    store.addContainer(room.id, toys);
    store.addContainer(room.id, books);
    return { store, room, toys, books };
  }

  function item(name: string, values: Partial<ItemDraft> = {}): Item {
    return createItem({ name, quantity: 1, description: '', category: '', ...values });
  }

  function itemsOf(store: RoomStore, roomId: string, containerId: string): Item[] {
    return store.getById(roomId)?.containers.find((c) => c.id === containerId)?.items ?? [];
  }

  describe('addItem', () => {
    it('adds an item to its container and to no other', () => {
      const { store, room, toys, books } = storeWithContainers();
      const nails = item('Nails', { quantity: 100, description: 'Box of 100', category: 'Hardware' });
      expect(store.addItem(room.id, toys.id, nails)).toBe(true);
      expect(itemsOf(store, room.id, toys.id)).toEqual([nails]);
      expect(itemsOf(store, room.id, books.id)).toEqual([]);
    });

    it('keeps the items in the order they were added', () => {
      const { store, room, toys } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Nails'));
      store.addItem(room.id, toys.id, item('Cables'));
      store.addItem(room.id, toys.id, item('Batteries'));
      expect(itemsOf(store, room.id, toys.id).map((i) => i.name)).toEqual([
        'Nails',
        'Cables',
        'Batteries',
      ]);
    });

    it('allows two items with the same name in one container', () => {
      const { store, room, toys } = storeWithContainers();
      expect(store.addItem(room.id, toys.id, item('Cable', { description: 'USB-C' }))).toBe(true);
      expect(store.addItem(room.id, toys.id, item('Cable', { description: 'HDMI' }))).toBe(true);
      expect(itemsOf(store, room.id, toys.id).length).toBe(2);
    });

    it('accepts the quantities 0 and 9999', () => {
      const { store, room, toys } = storeWithContainers();
      expect(store.addItem(room.id, toys.id, item('Empty', { quantity: 0 }))).toBe(true);
      expect(store.addItem(room.id, toys.id, item('Many', { quantity: 9999 }))).toBe(true);
    });

    it('saves the name and the description trimmed and the category cleaned, whatever it receives', () => {
      const { store, room, toys } = storeWithContainers();
      const raw: Item = {
        id: 'item-1',
        name: '  Nails ',
        quantity: 5,
        description: ' Line 1\nLine 2 ',
        category: '  Power   tools ',
      };
      expect(store.addItem(room.id, toys.id, raw)).toBe(true);
      expect(itemsOf(store, room.id, toys.id)).toEqual([
        { id: 'item-1', name: 'Nails', quantity: 5, description: 'Line 1\nLine 2', category: 'Power tools' },
      ]);
    });

    it('saves only the fields of an item', () => {
      const { store, room, toys } = storeWithContainers();
      const withExtra = { ...item('Nails'), extra: 'not a field' } as Item;
      store.addItem(room.id, toys.id, withExtra);
      expect(itemsOf(store, room.id, toys.id)[0]).not.toHaveProperty('extra');
    });

    it('saves the item in the browser storage: a new store finds it', () => {
      const { store, room, toys } = storeWithContainers();
      const nails = item('Nails', { quantity: 100, description: 'Box of 100', category: 'Hardware' });
      store.addItem(room.id, toys.id, nails);
      expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual([nails]);
    });

    describe('when it fails, it returns false and changes nothing', () => {
      function expectNothingChanged(
        attempt: (ctx: ReturnType<typeof storeWithContainers>) => boolean,
      ): void {
        const ctx = storeWithContainers();
        ctx.store.addItem(ctx.room.id, ctx.toys.id, { ...item('Existing'), id: 'existing' });
        const roomsBefore = ctx.store.rooms();
        const savedBefore = localStorage.getItem(ROOMS_STORAGE_KEY);
        expect(attempt(ctx)).toBe(false);
        expect(ctx.store.rooms()).toBe(roomsBefore);
        expect(localStorage.getItem(ROOMS_STORAGE_KEY)).toBe(savedBefore);
      }

      it('unknown room', () => {
        expectNothingChanged(({ store, toys }) => store.addItem('nope', toys.id, item('Nails')));
      });

      it('unknown container', () => {
        expectNothingChanged(({ store, room }) => store.addItem(room.id, 'nope', item('Nails')));
      });

      it('a container of another room', () => {
        const { store, toys } = storeWithContainers();
        const attic = createRoom('Attic');
        store.add(attic);
        const roomsBefore = store.rooms();
        expect(store.addItem(attic.id, toys.id, item('Nails'))).toBe(false);
        expect(store.rooms()).toBe(roomsBefore);
      });

      it('name empty or too long', () => {
        expectNothingChanged(({ store, room, toys }) =>
          store.addItem(room.id, toys.id, { ...item('Nails'), name: '   ' }),
        );
        expectNothingChanged(({ store, room, toys }) =>
          store.addItem(room.id, toys.id, { ...item('Nails'), name: 'a'.repeat(61) }),
        );
      });

      it('quantity that is not a whole number from 0 to 9999', () => {
        for (const quantity of [-1, 10000, 1.5, Number.NaN, '3' as unknown as number]) {
          expectNothingChanged(({ store, room, toys }) =>
            store.addItem(room.id, toys.id, { ...item('Nails'), quantity }),
          );
        }
      });

      it('description or category too long', () => {
        expectNothingChanged(({ store, room, toys }) =>
          store.addItem(room.id, toys.id, { ...item('Nails'), description: 'a'.repeat(501) }),
        );
        expectNothingChanged(({ store, room, toys }) =>
          store.addItem(room.id, toys.id, { ...item('Nails'), category: 'a'.repeat(41) }),
        );
      });

      it('id missing', () => {
        expectNothingChanged(({ store, room, toys }) =>
          store.addItem(room.id, toys.id, { ...item('Nails'), id: '' }),
        );
      });

      it('id already used, in the same container or in another one', () => {
        expectNothingChanged(({ store, room, toys }) =>
          store.addItem(room.id, toys.id, { ...item('Nails'), id: 'existing' }),
        );
        expectNothingChanged(({ store, room, books }) =>
          store.addItem(room.id, books.id, { ...item('Nails'), id: 'existing' }),
        );
      });
    });
  });

  describe('categories', () => {
    it('is empty when no item has a category', () => {
      const { store, room, toys } = storeWithContainers();
      expect(store.categories()).toEqual([]);
      store.addItem(room.id, toys.id, item('Nails'));
      expect(store.categories()).toEqual([]);
    });

    it('lists the categories in use, without repeats and in alphabetical order', () => {
      const { store, room, toys, books } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Nails', { category: 'Tools' }));
      store.addItem(room.id, books.id, item('Novel', { category: 'books' }));
      store.addItem(room.id, books.id, item('Hammer', { category: 'Tools' }));
      expect(store.categories()).toEqual(['books', 'Tools']);
    });

    it('is global across rooms', () => {
      const { store, room, toys } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Nails', { category: 'Tools' }));
      const attic = createRoom('Attic');
      store.add(attic);
      const lights = box('Lights', 0, 0);
      store.addContainer(attic.id, lights);
      store.addItem(attic.id, lights.id, item('Tree', { category: 'Navidad' }));
      expect(store.categories()).toEqual(['Navidad', 'Tools']);
    });

    it('reuses the spelling of the existing category, ignoring case, accents and repeated spaces', () => {
      const { store, room, toys, books } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Hose', { category: 'Jardín' }));
      store.addItem(room.id, toys.id, item('Drill', { category: 'Power tools' }));

      store.addItem(room.id, books.id, item('Gloves', { category: 'jardin' }));
      store.addItem(room.id, books.id, item('Rake', { category: 'JARDIN' }));
      store.addItem(room.id, books.id, item('Saw', { category: ' power   TOOLS ' }));
      expect(itemsOf(store, room.id, books.id).map((i) => i.category)).toEqual([
        'Jardín',
        'Jardín',
        'Power tools',
      ]);
      expect(store.categories()).toEqual(['Jardín', 'Power tools']);
    });

    it('reuses the spelling of a category that is used in another room', () => {
      const { store, room, toys } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Tree', { category: 'Navidad' }));
      const attic = createRoom('Attic');
      store.add(attic);
      const lights = box('Lights', 0, 0);
      store.addContainer(attic.id, lights);
      store.addItem(attic.id, lights.id, item('Lights', { category: 'navidad' }));
      expect(itemsOf(store, attic.id, lights.id)[0].category).toBe('Navidad');
    });

    it('stops listing a category when the container of its last item is deleted', () => {
      const { store, room, toys, books } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Nails', { category: 'Tools' }));
      store.addItem(room.id, books.id, item('Novel', { category: 'Books' }));
      store.removeContainer(room.id, toys.id);
      expect(store.categories()).toEqual(['Books']);
      // The spelling is free again: the next item decides it.
      store.addItem(room.id, books.id, item('Hammer', { category: 'TOOLS' }));
      expect(store.categories()).toEqual(['Books', 'TOOLS']);
    });

    it('stops listing the categories of a room that is deleted', () => {
      const { store, room, toys } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Nails', { category: 'Tools' }));
      store.remove(room.id);
      expect(store.categories()).toEqual([]);
    });

    it('stops listing a category when its last item is removed', () => {
      const { store, room, toys } = storeWithContainers();
      const nails = item('Nails', { category: 'Tools' });
      const hammer = item('Hammer', { category: 'Tools' });
      store.addItem(room.id, toys.id, nails);
      store.addItem(room.id, toys.id, hammer);
      store.removeItem(room.id, toys.id, nails.id);
      expect(store.categories()).toEqual(['Tools']); // another item still uses it
      store.removeItem(room.id, toys.id, hammer.id);
      expect(store.categories()).toEqual([]);
    });

    it('stops listing a category when its last item changes to another category', () => {
      const { store, room, toys } = storeWithContainers();
      const nails = item('Nails', { category: 'Tools' });
      store.addItem(room.id, toys.id, nails);
      store.updateItem(room.id, toys.id, nails.id, { ...nails, category: 'Hardware' });
      expect(store.categories()).toEqual(['Hardware']);
      store.updateItem(room.id, toys.id, nails.id, { ...nails, category: '' });
      expect(store.categories()).toEqual([]);
    });
  });

  describe('updateItem', () => {
    /** A store with the items "Nails", "Cables" and "Batteries" (added in that order) in "Toys". */
    function storeWithItems() {
      const ctx = storeWithContainers();
      const nails = item('Nails', { quantity: 100, description: 'Box of 100', category: 'Hardware' });
      const cables = item('Cables');
      const batteries = item('Batteries');
      for (const added of [nails, cables, batteries]) {
        ctx.store.addItem(ctx.room.id, ctx.toys.id, added);
      }
      return { ...ctx, nails, cables, batteries };
    }

    it('changes the name, the quantity, the description and the category', () => {
      const { store, room, toys, cables } = storeWithItems();
      const draft: ItemDraft = {
        name: 'USB cables',
        quantity: 7,
        description: 'USB-C\n2 m',
        category: 'Electronics',
      };
      expect(store.updateItem(room.id, toys.id, cables.id, draft)).toBe(true);
      expect(itemsOf(store, room.id, toys.id)[1]).toEqual({ id: cables.id, ...draft });
    });

    it('keeps the id and the place of the item in the stored order, and the other items', () => {
      const { store, room, toys, nails, cables, batteries } = storeWithItems();
      store.updateItem(room.id, toys.id, cables.id, { ...cables, name: 'Zip ties' });
      expect(itemsOf(store, room.id, toys.id)).toEqual([
        nails,
        { ...cables, name: 'Zip ties' },
        batteries,
      ]);
    });

    it('accepts the quantities 0 and 9999', () => {
      const { store, room, toys, cables } = storeWithItems();
      expect(store.updateItem(room.id, toys.id, cables.id, { ...cables, quantity: 0 })).toBe(true);
      expect(itemsOf(store, room.id, toys.id)[1].quantity).toBe(0);
      expect(store.updateItem(room.id, toys.id, cables.id, { ...cables, quantity: 9999 })).toBe(true);
      expect(itemsOf(store, room.id, toys.id)[1].quantity).toBe(9999);
    });

    it('saves the name and the description trimmed and the category cleaned', () => {
      const { store, room, toys, cables } = storeWithItems();
      store.updateItem(room.id, toys.id, cables.id, {
        name: '  Cords ',
        quantity: 2,
        description: ' Line 1\nLine 2 ',
        category: '  Power   tools ',
      });
      expect(itemsOf(store, room.id, toys.id)[1]).toEqual({
        id: cables.id,
        name: 'Cords',
        quantity: 2,
        description: 'Line 1\nLine 2',
        category: 'Power tools',
      });
    });

    it('saves only the fields of an item, and never changes the id', () => {
      const { store, room, toys, cables } = storeWithItems();
      const draft = { ...cables, id: 'another-id', name: 'Cords', extra: 'not a field' } as ItemDraft;
      store.updateItem(room.id, toys.id, cables.id, draft);
      const saved = itemsOf(store, room.id, toys.id)[1];
      expect(saved.id).toBe(cables.id);
      expect(saved).not.toHaveProperty('extra');
    });

    it('allows the same name as another item of the container', () => {
      const { store, room, toys, cables } = storeWithItems();
      expect(store.updateItem(room.id, toys.id, cables.id, { ...cables, name: 'Nails' })).toBe(true);
      expect(itemsOf(store, room.id, toys.id).map((i) => i.name)).toEqual([
        'Nails',
        'Nails',
        'Batteries',
      ]);
    });

    it('saves the change in the browser storage: a new store finds it', () => {
      const { store, room, toys, cables } = storeWithItems();
      store.updateItem(room.id, toys.id, cables.id, { ...cables, quantity: 3 });
      expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual(itemsOf(store, room.id, toys.id));
      expect(itemsOf(new RoomStore(), room.id, toys.id)[1].quantity).toBe(3);
    });

    it('returns true and writes nothing when nothing changed', () => {
      const { store, room, toys, nails } = storeWithItems();
      const roomsBefore = store.rooms();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      try {
        expect(store.updateItem(room.id, toys.id, nails.id, { ...nails })).toBe(true);
        // Spaces that are trimmed away are not a change either.
        expect(
          store.updateItem(room.id, toys.id, nails.id, {
            ...nails,
            name: ' Nails ',
            description: ' Box of 100 ',
            category: ' Hardware ',
          }),
        ).toBe(true);
        expect(setItem).not.toHaveBeenCalled();
      } finally {
        setItem.mockRestore();
      }
      expect(store.rooms()).toBe(roomsBefore);
    });

    describe('category', () => {
      it('reuses the spelling of another item, in any room, ignoring case, accents and spaces', () => {
        const { store, room, toys, books, cables } = storeWithItems();
        store.addItem(room.id, books.id, item('Hose', { category: 'Jardín' }));
        store.updateItem(room.id, toys.id, cables.id, { ...cables, category: ' JARDIN ' });
        expect(itemsOf(store, room.id, toys.id)[1].category).toBe('Jardín');
        expect(store.categories()).toEqual(['Hardware', 'Jardín']);
      });

      it('cannot change the spelling of a category that other items use, and does not change them', () => {
        const { store, room, toys, books, cables } = storeWithItems();
        const hose = item('Hose', { category: 'Jardín' });
        store.addItem(room.id, books.id, hose);
        store.updateItem(room.id, toys.id, cables.id, { ...cables, category: 'Jardín' });

        store.updateItem(room.id, toys.id, cables.id, { ...cables, category: 'jardin' });
        expect(itemsOf(store, room.id, toys.id)[1].category).toBe('Jardín');
        expect(itemsOf(store, room.id, books.id)).toEqual([hose]);
      });

      it('changes the spelling when the item is the only one with that category', () => {
        const { store, room, toys, nails } = storeWithItems();
        // "Hardware" is only used by "Nails": the new spelling is saved.
        expect(store.updateItem(room.id, toys.id, nails.id, { ...nails, category: 'HARDWARE' })).toBe(
          true,
        );
        expect(itemsOf(store, room.id, toys.id)[0].category).toBe('HARDWARE');
        expect(store.categories()).toEqual(['HARDWARE']);
      });

      it('removes the category of the item when it is left empty', () => {
        const { store, room, toys, nails } = storeWithItems();
        store.updateItem(room.id, toys.id, nails.id, { ...nails, category: '   ' });
        expect(itemsOf(store, room.id, toys.id)[0].category).toBe('');
      });
    });

    describe('when it fails, it returns false and changes nothing', () => {
      function expectNothingChanged(
        attempt: (ctx: ReturnType<typeof storeWithItems>) => boolean,
      ): void {
        const ctx = storeWithItems();
        const roomsBefore = ctx.store.rooms();
        const savedBefore = localStorage.getItem(ROOMS_STORAGE_KEY);
        expect(attempt(ctx)).toBe(false);
        expect(ctx.store.rooms()).toBe(roomsBefore);
        expect(localStorage.getItem(ROOMS_STORAGE_KEY)).toBe(savedBefore);
      }

      it('unknown room, container or item', () => {
        expectNothingChanged(({ store, toys, nails }) =>
          store.updateItem('nope', toys.id, nails.id, { ...nails, name: 'New' }),
        );
        expectNothingChanged(({ store, room, nails }) =>
          store.updateItem(room.id, 'nope', nails.id, { ...nails, name: 'New' }),
        );
        expectNothingChanged(({ store, room, toys, nails }) =>
          store.updateItem(room.id, toys.id, 'nope', { ...nails, name: 'New' }),
        );
      });

      it('an item of another container', () => {
        expectNothingChanged(({ store, room, books, nails }) =>
          store.updateItem(room.id, books.id, nails.id, { ...nails, name: 'New' }),
        );
      });

      it('name empty or too long', () => {
        expectNothingChanged(({ store, room, toys, nails }) =>
          store.updateItem(room.id, toys.id, nails.id, { ...nails, name: '   ' }),
        );
        expectNothingChanged(({ store, room, toys, nails }) =>
          store.updateItem(room.id, toys.id, nails.id, { ...nails, name: 'a'.repeat(61) }),
        );
      });

      it('quantity that is not a whole number from 0 to 9999', () => {
        for (const quantity of [-1, 10000, 1.5, Number.NaN, '3' as unknown as number]) {
          expectNothingChanged(({ store, room, toys, nails }) =>
            store.updateItem(room.id, toys.id, nails.id, { ...nails, quantity }),
          );
        }
      });

      it('description or category too long', () => {
        expectNothingChanged(({ store, room, toys, nails }) =>
          store.updateItem(room.id, toys.id, nails.id, { ...nails, description: 'a'.repeat(501) }),
        );
        expectNothingChanged(({ store, room, toys, nails }) =>
          store.updateItem(room.id, toys.id, nails.id, { ...nails, category: 'a'.repeat(41) }),
        );
      });
    });
  });

  describe('removeItem', () => {
    it('removes only that item and keeps the order of the others', () => {
      const { store, room, toys, books } = storeWithContainers();
      const nails = item('Nails');
      const cables = item('Cables');
      const batteries = item('Batteries');
      const novel = item('Novel');
      for (const added of [nails, cables, batteries]) {
        store.addItem(room.id, toys.id, added);
      }
      store.addItem(room.id, books.id, novel);

      expect(store.removeItem(room.id, toys.id, cables.id)).toBe(true);
      expect(itemsOf(store, room.id, toys.id)).toEqual([nails, batteries]);
      expect(itemsOf(store, room.id, books.id)).toEqual([novel]);
    });

    it('removes one of two items with the same name', () => {
      const { store, room, toys } = storeWithContainers();
      const usb = item('Cable', { description: 'USB-C' });
      const hdmi = item('Cable', { description: 'HDMI' });
      store.addItem(room.id, toys.id, usb);
      store.addItem(room.id, toys.id, hdmi);
      store.removeItem(room.id, toys.id, usb.id);
      expect(itemsOf(store, room.id, toys.id)).toEqual([hdmi]);
    });

    it('saves the change in the browser storage: a new store does not find the item', () => {
      const { store, room, toys } = storeWithContainers();
      const nails = item('Nails');
      store.addItem(room.id, toys.id, nails);
      store.removeItem(room.id, toys.id, nails.id);
      expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual([]);
    });

    it('returns false and changes nothing for an unknown room, container or item', () => {
      const { store, room, toys, books } = storeWithContainers();
      const nails = item('Nails');
      store.addItem(room.id, toys.id, nails);
      const roomsBefore = store.rooms();
      const savedBefore = localStorage.getItem(ROOMS_STORAGE_KEY);

      expect(store.removeItem('nope', toys.id, nails.id)).toBe(false);
      expect(store.removeItem(room.id, 'nope', nails.id)).toBe(false);
      expect(store.removeItem(room.id, toys.id, 'nope')).toBe(false);
      expect(store.removeItem(room.id, books.id, nails.id)).toBe(false); // another container
      expect(store.rooms()).toBe(roomsBefore);
      expect(localStorage.getItem(ROOMS_STORAGE_KEY)).toBe(savedBefore);
    });
  });

  describe('the other changes keep the items', () => {
    it('removing a container removes its items and keeps the items of the others', () => {
      const { store, room, toys, books } = storeWithContainers();
      const nails = item('Nails');
      const novel = item('Novel');
      store.addItem(room.id, toys.id, nails);
      store.addItem(room.id, books.id, novel);
      expect(store.removeContainer(room.id, toys.id)).toBe(true);
      const saved = new RoomStore().getById(room.id)?.containers ?? [];
      expect(saved.map((c) => c.name)).toEqual(['Books']);
      expect(saved[0].items).toEqual([novel]);
    });

    it('renaming, moving and rotating a container keeps its items', () => {
      const { store, room, toys } = storeWithContainers();
      const nails = item('Nails', { quantity: 100, category: 'Hardware' });
      store.addItem(room.id, toys.id, nails);
      expect(store.renameContainer(room.id, toys.id, 'Workshop')).toBe(true);
      expect(store.moveContainer(room.id, toys.id, 0, 2000)).toBe(true);
      expect(store.rotateContainer(room.id, toys.id)).toBe(true);
      expect(itemsOf(store, room.id, toys.id)).toEqual([nails]);
      expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual([nails]);
    });

    it('stacking, reordering and unstacking keeps the items of each container', () => {
      const { store, room, toys, books } = storeWithContainers();
      const nails = item('Nails');
      const novel = item('Novel');
      store.addItem(room.id, toys.id, nails);
      store.addItem(room.id, books.id, novel);

      expect(store.stackContainer(room.id, books.id, toys.id)).toBe(true);
      expect(store.moveInStack(room.id, books.id, 'down')).toBe(true);
      expect(store.moveContainer(room.id, toys.id, 1000, 1000)).toBe(true);
      expect(store.rotateContainer(room.id, books.id)).toBe(true);
      expect(store.unstackContainer(room.id, toys.id)).toBe(true);

      expect(itemsOf(store, room.id, toys.id)).toEqual([nails]);
      expect(itemsOf(store, room.id, books.id)).toEqual([novel]);
    });

    it('a new container put on a stack starts without items', () => {
      const { store, room, toys } = storeWithContainers();
      store.addItem(room.id, toys.id, item('Nails'));
      const onTop = box('Top', 0, 0);
      expect(store.addContainerOnStack(room.id, onTop, toys.id)).toBe(true);
      expect(itemsOf(store, room.id, onTop.id)).toEqual([]);
      expect(itemsOf(store, room.id, toys.id).length).toBe(1);
    });

    it('resizing and renaming the room keeps the items', () => {
      const { store, room, toys } = storeWithContainers();
      const nails = item('Nails');
      store.addItem(room.id, toys.id, nails);
      store.resize(room.id, 5000, 4000);
      store.rename(room.id, 'Attic');
      expect(itemsOf(store, room.id, toys.id)).toEqual([nails]);
    });
  });

  describe('loading', () => {
    const goodItem: Item = {
      id: 'item-1',
      name: 'Nails',
      quantity: 100,
      description: 'Box of 100\n2 in',
      category: 'Hardware',
    };

    /** Saves one room with one container that has `items`, and returns what a new store loads. */
    function load(items: unknown, containerExtra: Record<string, unknown> = {}) {
      const room = createRoom('Garage');
      const container: Record<string, unknown> = { ...box('Toys', 0, 0), ...containerExtra };
      if (items === undefined) {
        delete container['items'];
      } else {
        container['items'] = items;
      }
      localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify([{ ...room, containers: [container] }]));
      const loaded = new RoomStore().getById(room.id)?.containers ?? [];
      return { containers: loaded, items: loaded[0]?.items };
    }

    it('loads a container saved before items existed with an empty list', () => {
      const { containers, items } = load(undefined);
      expect(containers.length).toBe(1);
      expect(containers[0].name).toBe('Toys');
      expect(items).toEqual([]);
    });

    it('loads a room saved before containers existed', () => {
      const room = createRoom('Garage');
      const { containers: _containers, ...oldRoom } = room;
      localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify([oldRoom]));
      expect(new RoomStore().getById(room.id)?.containers).toEqual([]);
    });

    it('keeps the container, with an empty list, when its items are not a list', () => {
      for (const value of [null, 'items', 7, { 0: goodItem }]) {
        const { containers, items } = load(value);
        expect(containers.length).toBe(1);
        expect(items).toEqual([]);
      }
    });

    it('loads well-formed items as they are, in the saved order', () => {
      const second: Item = { id: 'item-2', name: 'Cables', quantity: 0, description: '', category: '' };
      expect(load([goodItem, second]).items).toEqual([goodItem, second]);
    });

    it('discards only the items without a usable name, and keeps the container and the other items', () => {
      const { containers, items } = load([
        goodItem,
        null,
        'Nails',
        42,
        { ...goodItem, id: 'no-name', name: undefined },
        { ...goodItem, id: 'not-text', name: 7 },
        { ...goodItem, id: 'empty', name: '   ' },
        { ...goodItem, id: 'item-2', name: 'Cables' },
      ]);
      expect(containers.length).toBe(1);
      expect(items?.map((i) => i.id)).toEqual(['item-1', 'item-2']);
    });

    it('trims a name and cuts one that is too long to 60 characters', () => {
      const { items } = load([
        { ...goodItem, id: 'a', name: '  Nails  ' },
        { ...goodItem, id: 'b', name: 'n'.repeat(80) },
        { ...goodItem, id: 'c', name: `${'n'.repeat(59)} tail` },
      ]);
      expect(items?.map((i) => i.name)).toEqual(['Nails', 'n'.repeat(60), 'n'.repeat(59)]);
    });

    it('gives a new id to an item whose id is missing or not usable, and keeps it', () => {
      const { items } = load([
        { ...goodItem, id: undefined },
        { ...goodItem, id: '' },
        { ...goodItem, id: 7 },
      ]);
      expect(items?.length).toBe(3);
      const ids = items?.map((i) => i.id) ?? [];
      expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(3);
      expect(items?.map((i) => i.name)).toEqual(['Nails', 'Nails', 'Nails']);
    });

    it('gives a new id to an item whose id is repeated, and keeps both', () => {
      const { items } = load([goodItem, { ...goodItem, name: 'Cables' }]);
      expect(items?.map((i) => i.name)).toEqual(['Nails', 'Cables']);
      expect(items?.[0].id).toBe('item-1');
      expect(items?.[1].id).not.toBe('item-1');
      expect(items?.[1].id).toBeTruthy();
    });

    it('gives a new id to an item whose id is used in another container or room', () => {
      const garage = createRoom('Garage');
      const attic = createRoom('Attic');
      localStorage.setItem(
        ROOMS_STORAGE_KEY,
        JSON.stringify([
          {
            ...garage,
            containers: [
              { ...box('A', 0, 0), items: [goodItem] },
              { ...box('B', 2000, 0), items: [goodItem] },
            ],
          },
          { ...attic, containers: [{ ...box('C', 0, 0), items: [goodItem] }] },
        ]),
      );
      const store = new RoomStore();
      const all = store.rooms().flatMap((r) => r.containers.flatMap((c) => c.items));
      expect(all.length).toBe(3);
      expect(new Set(all.map((i) => i.id)).size).toBe(3);
      expect(all[0].id).toBe('item-1');
    });

    it('rounds a quantity and keeps it from 0 to 9999', () => {
      const { items } = load([
        { ...goodItem, id: 'a', quantity: 2.6 },
        { ...goodItem, id: 'b', quantity: -5 },
        { ...goodItem, id: 'c', quantity: 123456 },
        { ...goodItem, id: 'd', quantity: 0 },
      ]);
      expect(items?.map((i) => i.quantity)).toEqual([3, 0, 9999, 0]);
    });

    it('uses the quantity 1 when the saved quantity is not a number', () => {
      const { items } = load([
        { ...goodItem, id: 'a', quantity: undefined },
        { ...goodItem, id: 'b', quantity: '5' },
        { ...goodItem, id: 'c', quantity: null },
      ]);
      expect(items?.map((i) => i.quantity)).toEqual([1, 1, 1]);
    });

    it('empties a description or category that is not text', () => {
      const { items } = load([
        { id: 'a', name: 'Nails', quantity: 1 },
        { ...goodItem, id: 'b', description: 7, category: ['Hardware'] },
      ]);
      expect(items).toEqual([
        { id: 'a', name: 'Nails', quantity: 1, description: '', category: '' },
        { id: 'b', name: 'Nails', quantity: 100, description: '', category: '' },
      ]);
    });

    it('trims a description and cuts one that is too long to 500 characters, keeping its line breaks', () => {
      const { items } = load([
        { ...goodItem, id: 'a', description: '  Line 1\nLine 2  ' },
        { ...goodItem, id: 'b', description: 'd'.repeat(600) },
      ]);
      expect(items?.[0].description).toBe('Line 1\nLine 2');
      expect(items?.[1].description).toBe('d'.repeat(500));
    });

    it('cleans a category and cuts one that is too long to 40 characters', () => {
      const { items } = load([
        { ...goodItem, id: 'a', category: '  Power   tools ' },
        { ...goodItem, id: 'b', category: 'c'.repeat(50) },
      ]);
      expect(items?.map((i) => i.category)).toEqual(['Power tools', 'c'.repeat(40)]);
    });

    it('does not rewrite the spelling of saved categories, and suggests the first spelling', () => {
      const { items } = load([
        { ...goodItem, id: 'a', category: 'Jardín' },
        { ...goodItem, id: 'b', category: 'jardin' },
      ]);
      expect(items?.map((i) => i.category)).toEqual(['Jardín', 'jardin']);
      expect(new RoomStore().categories()).toEqual(['Jardín']);
    });

    it('drops fields that are not part of an item', () => {
      const { items } = load([{ ...goodItem, extra: 'x' }]);
      expect(items).toEqual([goodItem]);
    });

    it('repairs the container and keeps its items when its rotation and stack position are wrong', () => {
      const { containers, items } = load([goodItem], { rotation: 45, stackPosition: -2 });
      expect(containers[0].rotation).toBe(0);
      expect(containers[0].stackPosition).toBe(0);
      expect(items).toEqual([goodItem]);
    });

    it('lets a loaded container receive new items', () => {
      const room = createRoom('Garage');
      const { items: _items, ...oldContainer } = box('Toys', 0, 0);
      localStorage.setItem(
        ROOMS_STORAGE_KEY,
        JSON.stringify([{ ...room, containers: [oldContainer] }]),
      );
      const store = new RoomStore();
      const nails = item('Nails');
      expect(store.addItem(room.id, oldContainer.id, nails)).toBe(true);
      expect(itemsOf(new RoomStore(), room.id, oldContainer.id)).toEqual([nails]);
    });
  });
});
