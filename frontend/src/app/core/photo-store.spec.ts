// A real IndexedDB kept in memory: jsdom does not have one. Only the tests use it.
import { IDBDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { vi } from 'vitest';
import { IndexedDbPhotoStore, PHOTO_DB_NAME, ProcessedPhoto } from './photo-store';

describe('IndexedDbPhotoStore', () => {
  beforeEach(() => {
    // A new, empty database for each test.
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function photo(label: string): ProcessedPhoto {
    return {
      thumbnail: new Blob([`${label}-small`], { type: 'image/jpeg' }),
      full: new Blob([`${label}-big-version`], { type: 'image/jpeg' }),
    };
  }

  async function text(blob: Blob | null): Promise<string | null> {
    return blob === null ? null : new TextDecoder().decode(await blob.arrayBuffer());
  }

  /** The keys saved in each object store, read straight from the database. */
  function savedKeys(): Promise<Record<string, string[]>> {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(PHOTO_DB_NAME);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const names = Array.from(database.objectStoreNames);
        const keys: Record<string, string[]> = {};
        const transaction = database.transaction(names, 'readonly');
        for (const name of names) {
          const request = transaction.objectStore(name).getAllKeys();
          request.onsuccess = () => (keys[name] = request.result as string[]);
        }
        transaction.oncomplete = () => {
          database.close();
          resolve(keys);
        };
      };
    });
  }

  describe('save and load', () => {
    it('saves the two versions and loads each of them, with its type', async () => {
      const store = new IndexedDbPhotoStore();
      const id = await store.save(photo('nails'));
      const thumbnail = await store.load(id, 'thumbnail');
      const full = await store.load(id, 'full');
      expect(await text(thumbnail)).toBe('nails-small');
      expect(await text(full)).toBe('nails-big-version');
      expect(thumbnail?.type).toBe('image/jpeg');
      expect(full?.type).toBe('image/jpeg');
    });

    it('gives each photo a new id that is not empty', async () => {
      const store = new IndexedDbPhotoStore();
      const first = await store.save(photo('a'));
      const second = await store.save(photo('a'));
      expect(first).toBeTruthy();
      expect(second).not.toBe(first);
      expect(await text(await store.load(first, 'thumbnail'))).toBe('a-small');
    });

    it('keeps the thumbnails and the full versions in two object stores, with the same id', async () => {
      const store = new IndexedDbPhotoStore();
      const id = await store.save(photo('a'));
      expect(await savedKeys()).toEqual({ 'photo-full': [id], 'photo-thumbnails': [id] });
    });

    it('keeps the photos for another store object: they are saved in the browser', async () => {
      const id = await new IndexedDbPhotoStore().save(photo('nails'));
      expect(await text(await new IndexedDbPhotoStore().load(id, 'full'))).toBe('nails-big-version');
    });

    it('gives null for an id that does not exist', async () => {
      const store = new IndexedDbPhotoStore();
      await store.save(photo('a'));
      expect(await store.load('nope', 'thumbnail')).toBeNull();
      expect(await store.load('nope', 'full')).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes both versions of the photos with those ids, and keeps the others', async () => {
      const store = new IndexedDbPhotoStore();
      const a = await store.save(photo('a'));
      const b = await store.save(photo('b'));
      const c = await store.save(photo('c'));
      await store.delete([a, c]);
      expect(await store.load(a, 'thumbnail')).toBeNull();
      expect(await store.load(a, 'full')).toBeNull();
      expect(await store.load(c, 'full')).toBeNull();
      expect(await text(await store.load(b, 'full'))).toBe('b-big-version');
      expect(await savedKeys()).toEqual({ 'photo-full': [b], 'photo-thumbnails': [b] });
    });

    it('ignores ids that do not exist, and an empty list', async () => {
      const store = new IndexedDbPhotoStore();
      const a = await store.save(photo('a'));
      await store.delete(['nope']);
      await store.delete([]);
      expect(await text(await store.load(a, 'thumbnail'))).toBe('a-small');
    });
  });

  describe('deleteAllExcept', () => {
    it('deletes every photo that is not in use, in both object stores', async () => {
      const store = new IndexedDbPhotoStore();
      const a = await store.save(photo('a'));
      const b = await store.save(photo('b'));
      const c = await store.save(photo('c'));
      await store.deleteAllExcept(new Set([b]));
      expect(await savedKeys()).toEqual({ 'photo-full': [b], 'photo-thumbnails': [b] });
      expect(await store.load(a, 'full')).toBeNull();
      expect(await store.load(c, 'thumbnail')).toBeNull();
      expect(await text(await store.load(b, 'full'))).toBe('b-big-version');
    });

    it('deletes nothing when every photo is in use, also with ids that have no photo', async () => {
      const store = new IndexedDbPhotoStore();
      const a = await store.save(photo('a'));
      await store.deleteAllExcept(new Set([a, 'an-item-with-a-lost-photo']));
      expect(await text(await store.load(a, 'full'))).toBe('a-big-version');
    });

    it('deletes every photo when none is in use', async () => {
      const store = new IndexedDbPhotoStore();
      await store.save(photo('a'));
      await store.save(photo('b'));
      await store.deleteAllExcept(new Set());
      expect(await savedKeys()).toEqual({ 'photo-full': [], 'photo-thumbnails': [] });
    });

    it('works on an empty database', async () => {
      await expect(new IndexedDbPhotoStore().deleteAllExcept(new Set())).resolves.toBeUndefined();
    });

    it('uses a single transaction for both object stores', async () => {
      const store = new IndexedDbPhotoStore();
      await store.save(photo('a'));
      const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
      try {
        await store.deleteAllExcept(new Set());
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(transaction).toHaveBeenCalledWith(['photo-thumbnails', 'photo-full'], 'readwrite');
      } finally {
        transaction.mockRestore();
      }
    });

    it('deletes nothing if the transaction fails: it is all or nothing', async () => {
      const store = new IndexedDbPhotoStore();
      const a = await store.save(photo('a'));
      const b = await store.save(photo('b'));
      // The transaction is cancelled after the deletions were asked for, before it is saved.
      const original = IDBObjectStore.prototype.delete;
      let calls = 0;
      const failing = vi
        .spyOn(IDBObjectStore.prototype, 'delete')
        .mockImplementation(function (this: IDBObjectStore, key) {
          const request = original.call(this, key);
          calls++;
          if (calls === 3) {
            this.transaction.abort();
          }
          return request;
        });
      try {
        await expect(store.deleteAllExcept(new Set())).rejects.toBeDefined();
      } finally {
        failing.mockRestore();
      }
      expect(await savedKeys()).toEqual({
        'photo-full': [a, b].sort(),
        'photo-thumbnails': [a, b].sort(),
      });
    });
  });

  describe('when IndexedDB does not work', () => {
    it('rejects the save, so the item is not saved', async () => {
      vi.stubGlobal('indexedDB', undefined);
      await expect(new IndexedDbPhotoStore().save(photo('a'))).rejects.toBeDefined();
    });

    it('gives null when loading, so the photo is shown as missing', async () => {
      vi.stubGlobal('indexedDB', undefined);
      expect(await new IndexedDbPhotoStore().load('a', 'thumbnail')).toBeNull();
    });

    it('rejects the deletions', async () => {
      vi.stubGlobal('indexedDB', undefined);
      const store = new IndexedDbPhotoStore();
      await expect(store.delete(['a'])).rejects.toBeDefined();
      await expect(store.deleteAllExcept(new Set())).rejects.toBeDefined();
    });

    it('tries to open the database again after a failure', async () => {
      const store = new IndexedDbPhotoStore();
      const working = indexedDB;
      vi.stubGlobal('indexedDB', undefined);
      await expect(store.save(photo('a'))).rejects.toBeDefined();
      vi.stubGlobal('indexedDB', working);
      const id = await store.save(photo('a'));
      expect(await text(await store.load(id, 'thumbnail'))).toBe('a-small');
    });

    it('saves neither version when the save fails half way', async () => {
      const store = new IndexedDbPhotoStore();
      const kept = await store.save(photo('kept'));
      const original = IDBObjectStore.prototype.put;
      const failing = vi
        .spyOn(IDBObjectStore.prototype, 'put')
        .mockImplementation(function (this: IDBObjectStore, value, key) {
          if (this.name === 'photo-full') {
            // What a full storage does: the transaction is cancelled.
            this.transaction.abort();
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
          }
          return original.call(this, value, key);
        });
      try {
        await expect(store.save(photo('lost'))).rejects.toBeDefined();
      } finally {
        failing.mockRestore();
      }
      expect(await savedKeys()).toEqual({ 'photo-full': [kept], 'photo-thumbnails': [kept] });
    });
  });
});
