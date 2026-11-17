import { Injectable } from '@angular/core';

/** The two versions of a photo, ready to be saved. Both are JPEG. */
export interface ProcessedPhoto {
  /** The small version, for the item list. */
  thumbnail: Blob;
  /** The big version, shown when the photo is opened. */
  full: Blob;
}

/** Which version of a photo to load. */
export type PhotoSize = 'thumbnail' | 'full';

/**
 * Where the photos of the items are kept. Items only keep the id of their photo.
 * Everything is asynchronous, because the browser storage for big data (IndexedDB) is, and so
 * will be the backend. The pages and components only use this class, so the IndexedDB storage
 * below can later be replaced by calls to the API without changing them.
 *
 * `@Injectable` with `useFactory` (and not `@Service`) because this class is abstract: Angular
 * needs to be told which real class to create when something asks for a `PhotoStore`.
 */
@Injectable({ providedIn: 'root', useFactory: () => new IndexedDbPhotoStore() })
export abstract class PhotoStore {
  /**
   * Saves the two versions of a new photo together and gives its new id. Rejects, and saves
   * nothing, if the storage fails (for example when it is full).
   */
  abstract save(photo: ProcessedPhoto): Promise<string>;

  /**
   * Gives one version of a photo, or null when there is no photo with that id or it cannot be
   * read. It never rejects: a photo that cannot be read is shown as a missing photo.
   */
  abstract load(id: string, size: PhotoSize): Promise<Blob | null>;

  /** Deletes both versions of the photos with these ids. Ids that do not exist are ignored. */
  abstract delete(ids: readonly string[]): Promise<void>;

  /**
   * Deletes every photo whose id is not in `usedIds`, all at once: if it fails, no photo is
   * deleted.
   */
  abstract deleteAllExcept(usedIds: ReadonlySet<string>): Promise<void>;
}

export const PHOTO_DB_NAME = 'sorterhome';
const PHOTO_DB_VERSION = 1;
/** One object store for each version, so the list reads the thumbnails without the big photos. */
const STORE_OF: Record<PhotoSize, string> = {
  thumbnail: 'photo-thumbnails',
  full: 'photo-full',
};
const ALL_STORES = [STORE_OF.thumbnail, STORE_OF.full];

/**
 * A photo version as it is saved. The bytes are saved as an ArrayBuffer and not as a Blob,
 * because every browser can keep an ArrayBuffer in IndexedDB.
 */
interface SavedPhoto {
  id: string;
  type: string;
  bytes: ArrayBuffer;
}

/** Turns an IndexedDB request into a promise. */
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Waits until a transaction has saved all its changes. If anything fails, IndexedDB undoes the
 * whole transaction and this rejects: a transaction is all or nothing.
 */
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(transaction.error ?? new Error('The transaction was cancelled'));
    transaction.oncomplete = () => resolve();
    transaction.onerror = fail;
    transaction.onabort = fail;
  });
}

/**
 * Runs `work` in one transaction over both object stores and waits until it is saved. If `work`
 * throws, the transaction is cancelled, so nothing of it is saved, and this rejects.
 */
async function inTransaction(
  database: IDBDatabase,
  work: (transaction: IDBTransaction) => void,
): Promise<void> {
  const transaction = database.transaction(ALL_STORES, 'readwrite');
  const done = transactionDone(transaction);
  try {
    work(transaction);
  } catch (error) {
    // Nobody waits for `done` any more: mark its failure as handled.
    done.catch(() => undefined);
    try {
      transaction.abort();
    } catch {
      // It was already cancelled.
    }
    throw error;
  }
  await done;
}

/** Reads the bytes of a blob. */
function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

/** Photos kept in the browser's IndexedDB: per browser, not shared across devices or people. */
export class IndexedDbPhotoStore extends PhotoStore {
  /** The open database. It is opened the first time it is needed. */
  private database: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      // Fails when the browser has no IndexedDB or blocks it (some private modes).
      const request = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
      // Runs the first time, to create the object stores.
      request.onupgradeneeded = () => {
        for (const name of ALL_STORES) {
          if (!request.result.objectStoreNames.contains(name)) {
            request.result.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('The photo database is blocked'));
    }).catch((error: unknown) => {
      // Forget the failed attempt, so the next call tries to open the database again.
      this.database = null;
      throw error;
    });
    return this.database;
  }

  async save(photo: ProcessedPhoto): Promise<string> {
    // Read the bytes before the transaction starts: a transaction closes by itself as soon as
    // the code waits for something that is not one of its own requests.
    const [thumbnail, full] = await Promise.all([bytesOf(photo.thumbnail), bytesOf(photo.full)]);
    const database = await this.open();
    const id = crypto.randomUUID();
    const records: Record<PhotoSize, SavedPhoto> = {
      thumbnail: { id, type: photo.thumbnail.type, bytes: thumbnail },
      full: { id, type: photo.full.type, bytes: full },
    };
    // One transaction: both versions are saved, or neither is.
    await inTransaction(database, (transaction) => {
      transaction.objectStore(STORE_OF.thumbnail).put(records.thumbnail);
      transaction.objectStore(STORE_OF.full).put(records.full);
    });
    return id;
  }

  async load(id: string, size: PhotoSize): Promise<Blob | null> {
    try {
      const database = await this.open();
      const store = database.transaction(STORE_OF[size], 'readonly').objectStore(STORE_OF[size]);
      const saved = (await requestResult(store.get(id))) as SavedPhoto | undefined;
      return saved ? new Blob([saved.bytes], { type: saved.type }) : null;
    } catch {
      return null;
    }
  }

  async delete(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const database = await this.open();
    await inTransaction(database, (transaction) => {
      for (const name of ALL_STORES) {
        for (const id of ids) {
          transaction.objectStore(name).delete(id);
        }
      }
    });
  }

  async deleteAllExcept(usedIds: ReadonlySet<string>): Promise<void> {
    const database = await this.open();
    // One transaction for both object stores: every deletion is saved, or none is.
    await inTransaction(database, (transaction) => {
      for (const name of ALL_STORES) {
        const store = transaction.objectStore(name);
        const keys = store.getAllKeys();
        // The deletions are asked for inside the request of the same transaction, so it stays open.
        keys.onsuccess = () => {
          for (const key of keys.result) {
            if (typeof key !== 'string' || !usedIds.has(key)) {
              store.delete(key);
            }
          }
        };
      }
    });
  }
}
