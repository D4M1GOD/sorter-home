import { effect, inject, Service } from '@angular/core';
import { usedPhotoIds } from './photo-size';
import { PhotoStore } from './photo-store';
import { RoomStore } from './room-store';

/**
 * Deletes the photos that no item uses any more. `RoomStore` is synchronous and knows nothing
 * about photos, and the photo store is asynchronous, so this service sits between them: it
 * watches the rooms and, after every change, deletes the photos whose id is no longer used.
 * That covers an item, a container or a room being deleted, and a photo being replaced or
 * removed, with no code in the pages.
 *
 * When the app starts it also deletes the photos that no item uses (left, for example, by a
 * tab closed between saving a photo and saving its item). It is created once, at startup (see
 * `app.config.ts`).
 */
@Service()
export class PhotoCleanup {
  private readonly store = inject(RoomStore);
  private readonly photos = inject(PhotoStore);

  /** The photo ids in use the last time the rooms were looked at. */
  private used = usedPhotoIds(this.store.rooms());

  constructor() {
    // Never when the saved rooms could not be read: the list is empty then, and every photo
    // would look unused.
    if (this.store.loadedOk) {
      this.ignoreFailure(this.photos.deleteAllExcept(this.used));
    }
    effect(() => {
      const used = usedPhotoIds(this.store.rooms());
      const gone = [...this.used].filter((id) => !used.has(id));
      this.used = used;
      if (gone.length > 0) {
        this.ignoreFailure(this.photos.delete(gone));
      }
    });
  }

  /** A deletion that fails leaves a photo nobody uses: the cleanup of the next start removes it. */
  private ignoreFailure(deletion: Promise<void>): void {
    deletion.catch(() => undefined);
  }
}
