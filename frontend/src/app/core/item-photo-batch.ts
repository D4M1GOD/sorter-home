import { inject, Service } from '@angular/core';
import { createItem, Item, nextItemName } from './item.model';
import { BATCH_ITEM_ERROR, BatchFailure } from './photo-batch';
import { PhotoError, PhotoProcessor } from './photo-processor';
import { PHOTO_SAVE_ERROR, PHOTO_UNREADABLE_ERROR } from './photo-size';
import { PhotoStore } from './photo-store';
import { RoomStore } from './room-store';

/** What `ItemPhotoBatch.run` needs from whoever starts the batch. */
export interface BatchRunOptions {
  /**
   * Asked before each step that would keep something. When it says false (the user chose another
   * container, or the container or the page is gone) the batch stops and keeps nothing more.
   */
  isCurrent: () => boolean;
  /** Called before each photo is prepared, with its place in the batch (counted from 1). */
  onProgress: (current: number, total: number) => void;
}

/** What a batch did. `stopped` is true when `isCurrent` said false: there is nothing to report. */
export interface BatchResult {
  added: number;
  /** The number of files the batch was given. */
  chosen: number;
  failures: BatchFailure[];
  stopped: boolean;
}

/**
 * Creates one item per photo file, in a container: the file is prepared (validated and reduced
 * in size), its photo is saved, and then the item is added to the container, in that order, like
 * the item form does. The photos are handled one at a time to keep the memory low, and a file
 * that fails never stops the others. The items are named "Item 1", "Item 2"... with the lowest
 * number free at that moment, counting the items that this batch has just created.
 *
 * It needs the browser services (the photo processor and the photo store) and the room store, so
 * its rules that do not are in `photo-batch.ts` and `item.model.ts`.
 */
@Service()
export class ItemPhotoBatch {
  private readonly store = inject(RoomStore);
  private readonly photos = inject(PhotoStore);
  private readonly processor = inject(PhotoProcessor);

  async run(
    files: readonly File[],
    containerId: string,
    options: BatchRunOptions,
  ): Promise<BatchResult> {
    const failures: BatchFailure[] = [];
    let added = 0;
    const result = (stopped: boolean): BatchResult => ({
      added,
      chosen: files.length,
      failures,
      stopped,
    });

    for (const [index, file] of files.entries()) {
      if (!options.isCurrent() || this.find(containerId) === null) {
        return result(true);
      }
      options.onProgress(index + 1, files.length);

      let photo;
      try {
        photo = await this.processor.process(file);
      } catch (error) {
        failures.push({
          fileName: file.name,
          reason: error instanceof PhotoError ? error.message : PHOTO_UNREADABLE_ERROR,
        });
        continue;
      }
      // The user may have left the container while the photo was prepared: keep nothing.
      if (!options.isCurrent()) {
        return result(true);
      }

      let photoId: string;
      try {
        photoId = await this.photos.save(photo);
      } catch {
        failures.push({ fileName: file.name, reason: PHOTO_SAVE_ERROR });
        continue;
      }

      // Everything from here to adding the item is synchronous: nothing can change in between.
      const target = this.find(containerId);
      if (!options.isCurrent() || target === null) {
        await this.discard(photoId);
        return result(true);
      }
      const item = createItem({
        name: nextItemName(target.items),
        quantity: 1,
        description: '',
        category: '',
        photoId,
      });
      if (this.store.addItem(target.roomId, containerId, item)) {
        added++;
      } else {
        await this.discard(photoId);
        failures.push({ fileName: file.name, reason: BATCH_ITEM_ERROR });
      }
    }
    return result(false);
  }

  /** The room and the items of a container, found by the id of the container (ids are unique). */
  private find(containerId: string): { roomId: string; items: readonly Item[] } | null {
    for (const room of this.store.rooms()) {
      const container = room.containers.find((c) => c.id === containerId);
      if (container) {
        return { roomId: room.id, items: container.items };
      }
    }
    return null;
  }

  /** Deletes a photo that no item uses. If that fails, the cleanup of the next start removes it. */
  private async discard(photoId: string): Promise<void> {
    await this.photos.delete([photoId]).catch(() => undefined);
  }
}
