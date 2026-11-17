import { effect, signal, Signal } from '@angular/core';
import { PhotoSize, PhotoStore } from './photo-store';

/**
 * An `<img>` cannot show a Blob directly: the browser gives a temporary address for it (an
 * "object URL"), and keeps the Blob in memory until that address is revoked. The two functions
 * here create those addresses and always revoke them: when the photo changes and when the
 * component that asked for it is destroyed. They must be called while a component is created.
 */

/** A photo being loaded from the photo store, and its address once it is ready. */
export interface LoadedPhoto {
  /** 'none': nothing was asked for. 'missing': the photo does not exist or cannot be read. */
  status: 'none' | 'loading' | 'ready' | 'missing';
  /** The address for `<img src>`. Only when the status is 'ready'. */
  url: string | null;
}

/** The address of a Blob for `<img src>`, or null while there is no Blob. */
export function objectUrl(blob: () => Blob | null): Signal<string | null> {
  const url = signal<string | null>(null);
  effect((onCleanup) => {
    const current = blob();
    if (current === null) {
      url.set(null);
      return;
    }
    const created = URL.createObjectURL(current);
    url.set(created);
    onCleanup(() => URL.revokeObjectURL(created));
  });
  return url.asReadonly();
}

/**
 * Loads a version of the photo with the id that `photoId` gives (null for no photo) and gives
 * its address. It follows `photoId` when it changes.
 */
export function loadedPhoto(
  photos: PhotoStore,
  photoId: () => string | null,
  size: PhotoSize,
): Signal<LoadedPhoto> {
  const state = signal<LoadedPhoto>({ status: 'none', url: null });
  effect((onCleanup) => {
    const id = photoId();
    if (id === null) {
      state.set({ status: 'none', url: null });
      return;
    }
    state.set({ status: 'loading', url: null });
    let created: string | null = null;
    // True when the photo changed or the component was destroyed before the load finished.
    let cancelled = false;
    void photos.load(id, size).then((blob) => {
      if (cancelled) {
        return;
      }
      if (blob === null) {
        state.set({ status: 'missing', url: null });
        return;
      }
      created = URL.createObjectURL(blob);
      state.set({ status: 'ready', url: created });
    });
    onCleanup(() => {
      cancelled = true;
      if (created !== null) {
        URL.revokeObjectURL(created);
      }
    });
  });
  return state.asReadonly();
}
