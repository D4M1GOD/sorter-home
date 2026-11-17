import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { createContainer, TOUGH_BOX_27_GAL } from './container.model';
import { ItemPhotoBatch } from './item-photo-batch';
import { createItem } from './item.model';
import { BATCH_ITEM_ERROR } from './photo-batch';
import { PhotoError, PhotoProcessor } from './photo-processor';
import { PHOTO_NOT_IMAGE_ERROR, PHOTO_SAVE_ERROR, PHOTO_UNREADABLE_ERROR } from './photo-size';
import { PhotoStore } from './photo-store';
import { fakePhoto, FakePhotoStore, settle } from './photo-store.testing';
import { createRoom } from './room.model';
import { RoomStore } from './room-store';

describe('ItemPhotoBatch', () => {
  let photos: FakePhotoStore;
  /** The files the fake processor does not accept, with the error it throws for each. */
  let rejected: Map<string, Error>;
  let process: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    photos = new FakePhotoStore();
    rejected = new Map();
    process = vi.fn(async (file: File) => {
      const error = rejected.get(file.name);
      if (error) {
        throw error;
      }
      return fakePhoto(file.name);
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: PhotoStore, useValue: photos },
        { provide: PhotoProcessor, useValue: { process } },
      ],
    });
  });

  function file(name: string): File {
    return new File(['pixels'], name, { type: 'image/jpeg' });
  }

  function files(...names: string[]): File[] {
    return names.map(file);
  }

  /** A room with the containers "Toys" and "Books". */
  function setup() {
    const store = TestBed.inject(RoomStore);
    const room = createRoom('Garage');
    store.add(room);
    const toys = createContainer(TOUGH_BOX_27_GAL.id, 'Toys', 0, 0);
    const books = createContainer(TOUGH_BOX_27_GAL.id, 'Books', 2000, 0);
    store.addContainer(room.id, toys);
    store.addContainer(room.id, books);
    return { store, room, toys, books, batch: TestBed.inject(ItemPhotoBatch) };
  }

  const always = { isCurrent: () => true, onProgress: () => undefined };

  function itemsOf(store: RoomStore, roomId: string, containerId: string) {
    return store.getById(roomId)?.containers.find((c) => c.id === containerId)?.items ?? [];
  }

  function existing(name: string) {
    return createItem({ name, quantity: 1, description: '', category: '', photoId: null });
  }

  describe('the items it creates', () => {
    it('creates one item per photo, named "Item 1", "Item 2"..., with the photo of each file', async () => {
      const { store, room, toys, batch } = setup();
      const result = await batch.run(files('a.jpg', 'b.jpg', 'c.jpg'), toys.id, always);
      const items = itemsOf(store, room.id, toys.id);
      expect(items.map((item) => item.name)).toEqual(['Item 1', 'Item 2', 'Item 3']);
      expect(items.map((item) => item.photoId)).toEqual(['photo-1', 'photo-2', 'photo-3']);
      expect(await photos.saved.get('photo-2')?.full.text()).toBe('b.jpg-full');
      expect(result).toEqual({ added: 3, chosen: 3, failures: [], stopped: false });
    });

    it('gives quantity 1, no units out, no description and no category', async () => {
      const { store, room, toys, batch } = setup();
      await batch.run(files('a.jpg'), toys.id, always);
      expect(itemsOf(store, room.id, toys.id)[0]).toEqual({
        id: expect.any(String),
        name: 'Item 1',
        quantity: 1,
        quantityOut: 0,
        description: '',
        category: '',
        photoId: 'photo-1',
      });
    });

    it('creates the items only in the container it was given', async () => {
      const { store, room, toys, books, batch } = setup();
      await batch.run(files('a.jpg', 'b.jpg'), toys.id, always);
      expect(itemsOf(store, room.id, toys.id).length).toBe(2);
      expect(itemsOf(store, room.id, books.id)).toEqual([]);
    });

    it('saves the items in the browser storage: a new store finds them', async () => {
      const { store, room, toys, batch } = setup();
      await batch.run(files('a.jpg', 'b.jpg'), toys.id, always);
      expect(itemsOf(new RoomStore(), room.id, toys.id)).toEqual(itemsOf(store, room.id, toys.id));
    });

    it('uses the lowest free number, filling gaps and counting the names that already exist', async () => {
      const { store, room, toys, batch } = setup();
      store.addItem(room.id, toys.id, existing('Item 1'));
      store.addItem(room.id, toys.id, existing('item 3')); // upper/lower case does not matter
      store.addItem(room.id, toys.id, existing('Nails'));
      await batch.run(files('a.jpg', 'b.jpg', 'c.jpg'), toys.id, always);
      const names = itemsOf(store, room.id, toys.id).map((item) => item.name);
      expect(names).toEqual(['Item 1', 'item 3', 'Nails', 'Item 2', 'Item 4', 'Item 5']);
    });

    it('does not count the names of the items of other containers', async () => {
      const { store, room, toys, books, batch } = setup();
      store.addItem(room.id, books.id, existing('Item 1'));
      await batch.run(files('a.jpg'), toys.id, always);
      expect(itemsOf(store, room.id, toys.id)[0].name).toBe('Item 1');
    });

    it('does nothing for an empty list of files', async () => {
      const { batch, toys } = setup();
      expect(await batch.run([], toys.id, always)).toEqual({
        added: 0,
        chosen: 0,
        failures: [],
        stopped: false,
      });
      expect(process).not.toHaveBeenCalled();
    });
  });

  describe('one at a time', () => {
    it('reports the progress before each photo, counted from 1', async () => {
      const { batch, toys } = setup();
      const onProgress = vi.fn();
      await batch.run(files('a.jpg', 'b.jpg', 'c.jpg'), toys.id, { isCurrent: () => true, onProgress });
      expect(onProgress.mock.calls).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ]);
    });

    it('prepares one photo at a time, never two together', async () => {
      const { batch, toys } = setup();
      let inFlight = 0;
      let mostInFlight = 0;
      process.mockImplementation(async (chosen: File) => {
        inFlight++;
        mostInFlight = Math.max(mostInFlight, inFlight);
        await settle();
        inFlight--;
        return fakePhoto(chosen.name);
      });
      await batch.run(files('a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'), toys.id, always);
      expect(process).toHaveBeenCalledTimes(4);
      expect(mostInFlight).toBe(1);
    });

    it('adds each item as soon as its photo is ready, before the next photo is prepared', async () => {
      const { store, room, toys, batch } = setup();
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      process.mockImplementation(async (chosen: File) => {
        if (chosen.name === 'b.jpg') {
          await gate;
        }
        return fakePhoto(chosen.name);
      });
      const running = batch.run(files('a.jpg', 'b.jpg'), toys.id, always);
      await settle();
      expect(itemsOf(store, room.id, toys.id).map((item) => item.name)).toEqual(['Item 1']);
      release();
      await running;
      expect(itemsOf(store, room.id, toys.id).map((item) => item.name)).toEqual(['Item 1', 'Item 2']);
    });

    it('saves the photo before it adds the item', async () => {
      const { store, room, toys, batch } = setup();
      const addItem = vi.spyOn(store, 'addItem');
      addItem.mockImplementation((roomId, containerId, item) => {
        expect(photos.saved.has(item.photoId as string)).toBe(true);
        return true;
      });
      await batch.run(files('a.jpg'), toys.id, always);
      expect(addItem).toHaveBeenCalledTimes(1);
      expect(room.id).toBeTruthy();
    });
  });

  describe('a file that fails', () => {
    it('does not stop the others, and is reported with its reason', async () => {
      const { store, room, toys, batch } = setup();
      rejected.set('b.pdf', new PhotoError(PHOTO_NOT_IMAGE_ERROR));
      const result = await batch.run(files('a.jpg', 'b.pdf', 'c.jpg'), toys.id, always);
      expect(result.added).toBe(2);
      expect(result.chosen).toBe(3);
      expect(result.stopped).toBe(false);
      expect(result.failures).toEqual([{ fileName: 'b.pdf', reason: 'This file is not an image.' }]);
      expect(itemsOf(store, room.id, toys.id).length).toBe(2);
    });

    it('does not use a number for it: the next item takes the next number', async () => {
      const { store, room, toys, batch } = setup();
      rejected.set('bad.jpg', new PhotoError(PHOTO_NOT_IMAGE_ERROR));
      await batch.run(files('a.jpg', 'bad.jpg', 'c.jpg'), toys.id, always);
      expect(itemsOf(store, room.id, toys.id).map((item) => item.name)).toEqual(['Item 1', 'Item 2']);
    });

    it('keeps each of the reasons of the photo processor', async () => {
      const { batch, toys } = setup();
      rejected.set('a.pdf', new PhotoError(PHOTO_NOT_IMAGE_ERROR));
      rejected.set('b.jpg', new PhotoError('This photo is too large. The maximum is 30 MB.'));
      rejected.set('c.heic', new PhotoError(PHOTO_UNREADABLE_ERROR));
      const result = await batch.run(files('a.pdf', 'b.jpg', 'c.heic'), toys.id, always);
      expect(result.failures.map((failure) => failure.reason)).toEqual([
        'This file is not an image.',
        'This photo is too large. The maximum is 30 MB.',
        "Couldn't read this image. Try a JPEG or PNG photo.",
      ]);
      expect(result.added).toBe(0);
    });

    it('says the image could not be read for any other failure of the processor', async () => {
      const { batch, toys } = setup();
      rejected.set('a.jpg', new Error('out of memory'));
      const result = await batch.run(files('a.jpg'), toys.id, always);
      expect(result.failures).toEqual([{ fileName: 'a.jpg', reason: PHOTO_UNREADABLE_ERROR }]);
    });

    it('says the photo could not be saved, creates no item, and goes on', async () => {
      const { store, room, toys, batch } = setup();
      vi.spyOn(photos, 'save').mockRejectedValueOnce(new Error('The storage is full'));
      const result = await batch.run(files('a.jpg', 'b.jpg'), toys.id, always);
      expect(result.failures).toEqual([{ fileName: 'a.jpg', reason: PHOTO_SAVE_ERROR }]);
      expect(result.added).toBe(1);
      const items = itemsOf(store, room.id, toys.id);
      expect(items.map((item) => item.name)).toEqual(['Item 1']);
      expect(photos.saved.size).toBe(1);
    });

    it('deletes the photo and goes on when the store does not accept the item', async () => {
      const { store, room, toys, batch } = setup();
      vi.spyOn(store, 'addItem').mockReturnValueOnce(false);
      const result = await batch.run(files('a.jpg', 'b.jpg'), toys.id, always);
      expect(result.failures).toEqual([{ fileName: 'a.jpg', reason: BATCH_ITEM_ERROR }]);
      expect(result.added).toBe(1);
      expect(photos.deleted).toEqual(['photo-1']);
      expect([...photos.saved.keys()]).toEqual(['photo-2']);
      expect(itemsOf(store, room.id, toys.id).map((item) => item.photoId)).toEqual(['photo-2']);
    });

    it('goes on when deleting that photo fails too', async () => {
      const { store, toys, batch } = setup();
      vi.spyOn(store, 'addItem').mockReturnValueOnce(false);
      vi.spyOn(photos, 'delete').mockRejectedValueOnce(new Error('blocked'));
      const result = await batch.run(files('a.jpg', 'b.jpg'), toys.id, always);
      expect(result.added).toBe(1);
      expect(result.failures.length).toBe(1);
    });

    it('reports every failure when all the files fail', async () => {
      const { store, room, toys, batch } = setup();
      for (const name of ['a.jpg', 'b.jpg']) {
        rejected.set(name, new PhotoError(PHOTO_NOT_IMAGE_ERROR));
      }
      const result = await batch.run(files('a.jpg', 'b.jpg'), toys.id, always);
      expect(result).toEqual({
        added: 0,
        chosen: 2,
        stopped: false,
        failures: [
          { fileName: 'a.jpg', reason: PHOTO_NOT_IMAGE_ERROR },
          { fileName: 'b.jpg', reason: PHOTO_NOT_IMAGE_ERROR },
        ],
      });
      expect(itemsOf(store, room.id, toys.id)).toEqual([]);
      expect(photos.saved.size).toBe(0);
    });
  });

  describe('when the user leaves the container', () => {
    it('does nothing when it is not the current batch from the start', async () => {
      const { store, room, toys, batch } = setup();
      const result = await batch.run(files('a.jpg', 'b.jpg'), toys.id, {
        isCurrent: () => false,
        onProgress: () => undefined,
      });
      expect(result.stopped).toBe(true);
      expect(process).not.toHaveBeenCalled();
      expect(photos.saved.size).toBe(0);
      expect(itemsOf(store, room.id, toys.id)).toEqual([]);
    });

    it('stops while a photo is being prepared: that photo is not kept, and no other is prepared', async () => {
      const { store, room, toys, batch } = setup();
      let current = true;
      process.mockImplementation(async (chosen: File) => {
        if (chosen.name === 'b.jpg') {
          current = false; // the user selects another container while it is prepared
        }
        return fakePhoto(chosen.name);
      });
      const result = await batch.run(files('a.jpg', 'b.jpg', 'c.jpg'), toys.id, {
        isCurrent: () => current,
        onProgress: () => undefined,
      });
      expect(result.stopped).toBe(true);
      expect(result.added).toBe(1);
      expect(process).toHaveBeenCalledTimes(2);
      expect(photos.saved.size).toBe(1);
      expect(itemsOf(store, room.id, toys.id).map((item) => item.name)).toEqual(['Item 1']);
    });

    it('deletes the photo that was saved when it stops, and adds no item for it', async () => {
      const { store, room, toys, batch } = setup();
      let current = true;
      const save = photos.save.bind(photos);
      vi.spyOn(photos, 'save').mockImplementation(async (photo) => {
        const id = await save(photo);
        current = false; // the user selected another container while it was saved
        return id;
      });
      const result = await batch.run(files('a.jpg', 'b.jpg'), toys.id, {
        isCurrent: () => current,
        onProgress: () => undefined,
      });
      expect(result).toEqual({ added: 0, chosen: 2, failures: [], stopped: true });
      expect(photos.deleted).toEqual(['photo-1']);
      expect(photos.saved.size).toBe(0);
      expect(itemsOf(store, room.id, toys.id)).toEqual([]);
    });

    it('stops, and leaves no photo, when the container is deleted while the batch runs', async () => {
      const { store, room, toys, batch } = setup();
      process.mockImplementation(async (chosen: File) => {
        if (chosen.name === 'b.jpg') {
          store.removeContainer(room.id, toys.id);
        }
        return fakePhoto(chosen.name);
      });
      // `isCurrent` stays true: the batch has to notice that the container is gone by itself.
      const result = await batch.run(files('a.jpg', 'b.jpg', 'c.jpg'), toys.id, always);
      expect(result.stopped).toBe(true);
      expect(result.added).toBe(1);
      expect(process).toHaveBeenCalledTimes(2);
      // The photo of "b.jpg" was saved before the batch saw that the container was gone: it is
      // deleted at once. The photo of "a.jpg" belonged to an item of the deleted container, and
      // the photo cleanup of the app deletes it (it is not running in this test).
      expect(photos.deleted).toEqual(['photo-2']);
      expect([...photos.saved.keys()]).toEqual(['photo-1']);
    });

    it('does nothing for a container that does not exist', async () => {
      const { batch } = setup();
      const result = await batch.run(files('a.jpg'), 'no-container', always);
      expect(result.stopped).toBe(true);
      expect(process).not.toHaveBeenCalled();
    });

    it('keeps the items it had already created', async () => {
      const { store, room, toys, batch } = setup();
      let current = true;
      process.mockImplementation(async (chosen: File) => {
        if (chosen.name === 'c.jpg') {
          current = false;
        }
        return fakePhoto(chosen.name);
      });
      await batch.run(files('a.jpg', 'b.jpg', 'c.jpg'), toys.id, {
        isCurrent: () => current,
        onProgress: () => undefined,
      });
      expect(itemsOf(store, room.id, toys.id).map((item) => item.name)).toEqual(['Item 1', 'Item 2']);
    });
  });
});
