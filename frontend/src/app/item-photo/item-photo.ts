import { Component, effect, inject, input, output } from '@angular/core';
import { PhotoStore } from '../core/photo-store';
import { loadedPhoto } from '../core/photo-url';

/**
 * The thumbnail of the photo of an item, as a square button that opens the full photo. The
 * square is drawn at once and the image appears when it is loaded, so the row does not jump.
 * It does not open anything by itself: it emits and the panel shows the photo.
 */
@Component({
  selector: 'app-item-photo',
  templateUrl: './item-photo.html',
  styleUrl: './item-photo.scss',
})
export class ItemPhoto {
  /** The id of the photo in the photo store. */
  readonly photoId = input.required<string>();
  /** The name of the item, for the accessible name of the button. */
  readonly name = input.required<string>();

  /** The user pressed the thumbnail to see the full photo. */
  readonly opened = output<void>();
  /** The photo with this id does not exist (or cannot be read): the row has no photo to show. */
  readonly missing = output<string>();

  protected readonly photo = loadedPhoto(inject(PhotoStore), this.photoId, 'thumbnail');

  constructor() {
    effect(() => {
      if (this.photo().status === 'missing') {
        this.missing.emit(this.photoId());
      }
    });
  }
}
