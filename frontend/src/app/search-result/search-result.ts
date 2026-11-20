import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { itemOutText } from '../core/item.model';
import { locationLabel, locationText, resultQuantityText, SearchResult } from '../core/item-search';
import { ItemPhoto } from '../item-photo/item-photo';

/**
 * One result of the search: the thumbnail of the item (when it has a photo), its name as a link
 * to its container, its quantity, category and description, and where it is. The link opens the
 * room page with the container selected and the row of the item focused. It only shows the
 * result: the page decides what to do when the thumbnail is pressed.
 */
@Component({
  selector: 'app-search-result',
  imports: [ItemPhoto, RouterLink],
  templateUrl: './search-result.html',
  styleUrl: './search-result.scss',
})
export class SearchResultRow {
  readonly result = input.required<SearchResult>();

  /** The user pressed the thumbnail, to see the full photo. */
  readonly photoOpened = output<void>();

  /** The photo id that turned out not to exist in the photo store: no thumbnail is shown for it. */
  private readonly missingPhotoId = linkedSignal<string | null, string | null>({
    source: () => this.result().item.photoId,
    computation: () => null,
  });

  /** The photo to show, or null: no photo, or a photo that does not exist any more. */
  protected readonly photoId = computed(() => {
    const photoId = this.result().item.photoId;
    return photoId !== null && photoId !== this.missingPhotoId() ? photoId : null;
  });

  /** "Qty 3", "None left" or, with units out of the container, "20 of 100 out". */
  protected readonly quantity = computed(() => resultQuantityText(this.result().item));
  /** True when the quantity says that units are out: it is then drawn inside a box. */
  protected readonly hasOut = computed(() => itemOutText(this.result().item) !== '');

  protected readonly location = computed(() => locationText(this.result()));
  protected readonly locationLabel = computed(() => `Location: ${locationLabel(this.result())}`);

  /** What the room page reads to select the container and focus the row of the item. */
  protected readonly target = computed(() => ({
    container: this.result().containerId,
    item: this.result().item.id,
  }));

  protected onPhotoMissing(photoId: string): void {
    this.missingPhotoId.set(photoId);
  }
}
