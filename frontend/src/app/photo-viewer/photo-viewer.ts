import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { PhotoStore } from '../core/photo-store';
import { loadedPhoto } from '../core/photo-url';

/**
 * The full photo of an item, in a window over the page. It uses the native `<dialog>` element
 * opened as a modal: the browser keeps the keyboard focus inside it, closes it with the Escape
 * key and dims the page behind. It is shown while it exists: whoever shows it removes it when
 * it emits `closed`.
 */
@Component({
  selector: 'app-photo-viewer',
  templateUrl: './photo-viewer.html',
  styleUrl: './photo-viewer.scss',
})
export class PhotoViewer {
  /** The id of the photo in the photo store. */
  readonly photoId = input.required<string>();
  /** The name of the item: the title of the window. */
  readonly name = input.required<string>();

  /** The window was closed, with "Close" or with the Escape key. */
  readonly closed = output<void>();

  protected readonly photo = loadedPhoto(inject(PhotoStore), this.photoId, 'full');

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      // showModal() is what makes the window modal. A browser without it still shows the photo.
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
      this.closeButton().nativeElement.focus();
    });
  }

  /** "Close". Closing the dialog fires its "close" event, as the Escape key does. */
  protected close(): void {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      this.closed.emit();
    }
  }
}
