import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createContainer, TOUGH_BOX_27_GAL } from './container.model';
import { createItem, Item } from './item.model';
import { PhotoCleanup } from './photo-cleanup';
import { PhotoStore } from './photo-store';
import { FakePhotoStore, settle } from './photo-store.testing';
import { createRoom } from './room.model';
import { ROOMS_STORAGE_KEY, RoomStore } from './room-store';

describe('PhotoCleanup', () => {
  let photos: FakePhotoStore;

  beforeEach(() => {
    localStorage.clear();
    photos = new FakePhotoStore();
    TestBed.configureTestingModule({ providers: [{ provide: PhotoStore, useValue: photos }] });
  });

  function item(name: string, photoId: string | null): Item {
    if (photoId !== null) {
      photos.add(photoId);
    }
    return createItem({ name, quantity: 1, description: '', category: '', photoId });
  }

  /**
   * A store with a room, the containers "Toys" (items "Nails" with photo "p-nails" and "Cables"
   * with "p-cables") and "Books" ("Novel" with "p-novel", "Plain" without photo), and the
   * cleanup already watching it.
   */
  async function started() {
    const store = TestBed.inject(RoomStore);
    const room = createRoom('Garage');
    store.add(room);
    const toys = createContainer(TOUGH_BOX_27_GAL.id, 'Toys', 0, 0);
    const books = createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0);
    store.addContainer(room.id, toys);
    store.addContainer(room.id, books);
    const nails = item('Nails', 'p-nails');
    const cables = item('Cables', 'p-cables');
    const novel = item('Novel', 'p-novel');
    const plain = item('Plain', null);
    store.addItem(room.id, toys.id, nails);
    store.addItem(room.id, toys.id, cables);
    store.addItem(room.id, books.id, novel);
    store.addItem(room.id, books.id, plain);
    TestBed.inject(PhotoCleanup);
    await changed();
    photos.deleted.length = 0;
    return { store, room, toys, books, nails, cables, novel, plain };
  }

  /** Lets the cleanup see the last change of the rooms and finish its deletions. */
  async function changed(): Promise<void> {
    TestBed.tick();
    await settle();
  }

  function remaining(): string[] {
    return [...photos.saved.keys()].sort();
  }

  describe('after a change of the rooms', () => {
    it('deletes the photo of an item that is removed, and no other', async () => {
      const { store, room, toys, nails } = await started();
      store.removeItem(room.id, toys.id, nails.id);
      await changed();
      expect(photos.deleted).toEqual(['p-nails']);
      expect(remaining()).toEqual(['p-cables', 'p-novel']);
    });

    it('deletes the photos of the items of a container that is deleted', async () => {
      const { store, room, toys } = await started();
      store.removeContainer(room.id, toys.id);
      await changed();
      expect(photos.deleted.sort()).toEqual(['p-cables', 'p-nails']);
      expect(remaining()).toEqual(['p-novel']);
    });

    it('deletes the photos of the items of a room that is deleted', async () => {
      const { store, room } = await started();
      store.remove(room.id);
      await changed();
      expect(remaining()).toEqual([]);
    });

    it('deletes the old photo when the photo of an item is replaced', async () => {
      const { store, room, toys, nails } = await started();
      photos.add('p-new');
      store.updateItem(room.id, toys.id, nails.id, { ...nails, photoId: 'p-new' });
      await changed();
      expect(photos.deleted).toEqual(['p-nails']);
      expect(remaining()).toEqual(['p-cables', 'p-new', 'p-novel']);
    });

    it('deletes the photo when it is removed from its item', async () => {
      const { store, room, toys, nails } = await started();
      store.updateItem(room.id, toys.id, nails.id, { ...nails, photoId: null });
      await changed();
      expect(photos.deleted).toEqual(['p-nails']);
    });

    it('deletes nothing for the changes that keep the photos in use', async () => {
      const { store, room, toys, books, nails, plain } = await started();
      store.updateItem(room.id, toys.id, nails.id, { ...nails, name: 'Screws', quantity: 5 });
      store.takeOutItem(room.id, toys.id, nails.id, 1);
      store.renameContainer(room.id, toys.id, 'Workshop');
      store.moveContainer(room.id, toys.id, 0, 2000);
      store.rename(room.id, 'Attic');
      store.removeItem(room.id, books.id, plain.id); // an item without a photo
      store.addItem(room.id, books.id, item('Hammer', 'p-hammer'));
      await changed();
      expect(photos.deleted).toEqual([]);
      expect(remaining()).toEqual(['p-cables', 'p-hammer', 'p-nails', 'p-novel']);
    });

    it('follows several changes in a row', async () => {
      const { store, room, toys, books, nails, novel } = await started();
      store.removeItem(room.id, toys.id, nails.id);
      await changed();
      store.removeItem(room.id, books.id, novel.id);
      await changed();
      expect(photos.deleted).toEqual(['p-nails', 'p-novel']);
      expect(remaining()).toEqual(['p-cables']);
    });

    it('goes on working when a deletion fails', async () => {
      const { store, room, toys, books, nails, novel } = await started();
      const failing = vi.spyOn(photos, 'delete').mockRejectedValueOnce(new Error('blocked'));
      store.removeItem(room.id, toys.id, nails.id);
      await changed();
      expect(failing).toHaveBeenCalledWith(['p-nails']);
      // The next change is still handled.
      store.removeItem(room.id, books.id, novel.id);
      await changed();
      expect(remaining()).toEqual(['p-cables', 'p-nails']);
    });
  });

  describe('when the app starts', () => {
    /** Saves a room whose only item uses the photo "p-used", as an earlier visit would. */
    function saveRooms(): void {
      const room = createRoom('Garage');
      const box = createContainer(TOUGH_BOX_27_GAL.id, 'Toys', 0, 0);
      const used = createItem({
        name: 'Nails',
        quantity: 1,
        description: '',
        category: '',
        photoId: 'p-used',
      });
      localStorage.setItem(
        ROOMS_STORAGE_KEY,
        JSON.stringify([{ ...room, containers: [{ ...box, items: [used] }] }]),
      );
    }

    it('deletes the photos that no item uses, and keeps the others', async () => {
      saveRooms();
      photos.add('p-used');
      photos.add('p-orphan-1');
      photos.add('p-orphan-2');
      TestBed.inject(PhotoCleanup);
      await changed();
      expect(remaining()).toEqual(['p-used']);
    });

    it('asks for one deletion of everything that is not in use', async () => {
      saveRooms();
      const cleanup = vi.spyOn(photos, 'deleteAllExcept');
      TestBed.inject(PhotoCleanup);
      await changed();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect([...cleanup.mock.calls[0][0]]).toEqual(['p-used']);
    });

    it('deletes every photo when nothing was ever saved: no item can use them', async () => {
      photos.add('p-orphan');
      TestBed.inject(PhotoCleanup);
      await changed();
      expect(remaining()).toEqual([]);
    });

    it('deletes nothing when the saved rooms could not be read', async () => {
      localStorage.setItem(ROOMS_STORAGE_KEY, '{ not json');
      photos.add('p-used');
      photos.add('p-other');
      const cleanup = vi.spyOn(photos, 'deleteAllExcept');
      TestBed.inject(PhotoCleanup);
      await changed();
      expect(cleanup).not.toHaveBeenCalled();
      expect(remaining()).toEqual(['p-other', 'p-used']);
    });

    it('does not break the start when the cleanup fails', async () => {
      saveRooms();
      vi.spyOn(photos, 'deleteAllExcept').mockRejectedValue(new Error('no IndexedDB'));
      expect(() => TestBed.inject(PhotoCleanup)).not.toThrow();
      await changed();
    });
  });
});
