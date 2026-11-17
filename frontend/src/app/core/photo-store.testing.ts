import { PhotoSize, PhotoStore, ProcessedPhoto } from './photo-store';

/**
 * A photo store in memory, for the unit tests of the components and pages. It is only used by
 * tests: the app never imports this file.
 */
export class FakePhotoStore extends PhotoStore {
  /** The photos saved, by id. */
  readonly saved = new Map<string, ProcessedPhoto>();
  /** The ids passed to `delete`, in order. */
  readonly deleted: string[] = [];
  /** When true, `save` rejects, as a full storage does. */
  failSave = false;
  private nextId = 1;

  /** Puts a photo in the store with a known id, as if it had been saved before. */
  add(id: string, photo: ProcessedPhoto = fakePhoto(id)): void {
    this.saved.set(id, photo);
  }

  async save(photo: ProcessedPhoto): Promise<string> {
    if (this.failSave) {
      throw new Error('The storage is full');
    }
    const id = `photo-${this.nextId++}`;
    this.saved.set(id, photo);
    return id;
  }

  async load(id: string, size: PhotoSize): Promise<Blob | null> {
    return this.saved.get(id)?.[size] ?? null;
  }

  async delete(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.deleted.push(id);
      this.saved.delete(id);
    }
  }

  async deleteAllExcept(usedIds: ReadonlySet<string>): Promise<void> {
    await this.delete([...this.saved.keys()].filter((id) => !usedIds.has(id)));
  }
}

/** Two small blobs that stand for the versions of a photo. They are not real images. */
export function fakePhoto(label = 'photo'): ProcessedPhoto {
  return {
    thumbnail: new Blob([`${label}-thumbnail`], { type: 'image/jpeg' }),
    full: new Blob([`${label}-full`], { type: 'image/jpeg' }),
  };
}

/** The object URLs created and revoked while a test runs (see `stubObjectUrls`). */
export interface ObjectUrls {
  created: string[];
  revoked: string[];
  /** The URLs that were created and not revoked yet. */
  alive(): string[];
  /** Puts back what `URL` had before. */
  restore(): void;
}

/**
 * jsdom has no `URL.createObjectURL`. This puts a simple one in its place, which also records
 * every URL, so a test can check that each one is revoked.
 */
export function stubObjectUrls(): ObjectUrls {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const urls: ObjectUrls = {
    created: [],
    revoked: [],
    alive: () => urls.created.filter((url) => !urls.revoked.includes(url)),
    restore: () => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    },
  };
  URL.createObjectURL = () => {
    const url = `blob:test/${urls.created.length + 1}`;
    urls.created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    urls.revoked.push(url);
  };
  return urls;
}

/** Waits for the promises that are pending (a photo being loaded or saved) to finish. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
